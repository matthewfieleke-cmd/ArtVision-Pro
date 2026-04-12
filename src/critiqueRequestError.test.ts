import { describe, expect, it } from 'vitest';

import { parseCritiquePipelineErrorPayload } from './critiqueRequestError';

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
