import { describe, expect, it } from 'vitest';

import { createCritiqueRequestError, parseCritiquePipelineErrorPayload } from './critiqueRequestError';

describe('parseCritiquePipelineErrorPayload', () => {
  it('accepts pipeline errors when debug.attempts items omit string error', () => {
    const parsed = parseCritiquePipelineErrorPayload({
      error: 'Voice A output failed grounding validation.',
      errorName: 'CritiqueGroundingError',
      stage: 'voice_a',
      details: ['Composition: summary too vague.'],
      debug: {
        attempts: [
          {
            attempt: 1,
            details: ['x'],
          },
        ],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.debug?.attempts[0]?.attempt).toBe(1);
    expect(parsed?.debug?.attempts[0]?.error).toBe('Unknown error');
    expect(parsed?.debug?.attempts[0]?.details).toEqual(['x']);
  });

  it('accepts voice_b_summary stage from server', () => {
    const parsed = parseCritiquePipelineErrorPayload({
      error: 'Voice B summary schema validation failed.',
      errorName: 'CritiqueValidationError',
      stage: 'voice_b_summary',
      details: ['invalid'],
    });

    expect(parsed?.stage).toBe('voice_b_summary');
  });
});

describe('createCritiqueRequestError', () => {
  it('uses stage-specific messaging for critique retry exhaustion', () => {
    const error = createCritiqueRequestError({
      operation: 'critique',
      kind: 'retry_exhausted',
      technicalMessage: 'Observation stage exhausted retries.',
      stage: 'evidence',
    });

    expect(error.message).toContain('while reading painting evidence from the photo');
  });

  it("uses stage-specific messaging for teacher-guidance validation failures", () => {
    const error = createCritiqueRequestError({
      operation: 'critique',
      kind: 'validation',
      technicalMessage: 'Voice B output failed teaching-plan validation.',
      stage: 'voice_b',
    });

    expect(error.message).toContain("while assembling the teacher's guidance");
  });
});
