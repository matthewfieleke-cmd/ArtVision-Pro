import {
  buildEvidenceStagePrompt,
  buildObservationStagePrompt,
  buildVisionStagePrompt,
} from './critiqueEvidenceStage.js';
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
 * one response. Trimmed from 7200 to 5000 after two production runs showed
 * gpt-5.4 expanding into ~110-120s of reasoning tokens regardless of how
 * much actual output it needed. A tighter cap pushes the model to finish
 * sooner while still leaving headroom above the observed visible-output
 * token count (~2800-3400). The reasoning-model multiplier in
 * `buildOpenAIMaxTokensParam` still applies on top of this for gpt-5 /
 * o-series so invisible reasoning tokens aren't starved.
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

/**
 * Merged vision stage retry budget. The new 3-stage pipeline runs in a single
 * pass with zero semantic retries — one attempt at vision, one at each of
 * the 8 parallel criteria, one at synthesis. If the single vision attempt
 * fails validation, the existing lenient-mode + synthesized-from-observation
 * fallbacks still kick in so the critique completes with a minimal-safe
 * result.
 */
const MAX_OBSERVATION_ATTEMPTS = 1;

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
          /**
           * Lenient mode is explicitly designed to auto-repair a small set of
           * conceptual prose-quality failures (`strengthRead is too generic`,
           * `preserve is too generic`) by substituting a known-safe anchor or
           * visibleEvidence line. Rather than burning a full vision-call
           * retry (~80-100s with gpt-5.4) on a minor prose nit that the
           * lenient validator can fix in-process, we try lenient
           * immediately when the strict failure matches the auto-repair set.
           * All other strict failures (structural drift, unsupported
           * anchors, unresolved conceptual carriers, etc.) still fall
           * through to the normal retry so quality gates stay intact.
           */
          const strictMessage = errorMessage(strictError);
          const isLenientAutoRepairable =
            /(?:strengthRead|preserve) is too generic for /.test(strictMessage);
          if (isLenientAutoRepairable || isFinalAttempt) {
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
  const observationBank = visionRun.observationBank;
  const usedLenientObservationParse = visionRun.usedLenientObservationParse;
  const evidence = visionRun.evidence;
  console.log(
    `[critique vision path] merged vision call complete in ${(visionElapsedMs / 1000).toFixed(1)}s (model=${stageModels.evidence}, anchor regions: ${
      visionRun.anchorRegions ? `${visionRun.anchorRegions.size}/8 from vision` : 'none — will use late-stage refine'
    }${
      visionRun.recoveredWithObservationSynthesizedEvidence
        ? ', synthesized evidence fallback used'
        : ''
    }${usedLenientObservationParse ? ', lenient observation parse used' : ''})`
  );
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
  const stageOrder: CritiquePipelineStageId[] = ['voice_a', 'voice_b', 'validation'];
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
        ...observationSalvaged,
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
