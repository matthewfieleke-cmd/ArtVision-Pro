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

  it('uses placeholder evidence when a criterion row is missing', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const trimmed = {
      ...evidence,
      criterionEvidence: evidence.criterionEvidence.filter((e) => e.criterion !== 'Color relationships'),
    };

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: trimmed,
      failureStage: 'voice_b',
    });

    expect(critique.categories.some((c) => c.criterion === 'Color relationships')).toBe(true);
    expect(() => validateCritiqueResult(critique)).not.toThrow();
  });

  it('aligns studioChanges previewCriterion with priority order, not CRITERIA_ORDER index', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const patched = {
      ...evidence,
      criterionEvidence: evidence.criterionEvidence.map((e) =>
        e.criterion === 'Presence, point of view, and human force'
          ? { ...e, confidence: 'low' as const }
          : { ...e, confidence: 'high' as const }
      ),
    };

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: patched,
      failureStage: 'voice_b',
    });

    const changes = critique.simpleFeedback?.studioChanges ?? [];
    expect(changes[0]?.previewCriterion).toBe('Presence, point of view, and human force');
    expect(changes[1]?.previewCriterion).toBe('Intent and necessity');
  });

  it('varies fallback category phrasing across criteria', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence,
      failureStage: 'voice_b',
    });
    const phase2 = critique.categories.map((c) => c.phase2.criticsAnalysis);
    expect(new Set(phase2).size).toBeGreaterThan(3);
  });
});
