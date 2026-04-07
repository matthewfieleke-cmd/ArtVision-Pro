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
import {
  synthesizeEvidenceFromObservationBank,
  validateEvidenceResult,
} from './critiqueValidation.js';
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
import {
  hasSpecificConceptualCarrierAnchor,
} from './critiqueWeakWorkContracts.js';
import { getOpenAIStageModelMap } from './openaiModels.js';
import {
  findPrimaryAnchorSupportLine,
  hasVisibleEventLanguage,
  isConcreteAnchor,
  sharesConcreteLanguage,
} from './critiqueGrounding.js';
import { normalizeWhitespace } from './critiqueTextRules.js';
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
const OBSERVATION_SIGNAL_PATTERNS: Record<ObservationBank['visibleEvents'][number]['signalType'], RegExp> = {
  shape:
    /\b(shape|shapes|silhouette|silhouettes|contour|contours|band|bands|mass|masses|block|blocks|vertical|horizontal|diagonal|curve|curves|angle|angles|gap|gaps|interval|intervals|overlap|overlaps|tilt|tilts?|lean|leans?|cut|cuts?|cross|crosses?|stack|stacks?|frame|frames?)\b/i,
  value:
    /\b(light|lights|dark|darks|bright|dim|pale|shadow|shadows|highlight|highlights|midtone|midtones|contrast|contrasts?|lighter|darker)\b/i,
  color:
    /\b(color|colour|colors|colours|hue|hues|chroma|saturation|temperature|warm|warmer|cool|cooler|red|orange|yellow|green|blue|violet|purple|gray|grey|brown)\b/i,
  edge:
    /\b(edge|edges|boundary|boundaries|contour|contours|soft|softer|hard|harder|sharp|sharper|crisp|blur|blurred|feathered|lost|found)\b/i,
  space:
    /\b(space|spatial|depth|plane|planes|foreground|background|behind|below|above|in front of|near|far|distance|recede|recedes?|advance|advances?|overlap|overlaps?|stack|stacks?)\b/i,
  surface:
    /\b(surface|texture|textures|textured|smooth|rough|grain|drag|scumble|hatch|hatching|wash|washes|stroke|strokes|brushwork|opaque|transparent|dry|wet|thick|thin)\b/i,
};
const OBSERVATION_GENERIC_EVENT_PATTERN =
  /\b(importance|important|mood|story|narrative|atmosphere|energy|presence|force|emotion|feeling|vibe|overall effect)\b/i;
const OBSERVATION_RELATION_CUE_PATTERN =
  /\b(against|between|where|meets?|under|over|above|below|behind|beside|across|through|toward|around|near|inside|outside|within)\b/i;

function normalizeObservationText(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
}

function observationEventHasSignalLanguage(
  event: ObservationBank['visibleEvents'][number]
): boolean {
  const text = event.event;
  if (hasVisibleEventLanguage(text)) return true;
  if (OBSERVATION_SIGNAL_PATTERNS[event.signalType].test(text)) return true;
  if (OBSERVATION_RELATION_CUE_PATTERN.test(text) && !OBSERVATION_GENERIC_EVENT_PATTERN.test(text)) return true;
  return false;
}

function validateObservationBankGrounding(observationBank: ObservationBank): ObservationBank {
  const passagesById = new Map<string, ObservationBank['passages'][number]>();

  for (const passage of observationBank.passages) {
    if (passagesById.has(passage.id)) {
      throw new Error(`Observation stage validation failed: duplicate passage id ${passage.id}`);
    }
    if (!isConcreteAnchor(passage.label)) {
      throw new Error(`Observation stage validation failed: passage label is too soft (${passage.id})`);
    }
    if (
      !passage.visibleFacts.some((fact) => sharesConcreteLanguage(fact, passage.label, 2)) &&
      !passage.visibleFacts.some((fact) => sharesConcreteLanguage(fact, passage.label, 1))
    ) {
      throw new Error(`Observation stage validation failed: passage facts drifted from ${passage.id}`);
    }
    if (
      (passage.role === 'intent' || passage.role === 'presence') &&
      !hasSpecificConceptualCarrierAnchor(passage.label)
    ) {
      throw new Error(`Observation stage validation failed: conceptual passage is too soft (${passage.id})`);
    }
    passagesById.set(passage.id, passage);
  }

  for (const event of observationBank.visibleEvents) {
    const passage = passagesById.get(event.passageId);
    if (!passage) {
      throw new Error(`Observation stage validation failed: unknown passage id ${event.passageId} in visibleEvents`);
    }
    if (normalizeObservationText(event.passage) !== normalizeObservationText(passage.label)) {
      throw new Error(`Observation stage validation failed: visibleEvents passage label drifted for ${event.passageId}`);
    }
    if (!observationEventHasSignalLanguage(event)) {
      throw new Error(`Observation stage validation failed: visibleEvents entry lacks visual signal language for ${event.passageId}`);
    }
    if (!sharesConcreteLanguage(event.event, passage.label, 1)) {
      throw new Error(`Observation stage validation failed: visibleEvents entry drifted from ${event.passageId}`);
    }
  }

  for (const carrier of observationBank.intentCarriers) {
    const passage = passagesById.get(carrier.passageId);
    if (!passage) {
      throw new Error(`Observation stage validation failed: unknown passage id ${carrier.passageId} in intentCarriers`);
    }
    if (normalizeObservationText(carrier.passage) !== normalizeObservationText(passage.label)) {
      throw new Error(`Observation stage validation failed: intentCarriers passage label drifted for ${carrier.passageId}`);
    }
    if (!hasSpecificConceptualCarrierAnchor(carrier.passage)) {
      throw new Error(`Observation stage validation failed: intent carrier is too soft for ${carrier.passageId}`);
    }
  }

  return observationBank;
}

function isRecoverableObservationGroundingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /^Observation stage validation failed: /.test(message);
}

function summarizeRawForLog(raw: unknown): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) return '[unserializable raw payload]';
    return serialized.length > 4000 ? `${serialized.slice(0, 4000)}…[truncated]` : serialized;
  } catch {
    return '[unserializable raw payload]';
  }
}

function conceptualCarrierGuidance(observationBank: ObservationBank): string {
  const ranked = observationBank.intentCarriers
    .map((carrier) => {
      const passage = observationBank.passages.find((entry) => entry.id === carrier.passageId);
      if (!passage) return undefined;
      let score = 0;
      if (passage.role === 'intent' || passage.role === 'presence') score += 8;
      if (passage.role === 'value' || passage.role === 'edge' || passage.role === 'surface' || passage.role === 'color') {
        score += 4;
      }
      if (passage.role === 'structure') score -= 4;
      if (/\b(pressure|presence|force|vulnerability|isolation|withheld|address|tension|commitment)\b/i.test(carrier.reason)) {
        score += 4;
      }
      if (/\b(speed|movement|motion|energy|depth|distance|scale|balance|composition)\b/i.test(carrier.reason)) {
        score -= 3;
      }
      return {
        passage: carrier.passage,
        reason: carrier.reason,
        role: passage.role,
        score,
      };
    })
    .filter(
      (entry): entry is { passage: string; reason: string; role: ObservationBank['passages'][number]['role']; score: number } =>
        Boolean(entry)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (ranked.length === 0) return '';
  return `Preferred conceptual carriers from the observation bank (use these first for Intent and Presence if they genuinely fit):
${ranked
  .map(
    (entry, index) =>
      `${index + 1}. ${entry.passage} [role=${entry.role}] — ${entry.reason}`
  )
  .join('\n')}
- If a structure-heavy passage only proves speed, balance, distance, or movement, do not use it for Intent or Presence unless you explicitly show why the pressure stays there instead of in a more direct carrier.`;
}

function sortObservationBankIntentCarriers(observationBank: ObservationBank): ObservationBank {
  if (observationBank.intentCarriers.length < 2) return observationBank;
  const scoredCarriers = observationBank.intentCarriers
    .map((carrier, index) => {
      const passage = observationBank.passages.find((entry) => entry.id === carrier.passageId);
      if (!passage) return { carrier, index, score: -Infinity };
      let score = 0;
      if (passage.role === 'intent' || passage.role === 'presence') score += 8;
      if (passage.role === 'value' || passage.role === 'edge' || passage.role === 'surface' || passage.role === 'color') {
        score += 4;
      }
      if (passage.role === 'structure') score -= 4;
      if (/\b(pressure|presence|force|vulnerability|isolation|withheld|address|tension|commitment)\b/i.test(carrier.reason)) {
        score += 4;
      }
      if (/\b(speed|movement|motion|energy|depth|distance|scale|balance|composition|focal point)\b/i.test(carrier.reason)) {
        score -= 3;
      }
      return { carrier, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.carrier);
  return {
    ...observationBank,
    intentCarriers: scoredCarriers,
  };
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

export function parseObservationStageResult(raw: unknown): ObservationBank {
  const parsed = observationBankSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Observation stage validation failed: ${parsed.error.message}`);
  }
  try {
    return sortObservationBankIntentCarriers(validateObservationBankGrounding(parsed.data));
  } catch (error) {
    if (isRecoverableObservationGroundingError(error)) {
      console.warn('[critique observation grounding warning]', {
        error: errorMessage(error),
        details: errorDetails(error),
        rawPreview: summarizeRawForLog(parsed.data),
      });
      return sortObservationBankIntentCarriers(parsed.data);
    }
    throw error;
  }
}

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
  return parseObservationStageResult(raw);
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
  const conceptualCarrierText = conceptualCarrierGuidance(args.observationBank);
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
            ...(conceptualCarrierText
              ? [
                  {
                    type: 'text' as const,
                    text: conceptualCarrierText,
                  },
                ]
              : []),
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
      return validateEvidenceResult(raw, { observationBank: args.observationBank });
    } catch (error) {
      if (args.allowLenientValidation) {
        const message = error instanceof Error ? error.message : '';
        const canUseLenientFallback =
          /Evidence intentHypothesis is too flattering or style-biased for weak work|Evidence strongestVisibleQualities are too flattering or style-biased for weak work|Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for|Visible evidence does not support anchor for|Conceptual evidence anchor is too soft for|Observation passage id does not match anchor for|Invalid observation passage id for/.test(
            message
          );
        if (canUseLenientFallback) {
          return validateEvidenceResult(raw, { mode: 'lenient', observationBank: args.observationBank });
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
- For Intent and necessity or Presence, point of view, and human force, anchor to the visible carrier of that intent or force: one form against another form, one edge against a field, one band meeting another band, or one passage pressing into another.
- For conceptual criteria, the anchor does NOT need to use an approved noun list. It needs to be pointable in the painting and restated concretely in the visibleEvidence lines.
- For Intent and necessity or Presence, point of view, and human force, do NOT reuse a composition anchor unless the evidence explicitly shows why that same passage carries the intent, pressure, or human address rather than merely organizing the picture.
- Replace abstract anchors like "the overall mood", "the composition overall", "the story", or "the emotional tone" with a single locatable passage the user could point to.
- Do NOT use flattering or summary anchor labels such as "the inviting arrangement", "the dominant presence", "the dramatic scene", or "the narrative journey". Name the visible object pair or junction instead.${unsupportedAnchorCriteria.length > 0
    ? `

Critical anchor-support fix for ${unsupportedAnchorCriteria.join(', ')}:
- For each listed criterion, at least one visibleEvidence line MUST repeat the same concrete nouns from the anchor and then describe what is visibly happening in that exact passage.
- Make the FIRST visibleEvidence line for each listed criterion that anchor-echo support line.
- Nearby passages do NOT count as support just because they share scene tokens; the same line must restate the anchor passage and describe one visible event there.
- Do not anchor to one relationship and then list only nearby but differently named passages.
- If the anchor names a grouping, overlap, scaffold, gap, band, or junction, one visibleEvidence line must name that same grouping, overlap, scaffold, gap, band, or junction again using the same objects or zones.
- If the anchor names a relationship, repeat BOTH sides of the relationship in one evidence line. Example: if the anchor is "the lighter patch where it meets the darker band", one visibleEvidence line must mention both the lighter patch and the darker band again in the same sentence.${unsupportedAnchorPreviewBlock}`
    : ''}${genericEvidenceCriteria.length > 0
    ? `

Critical generic-language fix for ${genericEvidenceCriteria.join(', ')}:
- For Intent and necessity or Presence, point of view, and human force, do NOT use phrases like "narrative journey", "inviting atmosphere", "idyllic setting", "warmth", "life and activity", or "sense of story" unless the same sentence also names the exact visible carrier relationship that creates that read.
- For any listed conceptual criterion, make the FIRST visibleEvidence line an anchor-echo support line. Restate the same anchored passage there and describe one visible event in that same sentence.
- For conceptual visibleEvidence lines, naming the anchor is NOT enough. The sentence must also describe a visible event in that passage: what narrows, bends, meets, overlaps, sits below, stays lighter/darker, or separates against what.
- For conceptual criteria, at least one visibleEvidence line must explain why this exact passage carries the intent, pressure, or human force instead of a nearby structural passage. If the line only proves structure, it is still wrong for Intent or Presence.
- Rewrite interpretation-first sentences like "the passage creates a directional flow", "the shape draws attention", or "the warm area creates atmosphere" into event-first sentences that say what is visibly happening where.
- Rewrite focal-summary lines like "the brighter cluster against the darker field creates a strong focal point" into event-first lines such as "the brighter cluster against the darker field stays lighter than the shapes behind it and bunches tighter above the lower edge."
- Route carriers like "the band leading inward" are acceptable only if the evidence then names what that band is visibly doing: where it narrows, bends, meets another passage, or separates against nearby shapes.
- Do NOT write summary evidence like "the area creates mood", "the form has personality", "the scene has momentum", or "the passage adds warmth" as sufficient conceptual evidence.
- strengthRead and preserve must also name that same visible carrier passage, not a mood summary. If the criterion is conceptual, reuse the anchor nouns directly in strengthRead and preserve.
- strengthRead may interpret the result of the passage, but visibleEvidence must stay at event level first. Do not use visibleEvidence lines that only report the takeaway.
- For Composition and shape structure, do NOT use stock phrases like "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact passage creating that effect.
- For Composition and shape structure, write a shape event, not a verdict: what narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, or tilts in that exact passage.
- On abstract, simplified, or still-life passages, phrases like "layered structure", "adds complexity", "creates movement", "grounds the composition", or "provides a base" are still too generic unless the same sentence names the exact forms and the visible event between them.
- Replace wording like "the darker shape provides a structural base" with event wording such as "the lighter form overlaps the darker shape and leaves a thinner dark strip on one side than on the other."
- Replace wording like "the overlapping colors add movement and complexity" with event wording such as "the brighter shape overlaps the darker block and leaves a narrower strip at the top edge than at the side."
- For Composition and shape structure, do NOT stop at verdicts like "the object is centered", "the form is well-balanced", or "the edge creates structure". Write the visible event instead: what aligns, tilts, lands, repeats, leaves a wider side, or steps against a neighboring passage.
- If one visibleEvidence line is already concrete, keep it and rewrite the generic filler lines so the full list stays at junction/event level.
- Rewrite the quoted lines below instead of paraphrasing the same generic idea again.${genericEvidencePreviewBlock}`
    : ''}${topLevelToneFailure
    ? `

Critical top-level tone fix:
- intentHypothesis, strongestVisibleQualities, and comparisonObservations must stay provisional and evidence-led for weak work.
- Do NOT open with charm, atmosphere, narrative, or artist-praise language unless the criterion evidence already proves unusually strong control.
- Describe what is visibly happening in plain terms before making any flattering style comparison.
- Safe rewrite pattern for weak work:
  - intentHypothesis = "The painting appears to organize the scene around [visible things]."
  - strongestVisibleQualities = plain statements about visible bands / forms / edge contrast / value shifts, not mood praise.
  - comparisonObservations = omit artist-name praise unless the criterion evidence clearly shows exceptional control.`
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
- If a repeated conceptual failure keeps reusing the same composition carrier, replace it with the passage that actually holds the intent, pressure, or address. Do not keep the same diagonal, pole row, horizon, or overlap unless you can prove that it carries the conceptual read rather than only structure.
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
        const synthesizedEvidence = synthesizeEvidenceFromObservationBank(args.observationBank);
        return {
          evidence: synthesizedEvidence,
          observationBank: args.observationBank,
          failedAttempts: attemptDebug,
          successAttempt: attempt,
        };
      }
      repairNote = buildEvidenceRepairNote(error, attemptDebug);
    }
  }

  return {
    evidence: synthesizeEvidenceFromObservationBank(args.observationBank),
    observationBank: args.observationBank,
    failedAttempts: attemptDebug,
    successAttempt: MAX_STAGE_ATTEMPTS,
  };
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
        console.warn('[critique calibration warning]', {
          error: errorMessage(error),
          details: errorDetails(error),
        });
        return undefined;
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
    const calibrated = calibration ? applyCalibrationToCritique(base, calibration) : base;
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
      salvagedCriteria: [
        ...(existingPipeline?.salvagedCriteria ?? []),
        ...(evidence.salvagedCriteria ?? []),
      ],
    }),
  };
  return trimmedTitle ? { ...withPipeline, paintingTitle: trimmedTitle } : withPipeline;
}
