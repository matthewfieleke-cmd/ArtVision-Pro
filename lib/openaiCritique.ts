import { buildVisionStagePrompt } from './critiqueEvidenceStage.js';
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
  VISION_STAGE_OPENAI_SCHEMA,
  type ObservationBank,
} from './critiqueZodSchemas.js';
import type {
  CritiqueEvidenceDTO,
  CritiqueRequestBody,
  CritiqueResultDTO,
} from './critiqueTypes.js';
import { CRITERIA_ORDER } from '../shared/criteria.js';
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
 * The unified vision call holds the full observation bank, the full evidence
 * object, AND the eight per-criterion anchor regions in one response.
 * Trimmed from 7200 to 5000 after production runs showed gpt-5.4 expanding
 * into ~110-120s of reasoning tokens regardless of how much actual output
 * it needed. A tighter cap pushes the model to finish sooner while still
 * leaving headroom above observed visible-output token counts (~2800-3400).
 * The reasoning-model multiplier in `buildOpenAIMaxTokensParam` still
 * applies on top for gpt-5 / o-series so invisible reasoning tokens aren't
 * starved.
 */
const VISION_MAX_TOKENS = 5000;

type CriterionAnchorRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Defensive clamp for vision-stage regions. Mirrors the clamp the dedicated
 * `refineCritiqueAnchorRegionsFromImage` helper applied so downstream UI code
 * (anchor overlay) keeps the same min-size and within-bounds guarantees.
 */
function clampCriterionAnchorRegion(region: CriterionAnchorRegion): CriterionAnchorRegion {
  const x = Math.min(1, Math.max(0, region.x));
  const y = Math.min(1, Math.max(0, region.y));
  let width = Math.min(1, Math.max(0.02, region.width));
  let height = Math.min(1, Math.max(0.02, region.height));
  if (x + width > 1) width = Math.max(0.02, 1 - x);
  if (y + height > 1) height = Math.max(0.02, 1 - y);
  return { x, y, width, height };
}

function extractVisionAnchorRegions(raw: unknown): Map<string, CriterionAnchorRegion> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const list = (raw as Record<string, unknown>).anchorRegions;
  if (!Array.isArray(list)) return undefined;
  const map = new Map<string, CriterionAnchorRegion>();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const criterion = typeof e.criterion === 'string' ? e.criterion : undefined;
    const region = e.region;
    if (!criterion || !region || typeof region !== 'object') continue;
    const r = region as Record<string, unknown>;
    if (
      typeof r.x !== 'number' ||
      typeof r.y !== 'number' ||
      typeof r.width !== 'number' ||
      typeof r.height !== 'number' ||
      Number.isNaN(r.x) ||
      Number.isNaN(r.y) ||
      Number.isNaN(r.width) ||
      Number.isNaN(r.height) ||
      r.width <= 0 ||
      r.height <= 0
    ) {
      continue;
    }
    map.set(criterion, clampCriterionAnchorRegion({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    }));
  }
  return map.size > 0 ? map : undefined;
}

/**
 * Merge C: applies vision-stage anchor regions to the final critique
 * categories, replacing whatever Voice B produced. Vision regions are
 * derived from the same call that produced the evidence anchors, so they
 * are tightly aligned with the prose down-stream. Falls open: if the vision
 * stage did not produce a region for a criterion, the original Voice B
 * region is left untouched.
 */
function applyVisionAnchorRegionsToCritique(
  critique: CritiqueResultDTO,
  regions: Map<string, CriterionAnchorRegion> | undefined
): CritiqueResultDTO {
  if (!regions || regions.size === 0) return critique;
  return {
    ...critique,
    categories: critique.categories.map((category) => {
      if (!category.anchor) return category;
      const region = regions.get(category.criterion);
      if (!region) return category;
      return {
        ...category,
        anchor: {
          ...category.anchor,
          region,
        },
      };
    }),
  };
}

/**
 * Build the final CritiqueResultDTO from the three pipeline outputs (vision
 * evidence, per-criterion parallel writing, and the single synthesis call).
 *
 * This is a deliberately thin adapter: it only fills the fields the current
 * UI actually reads. Rating-era fields (`level`, `subskills`, `nextTarget`,
 * `actionPlanSteps`, `voiceBPlan`, `editPlan`, `phase1.visualInventory`) are
 * intentionally left unset — the UI no longer renders them and the new
 * pipeline will not fabricate them. Old saved critiques from earlier
 * pipeline versions continue to carry those fields in their own JSON and
 * are unaffected by this function because they never pass through it.
 */
function assembleCritiqueFromParallelPipeline(args: {
  evidence: {
    intentHypothesis: string;
    strongestVisibleQualities: string[];
    mainTensions: string[];
    photoQualityRead: { level: 'poor' | 'fair' | 'good'; summary: string; issues: string[] };
    completionRead: {
      state: 'unfinished' | 'likely_finished' | 'uncertain';
      confidence: 'low' | 'medium' | 'high';
      cues: string[];
      rationale: string;
    };
    criterionEvidence: Array<{
      criterion: (typeof import('../shared/criteria.js'))['CRITERIA_ORDER'][number];
      anchor: string;
      visibleEvidence: string[];
      preserve: string;
      confidence: 'low' | 'medium' | 'high';
    }>;
  };
  criterionResults: CriterionWritingResult[];
  synthesis: Awaited<ReturnType<typeof runCritiqueSynthesisStage>>;
  userTitle?: string;
}): CritiqueResultDTO {
  const { evidence, criterionResults, synthesis } = args;

  const categories: CritiqueResultDTO['categories'] = CRITERIA_ORDER.map((criterion) => {
    const writing = criterionResults.find((r) => r.criterion === criterion);
    const evidenceEntry = evidence.criterionEvidence.find((e) => e.criterion === criterion);

    const voiceA = writing?.voiceACritique ?? '';
    const voiceB = writing?.voiceBSuggestions ?? '';

    return {
      criterion,
      phase1: { visualInventory: '' },
      phase2: { criticsAnalysis: voiceA },
      phase3: { teacherNextSteps: voiceB },
      confidence: writing?.confidence ?? evidenceEntry?.confidence ?? 'low',
      ...(writing?.preserve ? { preserve: writing.preserve } : evidenceEntry ? { preserve: evidenceEntry.preserve } : {}),
      ...(evidenceEntry
        ? {
            anchor: {
              areaSummary: evidenceEntry.anchor,
              evidencePointer: evidenceEntry.visibleEvidence[0] ?? evidenceEntry.anchor,
              region: { x: 0.2, y: 0.2, width: 0.35, height: 0.35 },
            },
          }
        : {}),
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
      level: evidence.photoQualityRead.level,
      summary: evidence.photoQualityRead.summary,
      issues: evidence.photoQualityRead.issues,
      tips:
        evidence.photoQualityRead.level === 'good'
          ? []
          : ['Retake the photo in even light with the full painting square to the camera.'],
    },
    completionRead: evidence.completionRead,
    analysisSource: 'api',
    overallConfidence:
      categories.some((c) => c.confidence === 'high')
        ? 'high'
        : categories.every((c) => c.confidence === 'low')
          ? 'low'
          : 'medium',
  };
}


type VisionStageRunResult = {
  evidence: CritiqueEvidenceDTO;
  observationBank: ObservationBank;
  /** Per-criterion anchor regions captured from the vision call. Applied to the assembled critique so the image-locating boxes the model produced alongside the evidence anchors carry forward into the final payload. Undefined when the model declines to emit them. */
  anchorRegions?: Map<string, CriterionAnchorRegion>;
};

/**
 * Stage 1 of the critique pipeline. One OpenAI call produces the
 * observation bank, the full evidence object, and the eight per-criterion
 * anchor regions in a single Strict Structured Output response. Quality
 * is governed entirely by the system prompt; shape is guaranteed by the
 * JSON schema. Zero retries, zero repair, zero custom cross-field
 * validation — transient 5xx/timeouts throw and bubble up to the caller,
 * which composes a minimal-safe fallback critique.
 */
async function runCritiqueVisionStage(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<VisionStageRunResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      // Reasoning models (gpt-5 family) reject custom `temperature` and use
      // `reasoning_effort` instead. The vision pass is predominantly
      // perception — reading what is actually in the photo and mapping it
      // onto the observation/evidence schema — not dense multi-step
      // reasoning. `medium` (OpenAI's implicit default) is plenty and is
      // what production ran at before `reasoning_effort` was passed
      // explicitly; `high` here roughly doubled vision latency with no
      // visible quality gain and was the primary cause of a post-upgrade
      // regression where critiques sometimes exceeded the Vercel function
      // timeout. Use `low` only if you need to aggressively shave cost.
      ...buildOpenAISamplingParam(args.model, { temperature: 0.12, reasoningEffort: 'medium' }),
      ...buildOpenAIMaxTokensParam(args.model, VISION_MAX_TOKENS),
      response_format: {
        type: 'json_schema',
        json_schema: VISION_STAGE_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: buildVisionStagePrompt(args.style, args.medium),
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
    throw new Error('Vision response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('Empty vision response');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Vision stage returned non-JSON');
  }

  const rawObservationBank =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).observationBank
      : undefined;
  const rawEvidence =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).evidence
      : undefined;
  if (
    !rawObservationBank ||
    typeof rawObservationBank !== 'object' ||
    !rawEvidence ||
    typeof rawEvidence !== 'object'
  ) {
    throw new Error(
      'Vision response missing required top-level keys "observationBank" and/or "evidence".'
    );
  }

  const observationBank = rawObservationBank as unknown as ObservationBank;
  const evidence = rawEvidence as unknown as CritiqueEvidenceDTO;
  const anchorRegions = extractVisionAnchorRegions(raw);

  return {
    evidence,
    observationBank,
    ...(anchorRegions ? { anchorRegions } : {}),
  };
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
      ? ` The artist titled this work: "${trimmedUserTitle}". Use that title when referring to the piece in summary and feedback where natural.`
      : '';

  const titleSuggestionLine =
    trimmedUserTitle.length === 0
      ? ` The artist has not supplied a title. Output suggestedPaintingTitles: exactly three { category, title, rationale } objects—formalist (structure/layout), tactile (material handling), intent (mood/presence). Titles should sound like studio working labels: short, concrete, 2–8 words; sentence case or light title case; no quotes; avoid gallery clichés and repeated suffixes ("Study", "Tension", "Journey", etc.) unless truly apt. One plain-sentence rationale each, tied to this image’s evidence.`
      : '';

  const userContent: VisionUserMessagePart[] = [
    {
      type: 'text',
      text: `Analyze this painting for studio use. Style: ${body.style}. Medium: ${body.medium}.${titleLine}${titleSuggestionLine}

Never name specific artists, famous artworks, or art-historical figures; do not compare this image to named painters or movements. Stay on what is visible in the photo.

Ground every criterion in what is visible in the photo. Prefer "in the ___ area of the painting" over abstract wording.${
        body.previousCritique && body.previousImageDataUrl
          ? '\n\nA previous photo of the same painting is attached second, followed by the prior critique JSON.'
          : ''
      }`,
    },
    buildHighDetailImageMessage(body.imageDataUrl),
  ];

  if (body.previousImageDataUrl && body.previousCritique) {
    userContent.push(buildHighDetailImageMessage(body.previousImageDataUrl));
    userContent.push({
      type: 'text',
      text: `Prior critique JSON (for comparison only):\n${JSON.stringify(body.previousCritique)}`,
    });
  }

  const instrumenter = critiqueInstrumentEnabled()
    ? createCritiqueInstrumenter(true)
    : noopCritiqueInstrumenter;

  /**
   * Stage 1 — the unified vision call. Produces the observation bank, the
   * full evidence object, and the eight per-criterion anchor regions in a
   * single Strict Structured Output response.
   *
   * Instrumentation buckets remain `'observation'` and `'evidence'` so
   * existing dashboards keep working; the unified call is timed once under
   * `'observation'` and the `'evidence'` bucket records a zero-cost entry
   * to preserve the schema of the timing payload.
   */
  const visionStart = Date.now();
  const visionRun = await instrumenter.time('observation', () =>
    runCritiqueVisionStage(apiKey, {
      model: stageModels.evidence,
      style: body.style,
      medium: body.medium,
      userContent,
    })
  );
  const visionElapsedMs = Date.now() - visionStart;
  await instrumenter.time('evidence', async () => undefined);
  const evidence = visionRun.evidence;
  const visionAnchorRegions = visionRun.anchorRegions;
  console.log(
    `[critique vision path] merged vision call complete in ${(visionElapsedMs / 1000).toFixed(1)}s (model=${stageModels.evidence}, anchor regions: ${
      visionAnchorRegions ? `${visionAnchorRegions.size}/8 from vision` : 'none — will use late-stage refine'
    })`
  );

  if (evidence.photoQualityRead.level === 'poor') {
    console.warn('[critique photo quality poor — continuing with full critique]', {
      summary: evidence.photoQualityRead.summary,
    });
  }

  /**
   * New 3-stage parallel pipeline (replaces Voice A + Voice B + validation +
   * clarity + guardrails from the earlier rating-era design):
   *
   *   1. Vision (already ran above; produced `evidence` + per-criterion
   *      anchor regions).
   *   2. Parallel per-criterion Voice A+B calls (8 concurrent, text-only,
   *      strict JSON schema, zero retries).
   *   3. Synthesis call (single, text-only, strict JSON schema) that rolls
   *      the eight criterion critiques into overall summary, top
   *      priorities, studio analysis, studio changes, and suggested
   *      painting titles.
   *
   * There is no retry loop, no custom cross-field validator, and no Zod
   * guardrail pass — OpenAI Structured Outputs guarantees shape, and any
   * single-criterion failure degrades gracefully to evidence-derived prose
   * inside runParallelCriteriaStage itself. If the synthesis call fails we
   * compose the minimal-safe fallback critique.
   */
  const parallelStart = Date.now();
  const parallelCriteria = await instrumenter.time('writing', () =>
    runParallelCriteriaStage({
      apiKey,
      model: stageModels.voiceA,
      style: body.style,
      medium: body.medium,
      userTitle: trimmedUserTitle || undefined,
      evidence,
    })
  );
  console.log(
    `[critique parallel criteria] ${((Date.now() - parallelStart) / 1000).toFixed(1)}s (model=${stageModels.voiceA}, ${parallelCriteria.failedCriteria.length}/${parallelCriteria.results.length} criteria fell back)`
  );

  let synthesis: Awaited<ReturnType<typeof runCritiqueSynthesisStage>> | undefined;
  try {
    synthesis = await instrumenter.time('validation', () =>
      runCritiqueSynthesisStage({
        apiKey,
        model: stageModels.validation,
        style: body.style,
        medium: body.medium,
        userTitle: trimmedUserTitle || undefined,
        evidence,
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
      evidence,
      paintingTitle: trimmedUserTitle || undefined,
      failureStage: 'final',
    });
    recoverySalvage.push(
      ...parallelCriteria.failedCriteria.map((entry) => ({
        stage: 'voice_a' as const,
        criterion: entry.criterion,
        reason: entry.reason,
      }))
    );
  } else {
    const assembled = assembleCritiqueFromParallelPipeline({
      evidence,
      criterionResults: parallelCriteria.results,
      synthesis,
      userTitle: trimmedUserTitle || undefined,
    });
    guarded = applyVisionAnchorRegionsToCritique(assembled, visionAnchorRegions);
    recoverySalvage.push(
      ...parallelCriteria.failedCriteria.map((entry) => ({
        stage: 'voice_a' as const,
        criterion: entry.criterion,
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
        ...(evidence.salvagedCriteria ?? []),
        ...recoverySalvage,
      ],
    }),
  };
  console.log(
    `[critique total] ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s end-to-end`
  );
  return trimmedTitle ? { ...withPipeline, paintingTitle: trimmedTitle } : withPipeline;
}
