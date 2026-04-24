import { buildObservationBankStagePrompt } from './critiqueEvidenceStage.js';
import {
  runParallelCriteriaStage,
  type CriterionWritingResult,
} from './critiqueParallelCriteria.js';
import { runCritiqueSynthesisStage } from './critiqueSynthesisStage.js';
import {
  buildHighDetailImageMessage,
  type VisionUserMessagePart,
} from './openaiVisionContent.js';
import {
  OBSERVATION_BANK_STAGE_OPENAI_SCHEMA,
  type ObservationBank,
  type ObservationBankStageResult,
} from './critiqueZodSchemas.js';
import type {
  CritiqueEvidenceDTO,
  CritiqueRequestBody,
  CritiqueResultDTO,
} from './critiqueTypes.js';
import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import { errorMessage } from './critiqueErrors.js';
import {
  createCritiqueInstrumenter,
  critiqueInstrumentEnabled,
  noopCritiqueInstrumenter,
} from './critiqueInstrumentation.js';
import {
  buildOpenAIMaxTokensParam,
  buildOpenAISamplingParam,
  getOpenAIStageModelMap,
} from './openaiModels.js';
import { createPipelineMetadata, createSucceededStageSnapshot } from './critiquePipeline.js';
import type {
  CritiquePipelineSalvagedCriterion,
  CritiquePipelineStageId,
} from '../shared/critiqueContract.js';
import { composeFallbackCritique } from './critiqueFallback.js';

/**
 * Token cap for the vision stage. Vision is now observation-bank-only: the
 * call produces ~8-12 passages, ~10-22 visible events, a handful of medium
 * cues + photo caveats + intent carriers, and a short top-level read. This
 * is substantially smaller than the old unified vision output, so the cap is
 * meaningfully tighter here than it was when vision also owned per-criterion
 * evidence and per-criterion bounding boxes. The reasoning-model multiplier
 * in `buildOpenAIMaxTokensParam` still applies on top for gpt-5 / o-series.
 */
const OBSERVATION_BANK_MAX_TOKENS = 2200;

/**
 * Derive a back-compatible `CritiqueEvidenceDTO` from the new pipeline so
 * downstream consumers (synthesis, the fallback composer, older saved-critique
 * shapes, and the `photoQualityRead` / `completionRead` fields on the final
 * result) all keep the same structure they always had.
 *
 * The observation-bank stage now owns the top-level read. The per-criterion
 * writer stage owns per-criterion evidence. This function reassembles them
 * into the DTO shape the rest of the code already consumes.
 */
function deriveCritiqueEvidenceFromStages(args: {
  observationStage: ObservationBankStageResult;
  criterionResults: CriterionWritingResult[];
}): CritiqueEvidenceDTO {
  const { observationStage, criterionResults } = args;
  const criterionEvidence = CRITERIA_ORDER.map((criterion) => {
    const writer = criterionResults.find((r) => r.criterion === criterion);
    return {
      criterion,
      // We no longer carry `observationPassageId` through the wire — the
      // writer picks its own passage and the id isn't used downstream.
      // Synthesis consumes the Voice A / Voice B prose directly.
      observationPassageId: 'p1',
      anchor: writer?.anchor.areaSummary ?? '',
      visibleEvidence: writer?.visibleEvidence ?? [],
      strengthRead: writer?.voiceACritique ?? '',
      tensionRead: writer?.tensionRead ?? '',
      preserve: writer?.preserve ?? '',
      confidence: writer?.confidence ?? 'low',
    };
  });
  return {
    intentHypothesis: observationStage.intentHypothesis,
    strongestVisibleQualities: observationStage.strongestVisibleQualities,
    mainTensions: observationStage.mainTensions,
    photoQualityRead: observationStage.photoQualityRead,
    comparisonObservations: observationStage.comparisonObservations,
    completionRead: observationStage.completionRead,
    criterionEvidence,
  };
}

/**
 * Build the final CritiqueResultDTO from the three pipeline outputs
 * (observation-bank vision, per-criterion writer, and the single synthesis
 * call).
 *
 * This is a deliberately thin adapter. Rating-era fields (`level`,
 * `subskills`, `nextTarget`, `actionPlanSteps`, `voiceBPlan`,
 * `phase1.visualInventory`) are intentionally left unset — the UI no longer
 * renders them and the new pipeline will not fabricate them. Old saved
 * critiques from earlier pipeline versions continue to carry those fields in
 * their own JSON and are unaffected by this function because they never
 * pass through it.
 */
function assembleCritiqueFromParallelPipeline(args: {
  observationStage: ObservationBankStageResult;
  criterionResults: CriterionWritingResult[];
  synthesis: Awaited<ReturnType<typeof runCritiqueSynthesisStage>>;
  userTitle?: string;
}): CritiqueResultDTO {
  const { observationStage, criterionResults, synthesis } = args;

  const categories: CritiqueResultDTO['categories'] = CRITERIA_ORDER.map((criterion) => {
    const writer = criterionResults.find((r) => r.criterion === criterion);
    const voiceA = writer?.voiceACritique ?? '';
    const voiceB = writer?.voiceBSuggestions ?? '';
    const anchor = writer?.anchor
      ? {
          areaSummary: writer.anchor.areaSummary,
          evidencePointer: writer.anchor.evidencePointer,
          region: writer.anchor.region,
        }
      : undefined;
    const editPlan = writer?.editPlan;
    return {
      criterion,
      phase1: { visualInventory: '' },
      phase2: { criticsAnalysis: voiceA },
      phase3: { teacherNextSteps: voiceB },
      confidence: writer?.confidence ?? 'low',
      ...(writer?.preserve ? { preserve: writer.preserve } : {}),
      ...(anchor ? { anchor } : {}),
      ...(editPlan ? { editPlan } : {}),
    };
  });

  const suggestedTitles = args.userTitle ? undefined : synthesis.suggestedTitles;

  return {
    categories,
    summary: synthesis.summary || synthesis.overallAnalysis,
    overallSummary: {
      analysis: synthesis.overallAnalysis || synthesis.summary,
      topPriorities: synthesis.topPriorities,
    },
    simpleFeedback: {
      studioAnalysis: synthesis.studioAnalysis,
      studioChanges: synthesis.studioChanges,
    },
    ...(suggestedTitles && suggestedTitles.length ? { suggestedPaintingTitles: suggestedTitles } : {}),
    photoQuality: {
      level: observationStage.photoQualityRead.level,
      summary: observationStage.photoQualityRead.summary,
      issues: observationStage.photoQualityRead.issues,
      tips:
        observationStage.photoQualityRead.level === 'good'
          ? []
          : ['Retake the photo in even light with the full painting square to the camera.'],
    },
    completionRead: observationStage.completionRead,
    analysisSource: 'api',
    overallConfidence:
      categories.some((c) => c.confidence === 'high')
        ? 'high'
        : categories.every((c) => c.confidence === 'low')
          ? 'low'
          : 'medium',
  };
}

/**
 * Observation-bank stage runner. One OpenAI call with the image that produces
 * the shared observation bank and a short top-level read of the painting. Per-
 * criterion work (evidence lines, anchors, bounding boxes, prose, editPlan)
 * happens later, in the parallel writer stage. This split is the single
 * largest pipeline-latency improvement.
 */
async function runObservationBankStage(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<ObservationBankStageResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      // Perception + passage grammar + short top-level read is not dense
      // reasoning. `low` is the fastest setting that reliably produces a
      // well-formed observation bank; bump to `medium` only if passages
      // visibly thin out or intentCarriers land on the wrong choices.
      ...buildOpenAISamplingParam(args.model, { temperature: 0.15, reasoningEffort: 'low' }),
      ...buildOpenAIMaxTokensParam(args.model, OBSERVATION_BANK_MAX_TOKENS),
      response_format: {
        type: 'json_schema',
        json_schema: OBSERVATION_BANK_STAGE_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: buildObservationBankStagePrompt(args.style, args.medium),
        },
        {
          role: 'user',
          content: args.userContent,
        },
      ],
    }),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${response.status}`);
  }

  const choices = json.choices as Array<{
    message?: { content?: string };
    finish_reason?: string;
  }> | undefined;
  const choice = choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Observation-bank response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('Empty observation-bank response');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Observation-bank stage returned non-JSON');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Observation-bank stage returned a non-object payload');
  }

  const parsed = raw as ObservationBankStageResult;
  if (!parsed.observationBank || typeof parsed.observationBank !== 'object') {
    throw new Error('Observation-bank stage missing observationBank');
  }
  return parsed;
}

export async function runOpenAICritique(
  apiKey: string,
  body: CritiqueRequestBody,
  options?: { model?: string }
): Promise<CritiqueResultDTO> {
  const pipelineStart = Date.now();
  const stageModels = getOpenAIStageModelMap({
    evidence: options?.model,
    voiceA: options?.model,
    voiceB: options?.model,
    validation: options?.model,
  });
  const trimmedUserTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  const titleLine =
    trimmedUserTitle.length > 0
      ? ` The artist titled this work: "${trimmedUserTitle}". Use that title where natural.`
      : '';

  const userContent: VisionUserMessagePart[] = [
    {
      type: 'text',
      text: `Observation-bank pass. Style: ${body.style}. Medium: ${body.medium}.${titleLine}

Produce the shared observation bank and the short top-level read of this painting. Do NOT produce per-criterion evidence, per-criterion anchors, bounding-box regions, Voice A / Voice B prose, or editPlan — those all happen downstream, in parallel writer calls that see the image themselves.${
        body.previousCritique && body.previousImageDataUrl
          ? '\n\nA previous photo of the same painting is attached second; you may note comparison observations at the painting level.'
          : ''
      }`,
    },
    buildHighDetailImageMessage(body.imageDataUrl),
  ];

  if (body.previousImageDataUrl && body.previousCritique) {
    userContent.push(buildHighDetailImageMessage(body.previousImageDataUrl));
  }

  const instrumenter = critiqueInstrumentEnabled()
    ? createCritiqueInstrumenter(true)
    : noopCritiqueInstrumenter;

  /**
   * Stage 1 — observation-bank pass.
   *
   * One call, image attached, produces observationBank + intentHypothesis +
   * strongestVisibleQualities + mainTensions + photoQualityRead +
   * completionRead + comparisonObservations. Fast, because per-criterion
   * evidence + anchor regions + prose + editPlan are no longer serialised
   * into this response. Instrumentation buckets keep the legacy
   * `'observation'` / `'evidence'` names so existing dashboards keep working.
   */
  const visionStart = Date.now();
  const observationStage = await instrumenter.time('observation', () =>
    runObservationBankStage(apiKey, {
      model: stageModels.evidence,
      style: body.style,
      medium: body.medium,
      userContent,
    })
  );
  await instrumenter.time('evidence', async () => undefined);
  const visionElapsedMs = Date.now() - visionStart;
  console.log(
    `[critique observation-bank stage] complete in ${(visionElapsedMs / 1000).toFixed(1)}s (model=${stageModels.evidence})`
  );
  if (observationStage.photoQualityRead.level === 'poor') {
    console.warn('[critique photo quality poor — continuing with full critique]', {
      summary: observationStage.photoQualityRead.summary,
    });
  }

  /**
   * Stage 2 — eight parallel per-criterion writer calls.
   *
   * Each writer sees the painting image and the shared observation bank and
   * is responsible for picking its anchor, writing evidence lines, producing
   * Voice A and Voice B prose, emitting a structured editPlan, and locating
   * the anchor as a normalized bounding box. Per-criterion failure degrades
   * to a minimal fallback entry.
   */
  const parallelStart = Date.now();
  const parallelCriteria = await instrumenter.time('writing', () =>
    runParallelCriteriaStage({
      apiKey,
      model: stageModels.voiceA,
      style: body.style,
      medium: body.medium,
      userTitle: trimmedUserTitle || undefined,
      imageDataUrl: body.imageDataUrl,
      observationBank: observationStage.observationBank,
      topLevelContext: {
        intentHypothesis: observationStage.intentHypothesis,
        strongestVisibleQualities: observationStage.strongestVisibleQualities,
        mainTensions: observationStage.mainTensions,
      },
    })
  );
  console.log(
    `[critique parallel criteria] ${((Date.now() - parallelStart) / 1000).toFixed(1)}s (model=${stageModels.voiceA}, ${parallelCriteria.failedCriteria.length}/${parallelCriteria.results.length} criteria fell back)`
  );

  /**
   * Stage 3 — synthesis. Takes the per-criterion prose and the top-level
   * observation-stage read and produces overall summary, priorities, studio
   * changes, and suggested titles. Back-compatible: it still consumes the
   * `CritiqueEvidenceDTO` shape, which we derive from the new stages.
   */
  const derivedEvidence = deriveCritiqueEvidenceFromStages({
    observationStage,
    criterionResults: parallelCriteria.results,
  });

  let synthesis: Awaited<ReturnType<typeof runCritiqueSynthesisStage>> | undefined;
  try {
    synthesis = await instrumenter.time('validation', () =>
      runCritiqueSynthesisStage({
        apiKey,
        model: stageModels.validation,
        style: body.style,
        medium: body.medium,
        userTitle: trimmedUserTitle || undefined,
        evidence: derivedEvidence,
        criterionResults: parallelCriteria.results,
      })
    );
  } catch (synthesisError) {
    console.warn('[critique synthesis failed — falling back to minimal safe critique]', {
      error: errorMessage(synthesisError),
    });
  }

  let guarded: CritiqueResultDTO;
  const recoverySalvage: CritiquePipelineSalvagedCriterion[] = [];

  if (!synthesis) {
    guarded = composeFallbackCritique({
      style: body.style,
      medium: body.medium,
      evidence: derivedEvidence,
      paintingTitle: trimmedUserTitle || undefined,
      failureStage: 'final',
    });
    recoverySalvage.push(
      ...parallelCriteria.failedCriteria.map((entry) => ({
        stage: 'voice_a' as const,
        criterion: entry.criterion as CriterionLabel,
        reason: entry.reason,
      }))
    );
  } else {
    guarded = assembleCritiqueFromParallelPipeline({
      observationStage,
      criterionResults: parallelCriteria.results,
      synthesis,
      userTitle: trimmedUserTitle || undefined,
    });
    recoverySalvage.push(
      ...parallelCriteria.failedCriteria.map((entry) => ({
        stage: 'voice_a' as const,
        criterion: entry.criterion as CriterionLabel,
        reason: entry.reason,
      }))
    );
  }

  instrumenter.logSummary({
    models: {
      evidence: stageModels.evidence,
      voiceA: stageModels.voiceA,
      voiceB: stageModels.voiceA,
      validation: stageModels.validation,
      clarity: stageModels.clarity,
    },
  });

  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  const existingPipeline = guarded.pipeline;
  const usedDegradedPath =
    Boolean(guarded.pipeline?.completedWithFallback) || recoverySalvage.length > 0;
  const stageOrder: CritiquePipelineStageId[] = ['voice_a', 'voice_b', 'validation'];
  const withStages = {
    evidence: createSucceededStageSnapshot({
      stage: 'evidence',
      model: stageModels.evidence,
    }),
    ...Object.fromEntries(
      stageOrder.map((stageId) => {
        const model =
          stageId === 'voice_a'
            ? stageModels.voiceA
            : stageId === 'voice_b'
              ? stageModels.voiceB
              : stageModels.validation;

        return [stageId, createSucceededStageSnapshot({ stage: stageId, model })];
      })
    ),
    ...(existingPipeline?.stages?.fallback
      ? {
          fallback: existingPipeline.stages.fallback,
        }
      : {}),
  };
  const withPipeline = {
    ...guarded,
    pipeline: createPipelineMetadata({
      resultTier:
        existingPipeline?.resultTier === 'minimal_safe'
          ? 'minimal_safe'
          : usedDegradedPath
            ? 'validated_reduced'
            : (existingPipeline?.resultTier ?? 'full'),
      completedWithFallback:
        (existingPipeline?.completedWithFallback ?? false) ||
        usedDegradedPath,
      stages: withStages,
      salvagedCriteria: [
        ...(existingPipeline?.salvagedCriteria ?? []),
        ...recoverySalvage,
      ],
    }),
  };
  console.log(
    `[critique total] ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s end-to-end`
  );
  return trimmedTitle ? { ...withPipeline, paintingTitle: trimmedTitle } : withPipeline;
}

/**
 * Re-export for callers that want the `ObservationBank` type. Kept so the
 * architecture test + older imports elsewhere in the repo continue to type-
 * check without touching their import sites.
 */
export type { ObservationBank };
