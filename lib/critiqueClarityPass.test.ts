import { describe, expect, it } from 'vitest';

import { composeFallbackCritique } from './critiqueFallback.js';
import {
  clarityPassEligible,
  isClarityPassEnabled,
  mergeClarityResponse,
  validateClarityMerge,
} from './critiqueClarityPass.js';
import { makeCritiqueEvidenceFixture } from './critiqueTestFixtures.js';
import { validateCritiqueResult } from './critiqueValidation.js';

describe('clarity pass eligibility', () => {
  it('is disabled unless OPENAI_CLARITY_PASS is set', () => {
    const prev = process.env.OPENAI_CLARITY_PASS;
    delete process.env.OPENAI_CLARITY_PASS;
    expect(isClarityPassEnabled()).toBe(false);
    process.env.OPENAI_CLARITY_PASS = '1';
    expect(isClarityPassEnabled()).toBe(true);
    if (prev === undefined) {
      delete process.env.OPENAI_CLARITY_PASS;
    } else {
      process.env.OPENAI_CLARITY_PASS = prev;
    }
  });

  it('does not run on fallback critiques', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const critique = validateCritiqueResult(
      composeFallbackCritique({
        style: 'Realism',
        medium: 'Oil on Canvas',
        evidence,
        failureStage: 'final',
      })
    );
    expect(clarityPassEligible(critique)).toBe(false);
  });
});

describe('validateClarityMerge', () => {
  it('rejects when a rating level changes', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const base = validateCritiqueResult(
      composeFallbackCritique({
        style: 'Realism',
        medium: 'Oil on Canvas',
        evidence,
        failureStage: 'final',
      })
    );
    const tampered = {
      ...base,
      categories: base.categories.map((cat, i) =>
        i === 0 ? { ...cat, level: 'Master' as (typeof cat)['level'] } : cat
      ),
    };
    expect(validateClarityMerge(base, tampered)).toBe(false);
  });
});

describe('mergeClarityResponse', () => {
  it('keeps plan and anchor objects from the original categories', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const base = validateCritiqueResult(
      composeFallbackCritique({
        style: 'Realism',
        medium: 'Oil on Canvas',
        evidence,
        failureStage: 'final',
      })
    );
    const parsed = {
      summary: base.summary + ' ',
      overallSummary: {
        analysis: base.overallSummary!.analysis,
        topPriorities: [...base.overallSummary!.topPriorities],
      },
      simpleFeedback: {
        studioAnalysis: { ...base.simpleFeedback!.studioAnalysis },
        studioChanges: base.simpleFeedback!.studioChanges.map((ch) => ({
          text: ch.text,
          previewCriterion: ch.previewCriterion,
        })),
      },
      categories: base.categories.map((c) => ({
        criterion: c.criterion,
        phase1: { visualInventory: c.phase1.visualInventory },
        phase2: { criticsAnalysis: c.phase2.criticsAnalysis },
        phase3: { teacherNextSteps: c.phase3.teacherNextSteps },
        preserve: c.preserve,
      })),
      suggestedPaintingTitles: base.suggestedPaintingTitles!.map((t) => ({ ...t })),
      comparisonNote: base.comparisonNote ?? null,
    };
    const merged = mergeClarityResponse(base, parsed);
    expect(merged.categories[0]!.plan).toEqual(base.categories[0]!.plan);
    expect(merged.categories[0]!.anchor).toEqual(base.categories[0]!.anchor);
    expect(merged.simpleFeedback?.studioChanges[0]?.previewCriterion).toBe(
      base.simpleFeedback!.studioChanges[0]!.previewCriterion
    );
  });
});
