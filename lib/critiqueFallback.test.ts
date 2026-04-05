import { describe, expect, it } from 'vitest';

import { composeFallbackCritique } from './critiqueFallback.js';
import { makeCritiqueEvidenceFixture } from './critiqueTestFixtures.js';
import { validateCritiqueGrounding, validateCritiqueResult } from './critiqueValidation.js';

describe('composeFallbackCritique', () => {
  it('builds a schema-valid fallback critique from evidence alone', () => {
    const evidence = makeCritiqueEvidenceFixture();

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence,
      failureStage: 'voice_b',
    });

    expect(() => validateCritiqueResult(critique)).not.toThrow();
  });

  it('stays grounded to the evidence anchors', () => {
    const evidence = makeCritiqueEvidenceFixture();

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence,
      failureStage: 'final',
    });

    const validated = validateCritiqueResult(critique);
    expect(() => validateCritiqueGrounding(validated, evidence)).not.toThrow();
    expect(validated.analysisSource).toBe('fallback');
    expect(validated.pipeline?.completedWithFallback).toBe(true);
  });
});
