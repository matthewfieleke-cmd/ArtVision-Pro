import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import { runCritiqueCalibrationStage } from './critiqueCalibrationStage.js';
import { applyCalibrationToCritique } from './critiqueCalibrationStage.js';
import {
  buildEvidenceStagePrompt,
  buildObservationStagePrompt,
  buildVisionStagePrompt,
} from './critiqueEvidenceStage.js';
import {
  buildHighDetailImageMessage,
  type VisionUserMessagePart,
} from './openaiVisionContent.js';
import {
  EVIDENCE_OPENAI_SCHEMA,
  OBSERVATION_BANK_OPENAI_SCHEMA,
  VISION_STAGE_OPENAI_SCHEMA,
  observationBankSchema,
  type ObservationBank,
} from './critiqueZodSchemas.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';
import { CRITERIA_ORDER } from '../shared/criteria.js';
import {
  validateEvidenceResult,
  synthesizeEvidenceFromObservationBankValidated,
  validateCritiqueGrounding,
} from './critiqueValidation.js';
import { refineCritiqueAnchorRegionsFromImage } from './critiqueAnchorRegionRefine.js';
import {
  extractFailingCriteriaFromCritiqueError,
  refreshCritiqueSummaryFromCategories,
  repairCritiqueVoiceBFromEvidence,
  runCritiqueWritingStage,
} from './critiqueWritingStage.js';
import {
  parseObservationBankLenient,
  sortObservationBankIntentCarriers,
  validateObservationBankGrounding,
} from './critiqueObservationBankValidate.js';
import {
  CritiqueGroundingError,
  CritiquePipelineError,
  CritiqueRetryExhaustedError,
  CritiqueRuntimeEvalError,
  CritiqueUninterpretableImageError,
  CritiqueValidationError,
  type CritiqueCriterionEvidencePreview,
  type CritiqueDebugPayload,
  type CritiqueDebugInfo,
  errorDetails,
  errorMessage,
} from './critiqueErrors.js';
import { evaluateCritiqueQuality } from './critiqueEval.js';
import {
  createCritiqueInstrumenter,
  critiqueInstrumentEnabled,
  noopCritiqueInstrumenter,
} from './critiqueInstrumentation.js';
import { buildOpenAIMaxTokensParam, getOpenAIStageModelMap } from './openaiModels.js';
import { createPipelineMetadata, createSucceededStageSnapshot } from './critiquePipeline.js';
import type {
  CritiquePipelineSalvagedCriterion,
  CritiquePipelineStageId,
} from '../shared/critiqueContract.js';
import {
  clarityPassEligible,
  isClarityPassEnabled,
  runClarityPass,
} from './critiqueClarityPass.js';
import { withOpenAIRetries } from './openaiRetry.js';
import { composeFallbackCritique } from './critiqueFallback.js';

const EVIDENCE_MAX_TOKENS = 3600;
const OBSERVATION_MAX_TOKENS = 2600;
/**
 * Merge A + Merge C: the unified vision call holds the full observation bank,
 * the full evidence object, AND the eight per-criterion anchor regions in
 * one response. The budget is the sum of the two stage budgets plus a small
 * headroom margin for JSON wrapping and the compact regions array. The
 * reasoning-model multiplier in `buildOpenAIMaxTokensParam` still applies on
 * top of this for gpt-5 / o-series so they get enough room for invisible
 * reasoning tokens.
 */
const VISION_MAX_TOKENS = 7200;

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

export function createObservationRetryExhaustedError(
  error: unknown,
  attemptDebug: CritiqueDebugInfo[]
): CritiqueRetryExhaustedError {
  return new CritiqueRetryExhaustedError('Observation stage exhausted retries.', MAX_OBSERVATION_ATTEMPTS, {
    stage: 'evidence',
    details: errorDetails(error),
    cause: error,
    ...(attemptDebug.length > 0 ? { debug: { attempts: attemptDebug } } : {}),
  });
}

export async function runBestEffortCritiqueStage<T>(
  stageLabel: string,
  run: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.warn(`[critique ${stageLabel} warning]`, {
      error: errorMessage(error),
      details: errorDetails(error),
    });
    return fallback;
  }
}

export type CritiqueRecoveryDisposition = 'recoverable' | 'safe_mode' | 'fatal';

export function classifyCoreCritiqueRecovery(error: unknown): {
  disposition: CritiqueRecoveryDisposition;
  failureStage: 'evidence' | 'voice_a' | 'voice_b' | 'final';
  reason: string;
} {
  if (error instanceof CritiqueUninterpretableImageError) {
    return {
      disposition: 'fatal',
      failureStage: 'evidence',
      reason: 'the photo could not be interpreted with enough confidence for a grounded critique',
    };
  }
  if (error instanceof CritiqueValidationError || error instanceof CritiqueGroundingError) {
    const failingCriteria = extractFailingCriteriaFromCritiqueError(error);
    return {
      disposition:
        failingCriteria.length > 0 && failingCriteria.length < CRITERIA_ORDER.length
          ? 'recoverable'
          : 'safe_mode',
      failureStage:
        error.stage === 'evidence'
          ? 'evidence'
          : error.stage === 'voice_a'
            ? 'voice_a'
            : error.stage === 'voice_b' || error.stage === 'voice_b_summary'
              ? 'voice_b'
              : 'final',
      reason: errorMessage(error),
    };
  }
  if (error instanceof CritiqueRuntimeEvalError) {
    return {
      disposition: 'recoverable',
      failureStage: 'final',
      reason: errorMessage(error),
    };
  }
  if (error instanceof CritiqueRetryExhaustedError || error instanceof CritiquePipelineError) {
    return {
      disposition: 'safe_mode',
      failureStage:
        error.stage === 'evidence'
          ? 'evidence'
          : error.stage === 'voice_a'
            ? 'voice_a'
            : error.stage === 'voice_b' || error.stage === 'voice_b_summary'
              ? 'voice_b'
              : 'final',
      reason: errorMessage(error),
    };
  }
  return {
    disposition: 'safe_mode',
    failureStage: 'final',
    reason: errorMessage(error),
  };
}

function replaceCritiqueCategoriesFromSafeMode(args: {
  critique: CritiqueResultDTO;
  safeModeCritique: CritiqueResultDTO;
  evidence: ReturnType<typeof validateEvidenceResult>;
  criteria: readonly (typeof CRITERIA_ORDER)[number][];
  reason: string;
}): {
  critique: CritiqueResultDTO;
  salvagedCriteria: CritiquePipelineSalvagedCriterion[];
} | null {
  if (args.criteria.length === 0 || args.criteria.length >= CRITERIA_ORDER.length) {
    return null;
  }
  const replacementByCriterion = new Map(
    args.safeModeCritique.categories.map((category) => [category.criterion, category] as const)
  );
  const replaced = {
    ...args.critique,
    categories: args.critique.categories.map((category) =>
      args.criteria.includes(category.criterion)
        ? (replacementByCriterion.get(category.criterion) ?? category)
        : category
    ),
  };
  try {
    const refreshed = refreshCritiqueSummaryFromCategories(replaced, args.evidence);
    const grounded = validateCritiqueGrounding(refreshed, args.evidence);
    return {
      critique: grounded,
      salvagedCriteria: args.criteria.map((criterion) => ({
        stage: 'validation',
        criterion,
        reason: args.reason,
      })),
    };
  } catch {
    return null;
  }
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
  /** Stage-1 evidence failed validation after retries; criterion rows were synthesized only from the image observation bank (no fictional template). */
  recoveredWithObservationSynthesizedEvidence?: boolean;
};

const MAX_OBSERVATION_ATTEMPTS = 3;

function buildObservationRepairNote(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return `Previous observation attempt failed: ${msg}

Regenerate the full observation bank JSON for THIS photograph only.

Fix checklist:
- passage labels must be pointable on the canvas (concrete thing vs thing / band vs field), not "overall mood", "the story", or "the composition overall".
- Each visibleFacts line must reuse nouns from its passage label and describe a visible event there.
- Each visibleEvents entry must copy passages[].label verbatim and describe a visible event with real signal language for its signalType.
- intentCarriers must reference existing passage ids and name physical carriers, not mood-only summaries.
- Spread passages across different areas; use stable ids p1, p2, … per schema.`;
}

export function parseObservationStageResult(raw: unknown): ObservationBank {
  const parsed = observationBankSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Observation stage validation failed: ${parsed.error.message}`);
  }
  return sortObservationBankIntentCarriers(validateObservationBankGrounding(parsed.data));
}

type ObservationStageRunMeta = {
  failedAttempts: CritiqueDebugInfo[];
  successAttempt: number;
  usedLenientObservationParse: boolean;
};

async function fetchObservationStageJson(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
    repairNote?: string;
  }
): Promise<unknown> {
  return withOpenAIRetries('observation', async () => {
    const userParts: VisionUserMessagePart[] = args.repairNote
      ? [
          ...args.userContent,
          {
            type: 'text',
            text: `Correction required on retry:\n${args.repairNote}`,
          },
        ]
      : args.userContent;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.1,
        ...buildOpenAIMaxTokensParam(args.model, OBSERVATION_MAX_TOKENS),
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
            content: userParts,
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

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Observation stage returned non-JSON');
    }
  });
}

async function runCritiqueObservationBankWithRetries(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<{ observationBank: ObservationBank } & ObservationStageRunMeta> {
  let repairNote: string | undefined;
  const attemptDebug: CritiqueDebugInfo[] = [];

  for (let attempt = 1; attempt <= MAX_OBSERVATION_ATTEMPTS; attempt++) {
    try {
      const raw = await fetchObservationStageJson(apiKey, { ...args, repairNote });
      try {
        const observationBank = parseObservationStageResult(raw);
        return {
          observationBank,
          failedAttempts: attemptDebug,
          successAttempt: attempt,
          usedLenientObservationParse: false,
        };
      } catch (parseError) {
        if (attempt === MAX_OBSERVATION_ATTEMPTS) {
          console.warn('[critique observation lenient parse — strict grounding failed]', {
            error: errorMessage(parseError),
            attempts: MAX_OBSERVATION_ATTEMPTS,
          });
          const observationBank = parseObservationBankLenient(raw);
          attemptDebug.push({
            attempt,
            error: errorMessage(parseError),
            details: errorDetails(parseError),
            repairNotePreview: repairNote?.slice(0, 1200),
          });
          return {
            observationBank,
            failedAttempts: attemptDebug,
            successAttempt: attempt,
            usedLenientObservationParse: true,
          };
        }
        const debug = buildEvidenceAttemptDebugInfo({
          attempt,
          error: parseError,
          repairNote,
          raw,
        });
        attemptDebug.push(debug);
        logEvidenceAttemptFailure({ attempt, repairNote }, parseError, raw);
        repairNote = buildObservationRepairNote(parseError);
      }
    } catch (error) {
      const debug = buildEvidenceAttemptDebugInfo({
        attempt,
        error,
        repairNote,
      });
      attemptDebug.push(debug);
      logEvidenceAttemptFailure({ attempt, repairNote }, error);
      if (attempt === MAX_OBSERVATION_ATTEMPTS) {
        throw createObservationRetryExhaustedError(error, attemptDebug);
      }
      repairNote = buildObservationRepairNote(error);
    }
  }

  throw new Error('Observation stage retry loop exited unexpectedly.');
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
  return withOpenAIRetries(`evidence-attempt-${args.attempt}`, async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.15,
        ...buildOpenAIMaxTokensParam(args.model, EVIDENCE_MAX_TOKENS),
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
          try {
            return validateEvidenceResult(raw, { mode: 'lenient', observationBank: args.observationBank });
          } catch {
            throw error;
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
  });
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
  const anchorSpreadFailure = details.some((detail) => /Evidence anchor spread:/.test(detail));
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
    : ''}${anchorSpreadFailure
    ? `

Critical observation-passage spread:
- observationPassageId must not be shared by more than three criteria. Remap extra criteria to other passages from the observation bank so anchors spread across the canvas.`
    : ''}`;
}

type VisionStageRunResult = EvidenceStageRunResult & {
  /** Stage-1 evidence half of the merged vision call failed validation after retries; criterion rows were synthesized only from the image observation bank (no fictional template). */
  recoveredWithObservationSynthesizedEvidence?: boolean;
  /** True iff the observation-bank half of the merged response had to fall through to the lenient parser. */
  usedLenientObservationParse: boolean;
  /**
   * Per-criterion anchor regions captured from the merged vision call
   * (Merge C). Undefined when the model did not return a usable
   * anchorRegions block (e.g. lenient/synthesized fallback path); the
   * orchestrator falls back to Voice B's own regions in that case.
   */
  anchorRegions?: Map<string, CriterionAnchorRegion>;
};

/**
 * Merge A: single OpenAI call that returns both the observation bank and the
 * evidence object. The function still produces the same internal shape that
 * the rest of the pipeline expects (observationBank + validated evidence), so
 * every downstream stage — calibration, voice A, voice B, validation,
 * grounding, clarity — works unchanged.
 *
 * Retry strategy mirrors the safety net of the previous two-stage pipeline:
 *   - Up to MAX_OBSERVATION_ATTEMPTS retries with combined repair notes.
 *   - On the final attempt, evidence validation runs in lenient mode.
 *   - If observation parse fails on the final attempt, fall through to
 *     `parseObservationBankLenient`.
 *   - If evidence validation still fails after all retries, synthesize
 *     evidence from the observation bank as the last-ditch safety net.
 *
 * The repair note for retries is the union of the observation repair note
 * (when the observation half is the failure) and the evidence repair note
 * (when the evidence half is the failure), so the model gets specific,
 * targeted corrections — not vague "try again" instructions.
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
  const attemptDebug: CritiqueDebugInfo[] = [];
  let repairNote: string | undefined;

  for (let attempt = 1; attempt <= MAX_OBSERVATION_ATTEMPTS; attempt++) {
    const isFinalAttempt = attempt === MAX_OBSERVATION_ATTEMPTS;
    let raw: unknown;
    try {
      raw = await withOpenAIRetries(`vision-attempt-${attempt}`, async () => {
        const userParts: VisionUserMessagePart[] = repairNote
          ? [
              ...args.userContent,
              {
                type: 'text',
                text: `Correction required on retry:\n${repairNote}`,
              },
            ]
          : args.userContent;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: args.model,
            temperature: 0.12,
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
                content: userParts,
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
        if (!text || typeof text !== 'string') throw new Error('Empty vision response');

        try {
          return JSON.parse(text);
        } catch {
          throw new Error('Vision stage returned non-JSON');
        }
      });
    } catch (transportError) {
      attemptDebug.push(
        buildEvidenceAttemptDebugInfo({ attempt, error: transportError, repairNote })
      );
      logEvidenceAttemptFailure({ attempt, repairNote }, transportError);
      if (isFinalAttempt) {
        throw createObservationRetryExhaustedError(transportError, attemptDebug);
      }
      repairNote = buildObservationRepairNote(transportError);
      continue;
    }

    const rawObservationBank =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>).observationBank : undefined;
    const rawEvidence =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>).evidence : undefined;
    if (!rawObservationBank || typeof rawObservationBank !== 'object' || !rawEvidence || typeof rawEvidence !== 'object') {
      const shapeError = new Error(
        'Vision response missing required top-level keys "observationBank" and/or "evidence".'
      );
      attemptDebug.push(
        buildEvidenceAttemptDebugInfo({ attempt, error: shapeError, repairNote, raw })
      );
      logEvidenceAttemptFailure({ attempt, repairNote }, shapeError, raw);
      if (isFinalAttempt) {
        throw createObservationRetryExhaustedError(shapeError, attemptDebug);
      }
      repairNote = buildObservationRepairNote(shapeError);
      continue;
    }

    let observationBank: ObservationBank;
    let usedLenientObservationParse = false;
    try {
      observationBank = parseObservationStageResult(rawObservationBank);
    } catch (observationError) {
      if (isFinalAttempt) {
        console.warn('[critique vision lenient observation parse — strict grounding failed]', {
          error: errorMessage(observationError),
          attempts: MAX_OBSERVATION_ATTEMPTS,
        });
        try {
          observationBank = parseObservationBankLenient(rawObservationBank);
          usedLenientObservationParse = true;
        } catch (lenientError) {
          attemptDebug.push(
            buildEvidenceAttemptDebugInfo({
              attempt,
              error: lenientError,
              repairNote,
              raw,
            })
          );
          throw createObservationRetryExhaustedError(lenientError, attemptDebug);
        }
      } else {
        attemptDebug.push(
          buildEvidenceAttemptDebugInfo({
            attempt,
            error: observationError,
            repairNote,
            raw,
          })
        );
        logEvidenceAttemptFailure({ attempt, repairNote }, observationError, raw);
        repairNote = buildObservationRepairNote(observationError);
        continue;
      }
    }

    try {
      const evidence = (() => {
        try {
          return validateEvidenceResult(rawEvidence, { observationBank });
        } catch (strictError) {
          if (isFinalAttempt) {
            try {
              return validateEvidenceResult(rawEvidence, {
                mode: 'lenient',
                observationBank,
              });
            } catch {
              throw strictError;
            }
          }
          throw strictError;
        }
      })();

      const anchorRegions = extractVisionAnchorRegions(raw);
      return {
        evidence,
        observationBank,
        failedAttempts: attemptDebug,
        successAttempt: attempt,
        usedLenientObservationParse,
        ...(anchorRegions ? { anchorRegions } : {}),
      };
    } catch (evidenceError) {
      attemptDebug.push(
        buildEvidenceAttemptDebugInfo({
          attempt,
          error: evidenceError,
          repairNote,
          raw: rawEvidence,
        })
      );
      logEvidenceAttemptFailure({ attempt, repairNote }, evidenceError, rawEvidence);
      if (isFinalAttempt) {
        console.warn('[critique vision evidence synthesized from observation bank]', {
          error: errorMessage(evidenceError),
          attempts: MAX_OBSERVATION_ATTEMPTS,
        });
        const evidence = synthesizeEvidenceFromObservationBankValidated(observationBank);
        const anchorRegions = extractVisionAnchorRegions(raw);
        return {
          evidence,
          observationBank,
          failedAttempts: attemptDebug,
          successAttempt: attempt,
          usedLenientObservationParse,
          recoveredWithObservationSynthesizedEvidence: true,
          ...(anchorRegions ? { anchorRegions } : {}),
        };
      }
      repairNote = buildEvidenceRepairNote(evidenceError, attemptDebug);
    }
  }

  throw new Error('Vision stage retry loop exited unexpectedly.');
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
        console.warn('[critique evidence synthesized from observation bank]', {
          error: errorMessage(error),
          attempts: MAX_STAGE_ATTEMPTS,
        });
        const evidence = synthesizeEvidenceFromObservationBankValidated(args.observationBank);
        return {
          evidence,
          observationBank: args.observationBank,
          failedAttempts: attemptDebug,
          successAttempt: attempt,
          recoveredWithObservationSynthesizedEvidence: true,
        };
      }
      repairNote = buildEvidenceRepairNote(error, attemptDebug);
    }
  }

  throw new Error('Evidence stage retry loop exited unexpectedly.');
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
   * Merge A: observation bank + evidence are produced by ONE OpenAI call.
   * The previous two-stage flow (`runCritiqueObservationBankWithRetries`
   * followed by `runCritiqueEvidenceStageWithRetries`) is kept exported for
   * targeted callers and tests, but the production critique pipeline now uses
   * the unified vision stage. Down-stream code reads `observationBank` and
   * `evidence` from this single result exactly as before.
   *
   * Instrumentation buckets remain `'observation'` and `'evidence'` so
   * existing dashboards keep working; the unified call is timed once under
   * `'observation'` and the `'evidence'` bucket records a zero-cost entry to
   * preserve the schema of the timing payload.
   */
  const visionRun = await instrumenter.time('observation', () =>
    runCritiqueVisionStage(apiKey, {
      model: stageModels.evidence,
      style: body.style,
      medium: body.medium,
      userContent,
    })
  );
  await instrumenter.time('evidence', async () => undefined);
  const observationBank = visionRun.observationBank;
  const usedLenientObservationParse = visionRun.usedLenientObservationParse;
  const evidence = visionRun.evidence;
  /**
   * Merge C: anchor regions captured by the unified vision call. Applied
   * after voice B + guardrails so the same image-locating boxes that the
   * model produced alongside the evidence anchors carry forward into the
   * final critique. When undefined (e.g. lenient/synthesized fallback),
   * downstream code keeps Voice B's own regions and the legacy late-stage
   * region refine still runs as a safety net.
   */
  const visionAnchorRegions = visionRun.anchorRegions;

  if (evidence.photoQualityRead.level === 'poor') {
    console.warn('[critique photo quality poor — continuing with full critique]', {
      summary: evidence.photoQualityRead.summary,
    });
  }

  const composeSafeModeCritiqueFor = (failureStage: 'evidence' | 'voice_a' | 'voice_b' | 'final') =>
    composeFallbackCritique({
      style: body.style,
      medium: body.medium,
      evidence,
      paintingTitle: trimmedUserTitle || undefined,
      failureStage,
    });

  let guarded: CritiqueResultDTO;
  const recoverySalvage: CritiquePipelineSalvagedCriterion[] = [];
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

  const base = await instrumenter.time('writing', async () => {
    try {
      return await runCritiqueWritingStage(
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
    } catch (error) {
      const policy = classifyCoreCritiqueRecovery(error);
      console.warn('[critique core recovery policy]', {
        disposition: policy.disposition,
        stage: policy.failureStage,
        reason: policy.reason,
      });
      if (policy.disposition === 'fatal') {
        throw error;
      }
      return composeSafeModeCritiqueFor(policy.failureStage);
    }
  });
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

  /**
   * Merge C: prefer the per-criterion regions produced by the unified vision
   * call. When the vision stage did not return regions for every criterion,
   * fall back to the legacy late-stage refine for any criteria that are
   * still missing a usable region. This preserves the previous behaviour as
   * a safety net for the lenient/synthesized fallback paths and for any
   * future criterion that the vision model declines to localise.
   */
  {
    const critiqueWithVisionRegions = applyVisionAnchorRegionsToCritique(
      guarded,
      visionAnchorRegions
    );
    const allCriteriaCovered = critiqueWithVisionRegions.categories.every(
      (category) => Boolean(category.anchor?.region) && visionAnchorRegions?.has(category.criterion)
    );
    if (allCriteriaCovered && visionAnchorRegions) {
      guarded = critiqueWithVisionRegions;
    } else {
      const critiqueBeforeAnchorRefine = critiqueWithVisionRegions;
      guarded = await instrumenter.time('anchor_region_refine', () =>
        runBestEffortCritiqueStage(
          'anchor_region_refine',
          () =>
            refineCritiqueAnchorRegionsFromImage({
              apiKey,
              model: stageModels.validation,
              imageDataUrl: body.imageDataUrl,
              critique: critiqueBeforeAnchorRefine,
            }),
          critiqueBeforeAnchorRefine
        )
      );
    }
  }

  if (isClarityPassEnabled() && clarityPassEligible(guarded)) {
    const critiqueBeforeClarity = guarded;
    const clarified = await instrumenter.time('clarity', () =>
      runBestEffortCritiqueStage(
        'clarity',
        () => runClarityPass(apiKey, stageModels.clarity, critiqueBeforeClarity),
        critiqueBeforeClarity
      )
    );
    guarded = critiqueNeedsFreshEvidenceRead(clarified) ? critiqueBeforeClarity : clarified;
  }

  try {
    guarded = validateCritiqueGrounding(guarded, evidence);
  } catch (error) {
    const policy = classifyCoreCritiqueRecovery(error);
    const safeModeCritique = composeSafeModeCritiqueFor(policy.failureStage);
    const failingCriteria = extractFailingCriteriaFromCritiqueError(error);
    const repaired =
      policy.disposition === 'recoverable'
        ? replaceCritiqueCategoriesFromSafeMode({
            critique: guarded,
            safeModeCritique,
            evidence,
            criteria: failingCriteria,
            reason: `repaired final category from conservative safe-mode evidence after ${policy.reason}`,
          })
        : null;
    if (repaired) {
      guarded = repaired.critique;
      recoverySalvage.push(...repaired.salvagedCriteria);
    } else if (policy.disposition === 'fatal') {
      throw error;
    } else {
      guarded = safeModeCritique;
    }
  }

  if (critiqueNeedsFreshEvidenceRead(guarded)) {
    if (instrumenter.enabled) {
      logGroundingGateFailure(guarded);
    }
    console.warn(
      '[critique] Grounding audit: some text may be weakly tied to evidence anchors; shipping critique.'
    );
  }

  let quality = evaluateCritiqueQuality(guarded);
  if (quality.blockingIssues.length > 0) {
    if (quality.genericNextSteps || quality.vagueVoiceB || quality.duplicatedCoaching) {
      const repairedVoiceB = repairCritiqueVoiceBFromEvidence(
        guarded,
        evidence,
        'repaired full Voice B from anchored evidence after quality gate failure'
      );
      const repairedCritique = validateCritiqueGrounding(repairedVoiceB.critique, evidence);
      const repairedQuality = evaluateCritiqueQuality(repairedCritique);
      if (repairedQuality.blockingIssues.length < quality.blockingIssues.length) {
        guarded = repairedCritique;
        quality = repairedQuality;
        recoverySalvage.push(...repairedVoiceB.salvagedCriteria);
      }
    }
  }

  if (quality.blockingIssues.length > 0) {
    if (instrumenter.enabled) {
      logQualityGateFailure(guarded);
    }
    console.warn('[critique quality recovery -> safe mode]', quality.blockingIssues.join(' | '));
    guarded = composeSafeModeCritiqueFor('final');
    quality = evaluateCritiqueQuality(guarded);
  }

  instrumenter.logSummary({
    models: {
      evidence: stageModels.evidence,
      calibration: stageModels.calibration,
      voiceA: stageModels.voiceA,
      voiceB: stageModels.voiceB,
      validation: stageModels.validation,
      clarity: stageModels.clarity,
    },
  });

  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  const existingPipeline = guarded.pipeline;
  const observationSalvaged: CritiquePipelineSalvagedCriterion[] = usedLenientObservationParse
    ? [
        {
          stage: 'evidence',
          criterion: 'Intent and necessity',
          reason:
            'Observation bank passed JSON schema but strict cross-field grounding checks failed after retries; passages remain the model’s read of the attached photograph (no fictional template grid).',
        },
      ]
    : [];
  const usedDegradedPath =
    usedLenientObservationParse ||
    Boolean(visionRun.recoveredWithObservationSynthesizedEvidence) ||
    Boolean(guarded.pipeline?.completedWithFallback) ||
    recoverySalvage.length > 0;
  const stageOrder: CritiquePipelineStageId[] = ['calibration', 'voice_a', 'voice_b', 'validation'];
  const withStages = {
    evidence: createSucceededStageSnapshot({
      stage: 'evidence',
      model: stageModels.evidence,
      failedAttempts: visionRun.failedAttempts,
      successAttempt: visionRun.successAttempt,
    }),
    ...Object.fromEntries(
      stageOrder.map((stageId) => {
        const model =
          stageId === 'calibration'
            ? stageModels.calibration
            : stageId === 'voice_a'
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
        ...observationSalvaged,
        ...(evidence.salvagedCriteria ?? []),
        ...recoverySalvage,
      ],
    }),
  };
  return trimmedTitle ? { ...withPipeline, paintingTitle: trimmedTitle } : withPipeline;
}
