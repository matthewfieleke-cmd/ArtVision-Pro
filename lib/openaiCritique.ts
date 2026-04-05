import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import { runCritiqueCalibrationStage } from './critiqueCalibrationStage.js';
import { applyCalibrationToCritique } from './critiqueCalibrationStage.js';
import { buildEvidenceStagePrompt, buildObservationStagePrompt } from './critiqueEvidenceStage.js';
import {
  buildHighDetailImageMessage,
  type VisionUserMessagePart,
} from './openaiVisionContent.js';
import {
  EVIDENCE_OPENAI_SCHEMA,
  OBSERVATION_BANK_OPENAI_SCHEMA,
  observationBankSchema,
  type ObservationBank,
} from './critiqueZodSchemas.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';
import { validateEvidenceResult } from './critiqueValidation.js';
import { runCritiqueWritingStage } from './critiqueWritingStage.js';
import {
  CritiquePipelineError,
  CritiqueGroundingError,
  CritiqueRuntimeEvalError,
  CritiqueRetryExhaustedError,
  CritiqueValidationError,
  type CritiqueCriterionEvidencePreview,
  type CritiqueDebugPayload,
  type CritiqueDebugInfo,
  errorDetails,
  errorMessage,
} from './critiqueErrors.js';
import { assertCritiqueQualityGate } from './critiqueEval.js';
import {
  createCritiqueInstrumenter,
  critiqueInstrumentEnabled,
  noopCritiqueInstrumenter,
} from './critiqueInstrumentation.js';
import { weakWorkCompositionRepairExamples, weakWorkRepairExamples } from './critiqueWeakWorkContracts.js';
import { getOpenAIStageModelMap } from './openaiModels.js';
import {
  createFailedStageSnapshot,
  createPipelineMetadata,
  createSkippedStageSnapshot,
  createSucceededStageSnapshot,
  stageIdFromErrorStage,
} from './critiquePipeline.js';
import { composeFallbackCritique } from './critiqueFallback.js';
import type { CritiquePipelineStageId } from '../shared/critiqueContract.js';

const EVIDENCE_MAX_TOKENS = 3600;
const OBSERVATION_MAX_TOKENS = 2600;

function summarizeRawForLog(raw: unknown): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) return '[unserializable raw payload]';
    return serialized.length > 4000 ? `${serialized.slice(0, 4000)}…[truncated]` : serialized;
  } catch {
    return '[unserializable raw payload]';
  }
}

function extractCriterionEvidencePreview(raw: unknown): Array<{
  criterion: string;
  anchor?: string;
  visibleEvidencePreview?: string[];
}> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const criterionEvidence = (raw as { criterionEvidence?: unknown }).criterionEvidence;
  if (!Array.isArray(criterionEvidence)) return undefined;
  return criterionEvidence
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      criterion: typeof entry.criterion === 'string' ? entry.criterion : '[missing criterion]',
      ...(typeof entry.anchor === 'string' ? { anchor: entry.anchor } : {}),
      ...(Array.isArray(entry.visibleEvidence)
        ? {
            visibleEvidencePreview: entry.visibleEvidence
              .filter((line): line is string => typeof line === 'string')
              .slice(0, 4),
          }
        : {}),
    }));
}

function criterionEvidencePreviewFromAttempts(
  attempts: CritiqueDebugInfo[]
): CritiqueCriterionEvidencePreview[] {
  const byCriterion = new Map<string, CritiqueCriterionEvidencePreview>();
  for (const attempt of [...attempts].reverse()) {
    for (const preview of attempt.criterionEvidencePreview ?? []) {
      if (!byCriterion.has(preview.criterion)) {
        byCriterion.set(preview.criterion, preview);
      }
    }
  }
  return Array.from(byCriterion.values());
}

function evidenceAttemptsFromContext(
  error: unknown,
  attemptHistory?: CritiqueDebugInfo[]
): CritiqueDebugInfo[] {
  if (attemptHistory && attemptHistory.length > 0) return attemptHistory;
  if (!(error instanceof CritiquePipelineError)) return [];
  return Array.isArray(error.debug?.attempts) ? error.debug.attempts : [];
}

function criterionEvidencePreviewFromError(
  error: unknown,
  attemptHistory?: CritiqueDebugInfo[]
): CritiqueCriterionEvidencePreview[] {
  return criterionEvidencePreviewFromAttempts(evidenceAttemptsFromContext(error, attemptHistory));
}

function repeatedFailureCriteria(
  attempts: CritiqueDebugInfo[],
  matcher: (detail: string) => string | undefined
): string[] {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    for (const detail of attempt.details) {
      const criterion = matcher(detail)?.trim();
      if (!criterion) continue;
      counts.set(criterion, (counts.get(criterion) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([criterion]) => criterion);
}

function formatCriterionEvidencePreview(
  previews: CritiqueCriterionEvidencePreview[],
  criteria: string[],
  heading: string
): string {
  const blocks = criteria
    .map((criterion) => previews.find((preview) => preview.criterion === criterion))
    .filter((preview): preview is CritiqueCriterionEvidencePreview => Boolean(preview))
    .map((preview) => {
      const evidenceLines = (preview.visibleEvidencePreview ?? []).map((line) => `  - "${line}"`).join('\n');
      return `${heading} ${preview.criterion}:${preview.anchor ? `\n- Previous anchor: "${preview.anchor}"` : ''}${evidenceLines ? `\n- Previous visibleEvidence lines to rewrite:\n${evidenceLines}` : ''}`;
    });
  return blocks.length > 0 ? `\n\n${blocks.join('\n')}` : '';
}

function logEvidenceAttemptFailure(
  context: { attempt: number; repairNote?: string },
  error: unknown,
  raw?: unknown
): void {
  const errorDebug =
    error instanceof CritiqueValidationError || error instanceof CritiqueRetryExhaustedError
      ? error.debug?.attempts?.[0]
      : undefined;
  const payload = {
    stage: 'evidence',
    attempt: context.attempt,
    error: errorMessage(error),
    details: errorDetails(error),
    ...(context.repairNote ? { repairNotePreview: context.repairNote.slice(0, 1200) } : {}),
    ...(raw !== undefined
      ? {
          rawPreview: summarizeRawForLog(raw),
          criterionEvidencePreview: extractCriterionEvidencePreview(raw),
        }
      : errorDebug
        ? {
            ...(errorDebug.rawPreview ? { rawPreview: errorDebug.rawPreview } : {}),
            ...(errorDebug.criterionEvidencePreview
              ? { criterionEvidencePreview: errorDebug.criterionEvidencePreview }
              : {}),
          }
      : {}),
  };
  console.error('[critique evidence attempt failed]', payload);
}

function logQualityGateFailure(critique: CritiqueResultDTO): void {
  console.error('[critique quality gate payload]', {
    topPriorities: critique.overallSummary?.topPriorities ?? [],
    studioChanges: critique.simpleFeedback?.studioChanges ?? [],
    categories: critique.categories.map((category) => ({
      criterion: category.criterion,
      level: category.level,
      teacherNextSteps: category.phase3.teacherNextSteps,
      anchor: category.anchor?.areaSummary,
      editTarget: category.editPlan?.targetArea,
      intendedChange: category.editPlan?.intendedChange,
    })),
  });
}

function logGroundingGateFailure(critique: CritiqueResultDTO): void {
  console.error('[critique grounding gate payload]', {
    summary: critique.summary,
    analysis: critique.overallSummary?.analysis ?? '',
    whatWorks: critique.simpleFeedback?.studioAnalysis.whatWorks ?? '',
    whatCouldImprove: critique.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '',
    topPriorities: critique.overallSummary?.topPriorities ?? [],
    studioChanges: critique.simpleFeedback?.studioChanges ?? [],
    categories: critique.categories.map((category) => ({
      criterion: category.criterion,
      anchorArea: category.anchor?.areaSummary,
      anchorPointer: category.anchor?.evidencePointer,
      critic: category.phase2.criticsAnalysis,
      teacher: category.phase3.teacherNextSteps,
      editTarget: category.editPlan?.targetArea,
    })),
  });
}

function buildEvidenceAttemptDebugInfo(args: {
  attempt: number;
  error: unknown;
  repairNote?: string;
  raw?: unknown;
}): CritiqueDebugInfo {
  return {
    attempt: args.attempt,
    error: errorMessage(args.error),
    details: errorDetails(args.error),
    ...(args.repairNote ? { repairNotePreview: args.repairNote.slice(0, 1200) } : {}),
    ...(args.raw !== undefined
      ? {
          rawPreview: summarizeRawForLog(args.raw),
          criterionEvidencePreview: extractCriterionEvidencePreview(args.raw),
        }
      : {}),
  };
}

function singleAttemptDebugPayload(args: {
  attempt: number;
  error: unknown;
  repairNote?: string;
  raw?: unknown;
}): CritiqueDebugPayload {
  return {
    attempts: [buildEvidenceAttemptDebugInfo(args)],
  };
}

type EvidenceStageRunResult = {
  evidence: ReturnType<typeof validateEvidenceResult>;
  observationBank: ObservationBank;
  failedAttempts: CritiqueDebugInfo[];
  successAttempt: number;
};

async function runCritiqueObservationStage(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<ObservationBank> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.1,
      max_tokens: OBSERVATION_MAX_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: OBSERVATION_BANK_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: buildObservationStagePrompt(args.style, args.medium),
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
    throw new Error('Observation response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty observation response');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Observation stage returned non-JSON');
  }

  const parsed = observationBankSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Observation stage validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function runCritiqueEvidenceStage(
  apiKey: string,
  args: {
    attempt: number;
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
    observationBank: ObservationBank;
    repairNote?: string;
    allowLenientValidation?: boolean;
  }
): Promise<ReturnType<typeof validateEvidenceResult>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.15,
      max_tokens: EVIDENCE_MAX_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: EVIDENCE_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: args.repairNote
            ? `${buildEvidenceStagePrompt(args.style, args.medium)}\n\nCorrection required on retry:\n${args.repairNote}`
            : buildEvidenceStagePrompt(args.style, args.medium),
        },
        {
          role: 'user',
          content: [
            ...args.userContent,
            {
              type: 'text',
              text: `Shared observation bank (reuse these passages and events where they genuinely fit):\n${JSON.stringify(args.observationBank)}`,
            },
          ],
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
    throw new Error('Evidence response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty model response');

  try {
    const raw = JSON.parse(text);
    try {
      return validateEvidenceResult(raw);
    } catch (error) {
      if (args.allowLenientValidation) {
        const message = error instanceof Error ? error.message : '';
        const canUseLenientFallback =
          /Evidence intentHypothesis is too flattering or style-biased for weak work|Evidence strongestVisibleQualities are too flattering or style-biased for weak work|Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for|Visible evidence does not support anchor for|Conceptual evidence anchor is too soft for/.test(
            message
          );
        if (canUseLenientFallback) {
          return validateEvidenceResult(raw, { mode: 'lenient' });
        }
      }
      throw error;
    }
  } catch (error) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }
    if (error instanceof Error && error.message !== 'Model returned invalid evidence JSON') {
      const debug = singleAttemptDebugPayload({
        attempt: args.attempt,
        error,
        repairNote: args.repairNote,
        raw,
      });
      throw new CritiqueValidationError('Evidence stage validation failed.', {
        stage: 'evidence',
        details: [error.message],
        cause: error,
        debug,
      });
    }
    const debug = singleAttemptDebugPayload({
      attempt: args.attempt,
      error,
      repairNote: args.repairNote,
      raw,
    });
    throw new CritiqueValidationError('Model returned invalid evidence JSON', {
      stage: 'evidence',
      cause: error,
      debug,
    });
  }
}

const MAX_STAGE_ATTEMPTS = 3;

export function buildEvidenceRepairNote(
  error: unknown,
  attemptHistory?: CritiqueDebugInfo[]
): string {
  const details = errorDetails(error);
  const attempts = evidenceAttemptsFromContext(error, attemptHistory);
  const criterionPreviews = criterionEvidencePreviewFromError(error, attemptHistory);
  const weakWorkExamples = weakWorkRepairExamples().map((rule) => `- ${rule}`).join('\n');
  const weakWorkCompositionExamples = weakWorkCompositionRepairExamples()
    .map((rule) => `- ${rule}`)
    .join('\n');
  const surfaceAnchorFailure = details.some((detail) =>
    /Invalid evidence anchor for Surface and medium handling|Visible evidence does not support anchor for Surface and medium handling/.test(
      detail
    )
  );
  const unsupportedAnchorCriteria = Array.from(
    new Set(
      details
        .map((detail) => detail.match(/^Visible evidence does not support anchor for (.+)$/)?.[1]?.trim())
        .filter((criterion): criterion is string => Boolean(criterion))
    )
  );
  const genericEvidenceCriteria = Array.from(
    new Set(
      details
        .map((detail) => detail.match(/^(?:Visible evidence|strengthRead|preserve) is too generic for (.+)$/)?.[1]?.trim())
        .filter((criterion): criterion is string => Boolean(criterion))
    )
  );
  const topLevelToneFailure = details.some((detail) =>
    /(?:Evidence )?intentHypothesis is too flattering or style-biased(?: for weak work)?|(?:Evidence )?strongestVisibleQualities are too flattering or style-biased(?: for weak work)?|(?:Evidence )?comparisonObservations are too flattering or style-biased(?: for weak work)?/.test(
      detail
    )
  );
  const genericEvidencePreviewBlock = formatCriterionEvidencePreview(
    criterionPreviews,
    genericEvidenceCriteria,
    'Previous evidence preview for'
  );
  const unsupportedAnchorPreviewBlock = formatCriterionEvidencePreview(
    criterionPreviews,
    unsupportedAnchorCriteria,
    'Previous anchor-support preview for'
  );
  const repeatedGenericCompositionCriteria = repeatedFailureCriteria(
    attempts,
    (detail) =>
      /^(?:Visible evidence|strengthRead|preserve) is too generic for (Composition and shape structure)$/.exec(
        detail
      )?.[1]
  );
  const repeatedConceptualCriteria = repeatedFailureCriteria(
    attempts,
    (detail) =>
      /^(?:Conceptual evidence anchor is too soft for|Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for) (Intent and necessity|Presence, point of view, and human force)$/.exec(
        detail
      )?.[1]
  );
  const repeatedFailurePreviewBlock = formatCriterionEvidencePreview(
    criterionPreviews,
    [...repeatedGenericCompositionCriteria, ...repeatedConceptualCriteria],
    'Latest preview for repeatedly failing'
  );

  return `Previous evidence attempt failed: ${errorMessage(error)}\n${errorDetails(error)
    .map((detail) => `- ${detail}`)
    .join('\n')}\nRegenerate the full evidence JSON. Use one concrete anchor per criterion, keep every claim visible, and do not change the schema.

Critical anchor rule:
- Every criterion anchor must name one physical passage or junction on the canvas, not a painting-wide abstraction.
- For Intent and necessity or Presence, point of view, and human force, anchor to the visible carrier of that intent or force: a face against a wall, a path into an opening, a hand against cloth, a silhouette against ground.
- For conceptual criteria, the anchor does NOT need to use an approved noun list. It needs to be pointable in the painting and restated concretely in the visibleEvidence lines.
- On object studies or architecture, conceptual anchors still need a physical carrier passage: a pump head against a bottle neck, a floral label on the bottle, a red door under a lit window, or a roofline against the night sky.
- Replace abstract anchors like "the overall mood", "the composition overall", "the story", or "the emotional tone" with a single locatable passage the user could point to.
- Do NOT use flattering anchor labels such as "the arrangement of flowers", "the cozy house", "the vibrant garden", "the idyllic setting", or "the narrative journey of the path". Name the visible object pair or junction instead.
- Do NOT use object-summary anchors like "the beauty of the bottle", "the elegance of the object", "the festive house", "the decorated house", or "the holiday mood". Name the visible carrier passage instead.
- Do NOT use house-scene summaries like "the welcoming house", "the festive mood", "the holiday atmosphere", or "the warmth inside". Name the door/window/roofline carrier passage instead.
- For weak landscapes or garden scenes, prefer anchors shaped like "the path bend under the red house", "the roof edge against the blue wash", "the flower patch where it meets the path edge", or "the fence post against the foliage".
- For cafe or street scenes, prefer anchors shaped like "the cafe tables with yellow umbrellas", "the seated figures under the yellow umbrellas", "the path narrowing into the cafe tables", or "the nearest building arch behind the cafe tables".
- For figure-led scenes, prefer anchors shaped like "the chair back beside the sitter", "the shoulder edge against the pillow", "the head against the dark wall", or "the forearm across the white sheet".
- For train-led scenes, prefer anchors shaped like "the engine against the pale sky", "the train across the ground bands", "the smoke trail above the roofline", or "the leaning telegraph poles beside the train".${unsupportedAnchorCriteria.length > 0
    ? `

Critical anchor-support fix for ${unsupportedAnchorCriteria.join(', ')}:
- For each listed criterion, at least one visibleEvidence line MUST repeat the same concrete nouns from the anchor and then describe what is visibly happening in that exact passage.
- Make the FIRST visibleEvidence line for each listed criterion that anchor-echo support line.
- Nearby passages do NOT count as support just because they share scene tokens; the same line must restate the anchor passage and describe one visible event there.
- Do not anchor to one relationship and then list only nearby but differently named passages.
- If the anchor names a grouping, overlap, scaffold, gap, band, or junction, one visibleEvidence line must name that same grouping, overlap, scaffold, gap, band, or junction again using the same objects or zones.
- For weak landscape anchors, repeat BOTH sides of the relationship in one evidence line. Example: if the anchor is "the purple flower patch where it meets the path edge", one visibleEvidence line must mention both the purple flower patch and the path edge again in the same sentence.${unsupportedAnchorPreviewBlock}`
    : ''}${genericEvidenceCriteria.length > 0
    ? `

Critical generic-language fix for ${genericEvidenceCriteria.join(', ')}:
- For Intent and necessity or Presence, point of view, and human force, do NOT use phrases like "narrative journey", "inviting atmosphere", "idyllic setting", "warmth", "life and activity", or "sense of story" unless the same sentence also names the exact visible carrier relationship that creates that read.
- For any listed conceptual criterion, make the FIRST visibleEvidence line an anchor-echo support line. Restate the same anchored passage there and describe one visible event in that same sentence.
- For conceptual visibleEvidence lines, naming the anchor is NOT enough. The sentence must also describe a visible event in that passage: what narrows, bends, meets, overlaps, sits below, stays lighter/darker, or separates against what.
- Rewrite interpretation-first sentences like "the path leading to the house creates a directional flow", "the house draws attention", or "the red door under the lit window creates a welcoming mood" into event-first sentences that say what is visibly happening where.
- Rewrite focal-summary lines like "the vibrant bouquet against the stylized leaf background creates a strong focal point" into event-first lines such as "the vibrant bouquet against the stylized leaf background stays lighter than the leaf shapes behind it and bunches tighter above the vase rim."
- Route carriers like "the path leading to the house" are acceptable only if the evidence then names what that path is visibly doing: where it narrows, bends, meets the doorway, or separates against nearby shapes.
- Do NOT write "the outdoor seating area", "the cafe atmosphere", or "the path leading through the scene" as sufficient conceptual evidence on a cafe or street scene. Prefer "the cafe tables with yellow umbrellas", "the seated figures under the yellow umbrellas", or "the nearest building arch behind the cafe tables."
- Do NOT write figure summaries like "the pose creates emotion", "the figure has personality", "the sitter feels contemplative", or "the posture adds drama" as sufficient conceptual evidence. Prefer "the shoulder edge against the pillow", "the head against the dark wall", or "the forearm across the white sheet."
- Do NOT write train summaries like "the train creates movement", "the scene has momentum", "the engine feels dramatic", or "the poles add speed" as sufficient conceptual evidence. Prefer "the engine against the pale sky", "the train across the ground bands", "the smoke trail above the roofline", or "the leaning telegraph poles beside the train."
- Do NOT write object-study summaries like "the bottle feels elegant", "the object blends nature and technology", "the house feels festive", or "the windows create warmth" as sufficient conceptual evidence. Prefer "the floral label on the glass bottle", "the pump head against the bottle neck", "the red door under the lit window", or "the lit window against the dark facade."
- Do NOT write house-scene summaries like "the house feels welcoming", "the festive mood reads clearly", "the holiday atmosphere comes through", or "the windows create warmth" as sufficient conceptual evidence or strengthRead language. Prefer "the red door under the lit window", "the lit window against the dark facade", or "the roofline above the window stack."
- strengthRead and preserve must also name that same visible carrier passage, not a mood summary. If the criterion is conceptual, reuse the anchor nouns directly in strengthRead and preserve.
- strengthRead may interpret the result of the passage, but visibleEvidence must stay at event level first. Do not use visibleEvidence lines that only report the takeaway.
- For Composition and shape structure, do NOT use stock phrases like "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact path bend, roof edge, fence post, flower band, or other structural passage creating that effect.
- For Composition and shape structure in cafe or street scenes, replace summaries like "the path guides the eye", "the tables create rhythm", or "the umbrellas create a focal point" with event language such as "the path narrowing into the cafe tables leaves a wider ground shape on one side" or "the nearest building arch lands behind the tables and repeats their curve higher up the wall."
- For Composition and shape structure in figure-led or train-led scenes, replace summaries like "the pose adds drama", "the figure creates presence", "the train creates movement", or "the poles create rhythm" with event language such as "the chair slat leaves a smaller gap above the shoulder than at the elbow" or "the engine cuts across the ground bands while the nearest pole leans with that same diagonal."
- For Composition and shape structure, write a shape event, not a verdict: what narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, or tilts in that exact passage.
- For Composition and shape structure on object studies or architecture, do NOT stop at verdicts like "the bottle is centered", "the house is well-balanced", or "the roof creates structure". Write the visible event instead: what aligns, tilts, lands, repeats, leaves a wider side, or steps against a neighboring passage.
- On seascapes, harbors, or other strong paintings, the same rule still applies: prefer "the reflection cuts through the harbor bands", "the boat silhouette sits left of the reflection", or "the masts echo that vertical above the horizon" over verdicts like "the reflection organizes the composition" or "the boat creates balance."
- If one visibleEvidence line is already concrete, keep it and rewrite the generic filler lines so the full list stays at junction/event level.
- Rewrite the quoted lines below instead of paraphrasing the same generic idea again.${genericEvidencePreviewBlock}
${weakWorkCompositionExamples}`
    : ''}${topLevelToneFailure
    ? `

Critical top-level tone fix:
- intentHypothesis, strongestVisibleQualities, and comparisonObservations must stay provisional and evidence-led for weak work.
- Do NOT open with "whimsical charm", "idyllic rural life", "lively atmosphere", or artist praise like "Monet's garden scenes" unless the criterion evidence already proves unusually strong control.
- Describe what is visibly happening in plain terms before making any flattering style comparison.
- Safe rewrite pattern for weak work:
  - intentHypothesis = "The painting appears to organize the scene around [visible things]."
  - strongestVisibleQualities = plain statements about path / house / flower band / sky wash / edge contrast, not mood praise.
  - comparisonObservations = omit artist-name praise unless the criterion evidence clearly shows exceptional control.
${weakWorkExamples}`
    : ''}${surfaceAnchorFailure
    ? `

Critical repair for Surface and medium handling:
- Do NOT use anchors like "brushwork", "paint handling", "surface quality", or any painting-wide surface label.
- Choose one locatable mark-bearing passage instead, such as a hatch field against a smoother shirt passage, a loaded highlight stroke against a darker rim, or a dry scumble crossing a shadow.
- At least one visibleEvidence line for Surface and medium handling must repeat the same concrete nouns from that anchor and then describe the mark behavior visible there.`
    : ''}${repeatedGenericCompositionCriteria.length > 0 || repeatedConceptualCriteria.length > 0
    ? `

Escalation for repeated failure:
- One or more criteria have already failed more than once. Do NOT paraphrase the same anchor or sentence stems again.
- Replace the ENTIRE criterion block for any repeated failure: choose a new anchor, rewrite all visibleEvidence lines, and rewrite strengthRead/preserve so they reuse the new anchor nouns directly.
- If ${repeatedGenericCompositionCriteria.length > 0 ? repeatedGenericCompositionCriteria.join(', ') : 'Composition and shape structure'} has failed more than once, at least TWO visibleEvidence lines for that criterion must describe a structural event with verbs like "narrows", "widens", "cuts", "leaves a gap", "stacks", "overlaps", "aligns", or "tilts".
- If ${repeatedConceptualCriteria.length > 0 ? repeatedConceptualCriteria.join(', ') : 'a conceptual criterion'} has failed more than once, rewrite it as a more pointable visible carrier. Good forms include "[object] against [object]", "[object] beside [object]", "[object] across [object]", "[object] under [object]", "[object] where it meets [object]", or "[path] leading to [object]" when the evidence then describes the visible path behavior concretely.
- Do NOT reuse pure theme labels like "movement", "presence", "power", "energy", "atmosphere", "mood", or "dominant presence" as the whole anchor for a repeated conceptual failure.
- For repeated conceptual generic-evidence failures, replace every interpretation-first visibleEvidence line with a sentence that names the carrier passage and one visible event in it.
- If the previous anchor was generic, replacing one adjective is NOT enough. Replace the carrier passage itself.${repeatedFailurePreviewBlock}`
    : ''}`;
}

async function runCritiqueEvidenceStageWithRetries(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
    observationBank: ObservationBank;
  }
): Promise<EvidenceStageRunResult> {
  let repairNote: string | undefined;
  let lastError: unknown;
  const attemptDebug: CritiqueDebugInfo[] = [];

  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
    try {
      const evidence = await runCritiqueEvidenceStage(apiKey, {
        attempt,
        ...args,
        repairNote,
        allowLenientValidation: attempt === MAX_STAGE_ATTEMPTS,
      });
      return {
        evidence,
        observationBank: args.observationBank,
        failedAttempts: attemptDebug,
        successAttempt: attempt,
      };
    } catch (error) {
      lastError = error;
      const debug =
        error instanceof CritiqueValidationError && error.debug?.attempts?.[0]
          ? error.debug.attempts[0]
          : buildEvidenceAttemptDebugInfo({
              attempt,
              error,
              repairNote,
            });
      attemptDebug.push(debug);
      logEvidenceAttemptFailure({ attempt, repairNote }, error);
      if (attempt === MAX_STAGE_ATTEMPTS) {
        throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', attempt, {
          stage: 'evidence',
          details: errorDetails(error),
          debug: { attempts: attemptDebug },
          cause: error,
        });
      }
      repairNote = buildEvidenceRepairNote(error, attemptDebug);
    }
  }

  throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', MAX_STAGE_ATTEMPTS, {
    stage: 'evidence',
    details: errorDetails(lastError),
    debug: { attempts: attemptDebug },
    cause: lastError,
  });
}

export async function runOpenAICritique(
  apiKey: string,
  body: CritiqueRequestBody,
  options?: { model?: string }
): Promise<CritiqueResultDTO> {
  const stageModels = getOpenAIStageModelMap({
    evidence: options?.model,
    calibration: options?.model,
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
      ? ` The artist has not supplied a title. You must still output suggestedPaintingTitles: exactly three categorized title objects. One "formalist" (from Composition, Value, Color, Drawing criteria—name the dominant structural element), one "tactile" (from Style, Medium, Surface, Edge criteria—name the physical execution), one "intent" (from Intent and Presence criteria—name the mood/psychology). Each { category, title, rationale }. Title Case, no quotes, no cliché. Rationale: 1–2 sentences explaining how the specific criterion data generated this title.`
      : '';

  const userContent: VisionUserMessagePart[] = [
    {
      type: 'text',
      text: `Analyze this painting for studio use. Style: ${body.style}. Medium: ${body.medium}.${titleLine}${titleSuggestionLine}

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

  const observationBank = await instrumenter.time('observation', () =>
    runCritiqueObservationStage(apiKey, {
      model: stageModels.evidence,
      style: body.style,
      medium: body.medium,
      userContent,
    })
  );

  const evidenceRun = await instrumenter.time('evidence', () =>
    runCritiqueEvidenceStageWithRetries(apiKey, {
      model: stageModels.evidence,
      style: body.style,
      medium: body.medium,
      userContent,
      observationBank,
    })
  );
  const evidence = evidenceRun.evidence;

  let guarded: CritiqueResultDTO;
  let fallbackCause: CritiquePipelineError | undefined;
  try {
    const calibration = await instrumenter.time('calibration', async () => {
      try {
        return await runCritiqueCalibrationStage(
          apiKey,
          stageModels.calibration,
          body.style,
          body.medium,
          evidence,
          userContent
        );
      } catch (error) {
        if (error instanceof CritiquePipelineError) throw error;
        throw new CritiqueValidationError('Calibration stage failed.', {
          stage: 'calibration',
          details: errorDetails(error),
          cause: error,
        });
      }
    });

    const base = await runCritiqueWritingStage(
      apiKey,
      {
        voiceA: stageModels.voiceA,
        voiceB: stageModels.voiceB,
        validation: stageModels.validation,
      },
      body.style,
      body,
      evidence,
      observationBank,
      calibration,
      instrumenter
    );
    const calibrated = applyCalibrationToCritique(base, calibration);
    const withCompletion = {
      ...calibrated,
      completionRead: {
        state: evidence.completionRead.state,
        confidence: evidence.completionRead.confidence,
        cues: evidence.completionRead.cues,
        rationale: evidence.completionRead.rationale,
      },
    };

    guarded = applyCritiqueGuardrails(withCompletion, instrumenter);

    if (critiqueNeedsFreshEvidenceRead(guarded)) {
      if (instrumenter.enabled) {
        logGroundingGateFailure(guarded);
      }
      throw new CritiqueGroundingError('Critique drifted from its evidence anchors after generation.', {
        stage: 'final',
        details: [
          'The final critique no longer stayed aligned to the anchored evidence passages.',
          'A fresh retry would risk degrading silently, so the pipeline failed closed.',
        ],
      });
    }

    try {
      assertCritiqueQualityGate(guarded);
    } catch (error) {
      if (instrumenter.enabled && error instanceof CritiqueRuntimeEvalError) {
        logQualityGateFailure(guarded);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof CritiquePipelineError && error.stage !== 'evidence') {
      fallbackCause = error;
      guarded = composeFallbackCritique({
        style: body.style,
        medium: body.medium,
        evidence,
        paintingTitle: trimmedUserTitle || undefined,
        failureStage: error.stage,
      });
    } else {
      throw error;
    }
  }
  instrumenter.logSummary({
    models: {
      evidence: stageModels.evidence,
      calibration: stageModels.calibration,
      voiceA: stageModels.voiceA,
      voiceB: stageModels.voiceB,
      validation: stageModels.validation,
    },
  });

  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  const existingPipeline = guarded.pipeline;
  const fallbackFailureStage = fallbackCause ? stageIdFromErrorStage(fallbackCause.stage) : undefined;
  const stageOrder: CritiquePipelineStageId[] = ['calibration', 'voice_a', 'voice_b', 'validation'];
  const failureOrderIndex =
    fallbackFailureStage ? stageOrder.indexOf(fallbackFailureStage) : -1;
  const withStages = {
    evidence: createSucceededStageSnapshot({
      stage: 'evidence',
      model: stageModels.evidence,
      failedAttempts: evidenceRun.failedAttempts,
      successAttempt: evidenceRun.successAttempt,
    }),
    ...Object.fromEntries(
      stageOrder.map((stageId, index) => {
        const model =
          stageId === 'calibration'
            ? stageModels.calibration
            : stageId === 'voice_a'
              ? stageModels.voiceA
              : stageId === 'voice_b'
                ? stageModels.voiceB
                : stageModels.validation;

        if (!fallbackCause) {
          return [stageId, createSucceededStageSnapshot({ stage: stageId, model })];
        }

        if (index < failureOrderIndex) {
          return [stageId, createSucceededStageSnapshot({ stage: stageId, model })];
        }

        if (index === failureOrderIndex) {
          return [stageId, createFailedStageSnapshot({ error: fallbackCause, model })];
        }

        return [stageId, createSkippedStageSnapshot({ stage: stageId, model })];
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
      resultTier: existingPipeline?.resultTier ?? 'full',
      completedWithFallback: existingPipeline?.completedWithFallback ?? false,
      stages: withStages,
    }),
  };
  return trimmedTitle ? { ...withPipeline, paintingTitle: trimmedTitle } : withPipeline;
}
