export type CritiqueStageName =
  | 'evidence'
  | 'calibration'
  | 'voice_a'
  | 'voice_b'
  /** Internal sub-step; serialized on some errors — treat like voice_b in clients. */
  | 'voice_b_summary'
  | 'final';

export type CritiquePipelineErrorPayload = {
  error: string;
  errorName: string;
  stage: CritiqueStageName;
  details: string[];
  attempts?: number;
  debug?: CritiqueDebugPayload;
  /** When set, the client may show a dedicated “cannot analyze” experience (no critique payload). */
  code?: 'UNINTERPRETABLE_IMAGE';
};

export type CritiqueCriterionEvidencePreview = {
  criterion: string;
  anchor?: string;
  visibleEvidencePreview?: string[];
};

export type CritiqueDebugInfo = {
  attempt: number;
  error: string;
  details: string[];
  repairNotePreview?: string;
  rawPreview?: string;
  criterionEvidencePreview?: CritiqueCriterionEvidencePreview[];
};

export type CritiqueDebugPayload = {
  attempts: CritiqueDebugInfo[];
};

type CritiqueErrorOptions = {
  stage: CritiqueStageName;
  details?: string[];
  cause?: unknown;
  debug?: CritiqueDebugPayload;
};

function joinDetails(details?: string[]): string {
  return details && details.length > 0 ? `\n${details.map((d) => `- ${d}`).join('\n')}` : '';
}

export class CritiquePipelineError extends Error {
  readonly stage: CritiqueStageName;
  readonly details: string[];
  cause?: unknown;
  readonly debug?: CritiqueDebugPayload;

  constructor(message: string, options: CritiqueErrorOptions) {
    super(`${message}${joinDetails(options.details)}`);
    this.name = 'CritiquePipelineError';
    this.stage = options.stage;
    this.details = options.details ?? [];
    this.cause = options.cause;
    this.debug = options.debug;
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

  constructor(
    message: string,
    attempts: number,
    options: CritiqueErrorOptions
  ) {
    super(message, options);
    this.name = 'CritiqueRetryExhaustedError';
    this.attempts = attempts;
  }
}

/** Photo or pipeline cannot produce a grounded eight-criterion critique; client shows a simple message. */
export class CritiqueUninterpretableImageError extends CritiquePipelineError {
  readonly code = 'UNINTERPRETABLE_IMAGE' as const;

  constructor(options?: { details?: string[]; cause?: unknown }) {
    super('This painting photograph could not be analyzed with enough confidence.', {
      stage: 'evidence',
      details: options?.details ?? [],
      cause: options?.cause,
    });
    this.name = 'CritiqueUninterpretableImageError';
  }
}

export function serializeCritiquePipelineError(
  error: CritiquePipelineError
): CritiquePipelineErrorPayload {
  return {
    error: error.message,
    errorName: error.name,
    stage: error.stage,
    details: error.details,
    ...(error instanceof CritiqueRetryExhaustedError ? { attempts: error.attempts } : {}),
    ...(error instanceof CritiqueUninterpretableImageError ? { code: error.code } : {}),
    ...(error.debug ? { debug: error.debug } : {}),
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
