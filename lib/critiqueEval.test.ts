import { describe, expect, it } from 'vitest';

import { CritiqueRuntimeEvalError } from './critiqueErrors';
import { assertCritiqueQualityGate, evaluateCritiqueQuality } from './critiqueEval';
import { makeCritiqueResultFixture } from './critiqueTestFixtures';

describe('evaluateCritiqueQuality', () => {
  it('accepts a passage-anchored critique with strong analysis and suggestions', () => {
    const critique = makeCritiqueResultFixture();

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.genericMainIssue).toBe(false);
    expect(evaluation.genericNextSteps).toBe(false);
    expect(evaluation.vagueVoiceB).toBe(false);
    expect(evaluation.weakEvidence).toBe(false);
    expect(evaluation.weakGrounding).toBe(false);
    expect(evaluation.duplicatedCoaching).toBe(false);
    expect(evaluation.suspiciousOverpraise).toBe(false);
    expect(evaluation.blockingIssues).toEqual([]);
    expect(() => assertCritiqueQualityGate(critique)).not.toThrow();
  });

  it('flags generic Voice A analysis without making it a blocking issue by itself', () => {
    const critique = makeCritiqueResultFixture();
    critique.simpleFeedback!.studioAnalysis.whatWorks =
      'The painting effectively uses composition and creates a sense of atmosphere.';
    critique.simpleFeedback!.studioAnalysis.whatCouldImprove =
      'The work aims to create a strong sense of space and could use clearer development.';

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.genericVoiceA).toBe(true);
    expect(evaluation.genericMainIssue).toBe(false);
    expect(evaluation.blockingIssues).toEqual([]);
  });

  it('flags a generic main issue paragraph while preserving non-blocking status', () => {
    const critique = makeCritiqueResultFixture();
    critique.simpleFeedback!.studioAnalysis.whatCouldImprove =
      'The painting would benefit from a clearer focal point and more depth in the room.';

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.genericMainIssue).toBe(true);
    expect(evaluation.blockingIssues).toEqual([]);
  });

  it('treats duplicated category coaching as a blocking quality failure', () => {
    const critique = makeCritiqueResultFixture();
    const templateStep =
      '1. In the jaw edge against the dark collar, sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more so the face claims first attention.';

    critique.categories[1] = {
      ...critique.categories[1]!,
      phase3: { teacherNextSteps: templateStep },
      actionPlanSteps: [
        {
          ...critique.categories[1]!.actionPlanSteps![0]!,
          area: 'the jaw edge against the dark collar',
          move: 'sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more',
        },
      ],
    };

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.duplicatedCoaching).toBe(true);
    expect(evaluation.blockingIssues).toContain(
      'The teaching advice repeats across criteria instead of staying distinct.'
    );
    expect(() => assertCritiqueQualityGate(critique)).toThrow(CritiqueRuntimeEvalError);
  });

  it('flags weak grounding when category prose drifts off anchor', () => {
    const critique = makeCritiqueResultFixture();
    critique.categories[5] = {
      ...critique.categories[5]!,
      phase2: {
        criticsAnalysis: 'The painting could use stronger focus in a few places.',
      },
      phase3: {
        teacherNextSteps: '1. Improve the focus where needed across the composition.',
      },
    };

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.weakGrounding).toBe(true);
    expect(evaluation.blockingIssues).toContain(
      'The critique drifts away from its anchored evidence passages.'
    );
  });

  it('flags vague studio changes as a blocking suggestions regression', () => {
    const critique = makeCritiqueResultFixture();
    critique.simpleFeedback!.studioChanges = [
      {
        text: 'Define certain edges more clearly to enhance the focus hierarchy.',
        previewCriterion: 'Edge and focus control',
      },
      {
        text: 'Smooth out abrupt color transitions to enhance the realism of the painting.',
        previewCriterion: 'Color relationships',
      },
    ];

    const evaluation = evaluateCritiqueQuality(critique);

    expect(evaluation.genericNextSteps).toBe(true);
    expect(evaluation.vagueVoiceB).toBe(true);
    expect(evaluation.blockingIssues).toContain(
      'The teaching advice is still too generic to be actionable.'
    );
  });
});
