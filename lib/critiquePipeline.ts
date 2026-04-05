import type {
  CritiquePipelineMetadata,
  CritiquePipelineAttempt,
  CritiquePipelineCriterionEvidencePreview,
  CritiquePipelineStageId,
  CritiquePipelineStageSnapshot,
  CritiqueResultTier,
} from '../shared/critiqueContract.js';
import type {
  CritiqueCriterionEvidencePreview,
  CritiqueDebugInfo,
  CritiquePipelineError,
  CritiqueStageName,
} from './critiqueErrors.js';
import { CritiqueRetryExhaustedError } from './critiqueErrors.js';

export const CRITIQUE_PIPELINE_SCHEMA_VERSION = 1;
export const CRITIQUE_PIPELINE_VERSION = 'staged-openai-v1';

export function createPipelineMetadata(args?: {
  resultTier?: CritiqueResultTier;
  completedWithFallback?: boolean;
  stages?: Partial<Record<CritiquePipelineStageId, CritiquePipelineStageSnapshot>>;
}): CritiquePipelineMetadata {
  return {
    schemaVersion: CRITIQUE_PIPELINE_SCHEMA_VERSION,
    pipelineVersion: CRITIQUE_PIPELINE_VERSION,
    resultTier: args?.resultTier ?? 'full',
    completedWithFallback: args?.completedWithFallback ?? false,
    stages: args?.stages,
  };
}

function toCriterionEvidencePreview(
  preview: CritiqueCriterionEvidencePreview
): CritiquePipelineCriterionEvidencePreview {
  return {
    criterion: preview.criterion,
    ...(preview.anchor ? { anchor: preview.anchor } : {}),
    ...(preview.visibleEvidencePreview ? { visibleEvidencePreview: preview.visibleEvidencePreview } : {}),
  };
}

function toPipelineAttempt(args: {
  attempt: number;
  status: CritiquePipelineAttempt['status'];
  model?: string;
  debug?: CritiqueDebugInfo;
}): CritiquePipelineAttempt {
  return {
    attempt: args.attempt,
    status: args.status,
    ...(args.model ? { model: args.model } : {}),
    ...(args.debug?.error ? { error: args.debug.error } : {}),
    ...(args.debug?.details?.length ? { details: args.debug.details } : {}),
    ...(args.debug?.repairNotePreview ? { repairNotePreview: args.debug.repairNotePreview } : {}),
    ...(args.debug?.rawPreview ? { rawPreview: args.debug.rawPreview } : {}),
    ...(args.debug?.criterionEvidencePreview
      ? {
          criterionEvidencePreview: args.debug.criterionEvidencePreview.map(toCriterionEvidencePreview),
        }
      : {}),
  };
}

export function stageIdFromErrorStage(stage: CritiqueStageName): CritiquePipelineStageId {
  switch (stage) {
    case 'evidence':
      return 'evidence';
    case 'calibration':
      return 'calibration';
    case 'voice_a':
      return 'voice_a';
    case 'voice_b':
      return 'voice_b';
    case 'final':
    default:
      return 'validation';
  }
}

export function createStageAttempts(args: {
  model?: string;
  failedAttempts?: CritiqueDebugInfo[];
  successAttempt?: number;
}): CritiquePipelineAttempt[] | undefined {
  const failedAttempts = [...(args.failedAttempts ?? [])].sort((a, b) => a.attempt - b.attempt);
  const successAttempt = args.successAttempt;
  const shouldEmit =
    failedAttempts.length > 0 || (typeof successAttempt === 'number' && successAttempt > 1);
  if (!shouldEmit) return undefined;

  const attempts: CritiquePipelineAttempt[] = failedAttempts.map((attempt) =>
    toPipelineAttempt({
      attempt: attempt.attempt,
      status: 'failed',
      model: args.model,
      debug: attempt,
    })
  );

  if (typeof successAttempt === 'number') {
    attempts.push(
      toPipelineAttempt({
        attempt: successAttempt,
        status: 'succeeded',
        model: args.model,
      })
    );
  }

  return attempts.sort((a, b) => a.attempt - b.attempt);
}

export function createSucceededStageSnapshot(args: {
  stage: CritiquePipelineStageId;
  model?: string;
  promptVersion?: string;
  failedAttempts?: CritiqueDebugInfo[];
  successAttempt?: number;
}): CritiquePipelineStageSnapshot {
  return {
    stage: args.stage,
    status: 'succeeded',
    ...(args.model ? { model: args.model } : {}),
    ...(args.promptVersion ? { promptVersion: args.promptVersion } : {}),
    ...(createStageAttempts({
      model: args.model,
      failedAttempts: args.failedAttempts,
      successAttempt: args.successAttempt,
    })
      ? {
          attempts: createStageAttempts({
            model: args.model,
            failedAttempts: args.failedAttempts,
            successAttempt: args.successAttempt,
          }),
        }
      : {}),
  };
}

export function createSkippedStageSnapshot(args: {
  stage: CritiquePipelineStageId;
  model?: string;
}): CritiquePipelineStageSnapshot {
  return {
    stage: args.stage,
    status: 'skipped',
    ...(args.model ? { model: args.model } : {}),
  };
}

export function createFailedStageSnapshot(args: {
  error: CritiquePipelineError;
  model?: string;
}): CritiquePipelineStageSnapshot {
  const stage = stageIdFromErrorStage(args.error.stage);
  const attempts =
    createStageAttempts({
      model: args.model,
      failedAttempts: args.error.debug?.attempts,
    }) ??
    [
      toPipelineAttempt({
        attempt: args.error instanceof CritiqueRetryExhaustedError ? args.error.attempts : 1,
        status: 'failed',
        model: args.model,
        debug: {
          attempt: args.error instanceof CritiqueRetryExhaustedError ? args.error.attempts : 1,
          error: args.error.message,
          details: args.error.details,
        },
      }),
    ];

  return {
    stage,
    status: 'failed',
    ...(args.model ? { model: args.model } : {}),
    attempts,
  };
}
