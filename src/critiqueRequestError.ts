import {
  CritiqueGroundingError,
  type CritiqueDebugInfo,
  type CritiqueDebugPayload,
  type CritiquePipelineErrorPayload,
  type CritiqueStageName,
  CritiqueRetryExhaustedError,
  CritiqueRuntimeEvalError,
  CritiqueValidationError,
} from '../lib/critiqueErrors.js';

export type CritiqueRequestOperation = 'classify' | 'critique';

export type CritiqueRequestErrorKind =
  | 'aborted'
  | 'network'
  | 'server_config'
  | 'invalid_response'
  | 'validation'
  | 'grounding'
  | 'runtime_eval'
  | 'retry_exhausted'
  | 'uninterpretable'
  | 'http'
  | 'unknown';

type CreateCritiqueRequestErrorArgs = {
  operation: CritiqueRequestOperation;
  technicalMessage?: string;
  kind?: CritiqueRequestErrorKind;
  status?: number;
  userMessage?: string;
  retryable?: boolean;
  stage?: CritiqueStageName;
  details?: string[];
  attempts?: number;
  backendErrorName?: string;
  debug?: CritiqueDebugPayload;
  /** Server payload code for critique failures */
  pipelineCode?: string;
};

export class CritiqueRequestError extends Error {
  readonly operation: CritiqueRequestOperation;
  readonly kind: CritiqueRequestErrorKind;
  readonly technicalMessage: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly stage?: CritiqueStageName;
  readonly details: string[];
  readonly attempts?: number;
  readonly backendErrorName?: string;
  readonly debug?: CritiqueDebugPayload;

  constructor(args: {
    operation: CritiqueRequestOperation;
    kind: CritiqueRequestErrorKind;
    technicalMessage: string;
    message: string;
    retryable: boolean;
    status?: number;
    stage?: CritiqueStageName;
    details?: string[];
    attempts?: number;
    backendErrorName?: string;
    debug?: CritiqueDebugPayload;
  }) {
    super(args.message);
    this.name = 'CritiqueRequestError';
    this.operation = args.operation;
    this.kind = args.kind;
    this.technicalMessage = args.technicalMessage;
    this.retryable = args.retryable;
    this.status = args.status;
    this.stage = args.stage;
    this.details = args.details ?? [];
    this.attempts = args.attempts;
    this.backendErrorName = args.backendErrorName;
    this.debug = args.debug;
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim().length > 0) return error.trim();
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim();
  return 'Unknown request failure';
}

function inferKind(message: string, status?: number): CritiqueRequestErrorKind {
  const normalized = message.toLowerCase();

  if (status === 503 || normalized.includes('openai_api_key')) return 'server_config';
  if (normalized.includes('abort')) return 'aborted';
  if (
    normalized.includes('invalid json from api') ||
    normalized.includes('invalid response') ||
    normalized.includes('no image in response')
  ) {
    return 'invalid_response';
  }
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  ) {
    return 'network';
  }
  if (normalized.includes('exhausted retries')) return 'retry_exhausted';
  if (
    /\bopenai error 429\b/.test(normalized) ||
    /\brate limit\b/.test(normalized) ||
    normalized.includes('too many requests')
  ) {
    return 'retry_exhausted';
  }
  if (/\bopenai error 5\d\d\b/.test(normalized) || normalized.includes('service unavailable')) {
    return 'server_config';
  }
  if (
    normalized.includes('grounding') ||
    normalized.includes('missing evidence') ||
    normalized.includes('evidence traceability') ||
    normalized.includes('drifted from its evidence anchors')
  ) {
    return 'grounding';
  }
  if (
    normalized.includes('validation failed') ||
    normalized.includes('schema validation failed') ||
    normalized.includes('invalid evidence json') ||
    normalized.includes('teaching-plan validation failed')
  ) {
    return 'validation';
  }
  if (normalized.includes('quality gate rejected')) return 'runtime_eval';
  if (status != null || /^api \d+/i.test(message)) return 'http';
  return 'unknown';
}

function inferKindFromBackendErrorName(
  backendErrorName: string | undefined
): CritiqueRequestErrorKind | undefined {
  switch (backendErrorName) {
    case 'CritiqueValidationError':
      return 'validation';
    case 'CritiqueGroundingError':
      return 'grounding';
    case 'CritiqueRuntimeEvalError':
      return 'runtime_eval';
    case 'CritiqueRetryExhaustedError':
      return 'retry_exhausted';
    case 'CritiqueUninterpretableImageError':
      return 'uninterpretable';
    default:
      return undefined;
  }
}

function defaultUserMessage(
  kind: CritiqueRequestErrorKind,
  operation: CritiqueRequestOperation
): string {
  switch (kind) {
    case 'server_config':
      return 'The critique service is unavailable right now. Please try again later.';
    case 'network':
      return 'The request could not reach the critique service. Check your connection and try again.';
    case 'invalid_response':
      return operation === 'classify'
        ? 'Style detection returned an invalid response. Please retry or choose the style manually.'
        : 'The critique service returned an invalid response. Please retry with this image.';
    case 'validation':
      return 'The critique was stopped because the AI response did not pass validation. Please retry.';
    case 'grounding':
      return 'The critique was stopped because the feedback could not be grounded in the uploaded painting. Please retry.';
    case 'runtime_eval':
      return 'The critique was stopped by a quality check before results were shown. Please retry.';
    case 'retry_exhausted':
      return 'The critique service exhausted its retries before producing a safe result. Please try again.';
    case 'uninterpretable':
      return 'Your painting is unable to be analyzed.';
    case 'http':
      return operation === 'classify'
        ? 'Style detection failed before it could complete. Please retry or choose the style manually.'
        : 'The critique request failed before it could complete. Please retry.';
    case 'aborted':
      return operation === 'classify'
        ? 'Style detection was cancelled.'
        : 'The critique request was cancelled.';
    case 'unknown':
    default:
      return operation === 'classify'
        ? 'Style detection failed. Please retry or choose the style manually.'
        : 'The critique could not be completed. Please retry with this image.';
  }
}

function defaultRetryable(kind: CritiqueRequestErrorKind): boolean {
  return kind !== 'server_config' && kind !== 'aborted' && kind !== 'uninterpretable';
}

export function createCritiqueRequestError(
  args: CreateCritiqueRequestErrorArgs
): CritiqueRequestError {
  const technicalMessage = args.technicalMessage?.trim() || 'Unknown request failure';
  const kind =
    args.kind ??
    (args.pipelineCode === 'UNINTERPRETABLE_IMAGE' ? 'uninterpretable' : undefined) ??
    inferKindFromBackendErrorName(args.backendErrorName) ??
    inferKind(technicalMessage, args.status);
  return new CritiqueRequestError({
    operation: args.operation,
    kind,
    technicalMessage,
    message: args.userMessage ?? defaultUserMessage(kind, args.operation),
    retryable: args.retryable ?? defaultRetryable(kind),
    status: args.status,
    stage: args.stage,
    details: args.details,
    attempts: args.attempts,
    backendErrorName: args.backendErrorName,
    debug: args.debug,
  });
}

const PIPELINE_ERROR_STAGES: readonly CritiqueStageName[] = [
  'evidence',
  'calibration',
  'voice_a',
  'voice_b',
  'voice_b_summary',
  'final',
] as const;

function normalizePipelineErrorStage(raw: unknown): CritiqueStageName {
  if (typeof raw === 'string' && (PIPELINE_ERROR_STAGES as readonly string[]).includes(raw)) {
    return raw as CritiqueStageName;
  }
  return 'final';
}

function sanitizeCritiqueDebugPayload(raw: unknown): CritiqueDebugPayload | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') return undefined;
  const attemptsUnknown = (raw as { attempts?: unknown }).attempts;
  if (!Array.isArray(attemptsUnknown)) return undefined;

  const attempts: CritiqueDebugInfo[] = [];
  for (const item of attemptsUnknown) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const attemptNum = typeof o.attempt === 'number' ? o.attempt : Number(o.attempt);
    if (!Number.isFinite(attemptNum)) continue;
    const err = typeof o.error === 'string' ? o.error : '';
    const details = Array.isArray(o.details)
      ? o.details.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)))
      : [];
    attempts.push({
      attempt: attemptNum,
      error: err || 'Unknown error',
      details,
      ...(typeof o.repairNotePreview === 'string' ? { repairNotePreview: o.repairNotePreview } : {}),
      ...(typeof o.rawPreview === 'string' ? { rawPreview: o.rawPreview } : {}),
      ...(Array.isArray(o.criterionEvidencePreview)
        ? {
            criterionEvidencePreview: o.criterionEvidencePreview
              .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
              .map((p) => ({
                criterion: typeof p.criterion === 'string' ? p.criterion : '',
                ...(typeof p.anchor === 'string' ? { anchor: p.anchor } : {}),
                ...(Array.isArray(p.visibleEvidencePreview)
                  ? {
                      visibleEvidencePreview: p.visibleEvidencePreview
                        .filter((l): l is string => typeof l === 'string')
                        .slice(0, 8),
                    }
                  : {}),
              })),
          }
        : {}),
    });
  }

  return attempts.length > 0 ? { attempts } : undefined;
}

/**
 * Parses server `/api/critique` error JSON leniently so we still show validation/grounding
 * messages when `debug` shape drifts or `stage` includes internal ids.
 */
export function parseCritiquePipelineErrorPayload(value: unknown): CritiquePipelineErrorPayload | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.error !== 'string' || typeof candidate.errorName !== 'string') {
    return null;
  }
  const detailsRaw = candidate.details;
  const details = Array.isArray(detailsRaw)
    ? detailsRaw.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)))
    : [];
  const stage = normalizePipelineErrorStage(candidate.stage);
  const attempts =
    candidate.attempts === undefined
      ? undefined
      : typeof candidate.attempts === 'number'
        ? candidate.attempts
        : Number(candidate.attempts);
  const safeAttempts = Number.isFinite(attempts as number) ? (attempts as number) : undefined;
  const code =
    candidate.code === 'UNINTERPRETABLE_IMAGE' ? ('UNINTERPRETABLE_IMAGE' as const) : undefined;
  const debug = sanitizeCritiqueDebugPayload(candidate.debug);

  return {
    error: candidate.error,
    errorName: candidate.errorName,
    stage,
    details,
    ...(safeAttempts !== undefined ? { attempts: safeAttempts } : {}),
    ...(code ? { code } : {}),
    ...(debug ? { debug } : {}),
  };
}

export function isCritiquePipelineErrorPayload(
  value: unknown
): value is CritiquePipelineErrorPayload {
  return parseCritiquePipelineErrorPayload(value) !== null;
}

export function normalizeCritiqueRequestError(
  error: unknown,
  operation: CritiqueRequestOperation
): CritiqueRequestError {
  if (error instanceof CritiqueRequestError) return error;

  if (error instanceof CritiqueValidationError) {
    return createCritiqueRequestError({
      operation,
      kind: 'validation',
      technicalMessage: error.message,
      stage: error.stage,
      details: error.details,
      backendErrorName: error.name,
    });
  }

  if (error instanceof CritiqueGroundingError) {
    return createCritiqueRequestError({
      operation,
      kind: 'grounding',
      technicalMessage: error.message,
      stage: error.stage,
      details: error.details,
      backendErrorName: error.name,
    });
  }

  if (error instanceof CritiqueRuntimeEvalError) {
    return createCritiqueRequestError({
      operation,
      kind: 'runtime_eval',
      technicalMessage: error.message,
      stage: error.stage,
      details: error.details,
      backendErrorName: error.name,
    });
  }

  if (error instanceof CritiqueRetryExhaustedError) {
    return createCritiqueRequestError({
      operation,
      kind: 'retry_exhausted',
      technicalMessage: error.message,
      stage: error.stage,
      details: error.details,
      attempts: error.attempts,
      backendErrorName: error.name,
      debug: error.debug,
    });
  }

  return createCritiqueRequestError({
    operation,
    technicalMessage: extractErrorMessage(error),
  });
}
