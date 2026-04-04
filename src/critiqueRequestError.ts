import {
  CritiqueGroundingError,
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
  return kind !== 'server_config' && kind !== 'aborted';
}

export function createCritiqueRequestError(
  args: CreateCritiqueRequestErrorArgs
): CritiqueRequestError {
  const technicalMessage = args.technicalMessage?.trim() || 'Unknown request failure';
  const kind =
    args.kind ??
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

export function isCritiquePipelineErrorPayload(
  value: unknown
): value is CritiquePipelineErrorPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CritiquePipelineErrorPayload>;
  return (
    typeof candidate.error === 'string' &&
    typeof candidate.errorName === 'string' &&
    (candidate.stage === 'evidence' ||
      candidate.stage === 'voice_a' ||
      candidate.stage === 'voice_b' ||
      candidate.stage === 'final') &&
    Array.isArray(candidate.details) &&
    candidate.details.every((detail) => typeof detail === 'string') &&
    (candidate.attempts === undefined || typeof candidate.attempts === 'number') &&
    (candidate.debug === undefined ||
      (typeof candidate.debug === 'object' &&
        candidate.debug !== null &&
        Array.isArray((candidate.debug as { attempts?: unknown }).attempts)))
  );
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
