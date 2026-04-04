export type CritiqueStageName = 'evidence' | 'voice_a' | 'voice_b' | 'final';

export type CritiquePipelineErrorPayload = {
  error: string;
  errorName: string;
  stage: CritiqueStageName;
  details: string[];
  attempts?: number;
};

export type CritiqueDebugInfo = {
  attempt: number;
  error: string;
  details: string[];
  repairNotePreview?: string;
};

type CritiqueErrorOptions = {
  stage: CritiqueStageName;
  details?: string[];
  cause?: unknown;
};

function joinDetails(details?: string[]): string {
  return details && details.length > 0 ? `\n${details.map((d) => `- ${d}`).join('\n')}` : '';
}

export class CritiquePipelineError extends Error {
  readonly stage: CritiqueStageName;
  readonly details: string[];
  cause?: unknown;

  constructor(message: string, options: CritiqueErrorOptions) {
    super(`${message}${joinDetails(options.details)}`);
    this.name = 'CritiquePipelineError';
    this.stage = options.stage;
    this.details = options.details ?? [];
    this.cause = options.cause;
  }
}

export class CritiqueValidationError extends CritiquePipelineError {
  constructor(message: string, options: CritiqueErrorOptions) {
    super(message, options);
    this.name = 'CritiqueValidationError';
  }
}

export class CritiqueGroundingError extends CritiquePipelineError {
  constructor(message: string, options: CritiqueErrorOptions) {
    super(message, options);
    this.name = 'CritiqueGroundingError';
  }
}

export class CritiqueRuntimeEvalError extends CritiquePipelineError {
  constructor(message: string, options: CritiqueErrorOptions) {
    super(message, options);
    this.name = 'CritiqueRuntimeEvalError';
  }
}

export class CritiqueRetryExhaustedError extends CritiquePipelineError {
  readonly attempts: number;
  readonly debug?: CritiqueDebugInfo[];

  constructor(
    message: string,
    attempts: number,
    options: CritiqueErrorOptions & { debug?: CritiqueDebugInfo[] }
  ) {
    super(message, options);
    this.name = 'CritiqueRetryExhaustedError';
    this.attempts = attempts;
    this.debug = options.debug;
  }
}

export function serializeCritiquePipelineError(
  error: CritiquePipelineError
): CritiquePipelineErrorPayload {
  return {
    error: error.message,
    errorName: error.name,
    stage: error.stage,
    details:
      error instanceof CritiqueRetryExhaustedError && error.debug && error.debug.length > 0
        ? [
            ...error.details,
            ...error.debug.map((entry) =>
              `[debug attempt ${entry.attempt}] ${entry.error}${entry.details.length > 0 ? ` | ${entry.details.join(' | ')}` : ''}${entry.repairNotePreview ? ` | repair: ${entry.repairNotePreview}` : ''}`
            ),
          ]
        : error.details,
    ...(error instanceof CritiqueRetryExhaustedError ? { attempts: error.attempts } : {}),
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Unknown critique pipeline error';
}

export function errorDetails(error: unknown): string[] {
  if (
    error instanceof CritiquePipelineError &&
    Array.isArray(error.details) &&
    error.details.length > 0
  ) {
    return error.details;
  }
  if (error instanceof Error && error.message.trim().length > 0) return [error.message];
  return ['Unknown critique pipeline error'];
}
