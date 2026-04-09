import { describe, expect, it } from 'vitest';

import {
  computeCritiqueSoftSignals,
  duplicateSentenceCountAcrossPhase2,
} from './critiqueHelpfulnessSignals.js';
import { makeCritiqueResultFixture } from './critiqueTestFixtures.js';

describe('computeCritiqueSoftSignals', () => {
  it('returns metrics for a valid fixture critique', () => {
    const critique = makeCritiqueResultFixture();
    const s = computeCritiqueSoftSignals(critique);
    expect(s.categoryCount).toBeGreaterThan(0);
    expect(s.phase2PairwiseJaccardMax).toBeGreaterThanOrEqual(0);
    expect(s.phase2PairwiseJaccardMax).toBeLessThanOrEqual(1);
    expect(s.teacherPairwiseJaccardMax).toBeGreaterThanOrEqual(0);
    expect(s.teacherMeanChars).toBeGreaterThan(0);
  });

  it('flags high phase2 similarity when two categories share near-identical text', () => {
    const base = makeCritiqueResultFixture();
    const dup = 'The same critical analysis repeated for testing repetition signals in the critique pipeline.';
    const critique = {
      ...base,
      categories: base.categories.map((c, i) =>
        i < 2
          ? { ...c, phase2: { criticsAnalysis: dup } }
          : c
      ),
    };
    const s = computeCritiqueSoftSignals(critique);
    expect(s.phase2PairwiseJaccardMax).toBeGreaterThan(0.7);
    expect(s.notes.length).toBeGreaterThan(0);
  });
});

describe('duplicateSentenceCountAcrossPhase2', () => {
  it('counts repeated sentences across categories', () => {
    const base = makeCritiqueResultFixture();
    const sentence = 'This exact sentence is duplicated across two criteria for testing.';
    const critique = {
      ...base,
      categories: base.categories.map((c, i) =>
        i < 2
          ? { ...c, phase2: { criticsAnalysis: `${sentence} ${sentence}` } }
          : c
      ),
    };
    const d = duplicateSentenceCountAcrossPhase2(critique);
    expect(d).toBeGreaterThan(0);
  });
});
