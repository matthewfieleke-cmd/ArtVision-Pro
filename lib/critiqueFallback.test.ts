import { describe, expect, it } from 'vitest';

import { composeFallbackCritique } from './critiqueFallback.js';
import { CRITERIA_ORDER } from '../shared/criteria.js';
import type { CritiqueEvidenceDTO } from './critiqueTypes.js';

/**
 * Small self-contained evidence fixture for the fallback tests.
 *
 * We used to reuse the old `critiqueTestFixtures.ts` + pass the fallback
 * through the Zod-style `validateCritiqueResult` / `validateCritiqueGrounding`
 * validators. Both of those were part of the retired pre-gpt-5 validation
 * stack. The invariants those tests actually protected are preserved here by
 * checking the resulting critique's shape directly against
 * `CRITERIA_ORDER` + the fallback-specific flags.
 */
function makeEvidenceFixture(
  overrides?: (
    entry: CritiqueEvidenceDTO['criterionEvidence'][number]
  ) => CritiqueEvidenceDTO['criterionEvidence'][number]
): CritiqueEvidenceDTO {
  const baseConfidence: 'low' | 'medium' | 'high' = 'medium';
  const entries = CRITERIA_ORDER.map((criterion, idx) => {
    const base = {
      criterion,
      observationPassageId: `p${idx + 1}`,
      anchor: `the anchored passage for ${criterion.toLowerCase()}`,
      visibleEvidence: [
        `the anchored passage for ${criterion.toLowerCase()} carries the main visual event`,
        `the adjacent passage stays quieter so ${criterion.toLowerCase()} reads clearly`,
        `one small detail at the edge of this passage still limits ${criterion.toLowerCase()} slightly`,
        `nothing else in the picture fights this passage on ${criterion.toLowerCase()}`,
      ],
      strengthRead: `the anchored passage already carries ${criterion.toLowerCase()} convincingly`,
      tensionRead: `nothing urgent is unresolved for ${criterion.toLowerCase()}`,
      preserve: `keep the anchored passage intact; it carries ${criterion.toLowerCase()}`,
      confidence: baseConfidence,
    };
    return overrides ? overrides(base) : base;
  });
  return {
    intentHypothesis: 'a quiet interior study using compression and obstruction',
    strongestVisibleQualities: ['cohesive value world', 'one intentional obstruction'],
    mainTensions: ['one passage slightly too blunt'],
    completionRead: {
      state: 'likely_finished',
      confidence: 'medium',
      cues: ['edges read resolved across the canvas'],
      rationale: 'consistent finish',
    },
    photoQualityRead: { level: 'good', summary: 'clear phone shot', issues: [] },
    comparisonObservations: [],
    criterionEvidence: entries,
  };
}

describe('composeFallbackCritique', () => {
  it('covers every criterion with a category entry', () => {
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: makeEvidenceFixture(),
      failureStage: 'voice_b',
    });

    const covered = new Set(critique.categories.map((c) => c.criterion));
    for (const criterion of CRITERIA_ORDER) {
      expect(covered.has(criterion)).toBe(true);
    }
  });

  it('marks the pipeline metadata as having fallen back', () => {
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: makeEvidenceFixture(),
      failureStage: 'final',
    });

    expect(critique.analysisSource).toBe('fallback');
    expect(critique.pipeline?.completedWithFallback).toBe(true);
  });

  it('grounds each category to its evidence anchor', () => {
    const evidence = makeEvidenceFixture();
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence,
      failureStage: 'final',
    });

    // Each category should reuse the anchor wording at the areaSummary level
    // so the fallback is still traceable to the evidence the vision stage
    // produced. This is the invariant the retired `validateCritiqueGrounding`
    // exercised; keep it checked here directly.
    for (const category of critique.categories) {
      const anchor = evidence.criterionEvidence.find(
        (entry) => entry.criterion === category.criterion
      )?.anchor;
      expect(category.anchor?.areaSummary).toBe(anchor);
    }
  });

  it('produces a multi-sentence summary, not a one-line stub', () => {
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: makeEvidenceFixture(),
      failureStage: 'final',
    });

    expect(critique.summary.split('. ').length).toBeGreaterThanOrEqual(3);
  });

  it('still returns a category row when a criterion is missing from the evidence', () => {
    const evidence = makeEvidenceFixture();
    const trimmed: CritiqueEvidenceDTO = {
      ...evidence,
      criterionEvidence: evidence.criterionEvidence.filter(
        (entry) => entry.criterion !== 'Color relationships'
      ),
    };

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: trimmed,
      failureStage: 'voice_b',
    });

    expect(
      critique.categories.some((category) => category.criterion === 'Color relationships')
    ).toBe(true);
  });

  it('orders studioChanges by lowest-confidence criteria first', () => {
    const evidence = makeEvidenceFixture((entry) =>
      entry.criterion === 'Presence, point of view, and human force'
        ? { ...entry, confidence: 'low' }
        : { ...entry, confidence: 'high' }
    );

    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence,
      failureStage: 'voice_b',
    });

    const changes = critique.simpleFeedback?.studioChanges ?? [];
    expect(changes[0]?.previewCriterion).toBe('Presence, point of view, and human force');
  });

  it('varies category phrasing across criteria', () => {
    // The fallback must not paste the same sentence into every category row.
    // The old validators checked this indirectly; we keep it explicit here.
    const critique = composeFallbackCritique({
      style: 'Realism',
      medium: 'Oil on Canvas',
      evidence: makeEvidenceFixture(),
      failureStage: 'voice_b',
    });

    const phase2Prose = critique.categories.map((c) => c.phase2.criticsAnalysis);
    expect(new Set(phase2Prose).size).toBeGreaterThan(3);
  });
});
