import { describe, expect, it, vi } from 'vitest';

import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit';
import { createCritiqueInstrumenter } from './critiqueInstrumentation';
import { makeCritiqueResultFixture } from './critiqueTestFixtures';

describe('critiqueNeedsFreshEvidenceRead', () => {
  it('accepts a grounded critique fixture', () => {
    expect(critiqueNeedsFreshEvidenceRead(makeCritiqueResultFixture())).toBe(false);
  });

  it('fails when top-level analysis loses concrete anchor references', () => {
    const critique = makeCritiqueResultFixture();
    critique.summary = 'A strong painting with one area to improve.';
    critique.overallSummary.analysis =
      'Using the Drawing lens, the painting shows clear strengths and a few modest issues.';

    expect(critiqueNeedsFreshEvidenceRead(critique)).toBe(true);
  });
});

describe('applyCritiqueGuardrails', () => {
  it('leaves a high-quality critique unchanged', () => {
    const critique = makeCritiqueResultFixture();

    expect(applyCritiqueGuardrails(critique)).toEqual(critique);
  });

  it('rewrites vague teaching steps into anchored suggestions', () => {
    const critique = makeCritiqueResultFixture();
    critique.categories[5] = {
      ...critique.categories[5]!,
      phase3: {
        teacherNextSteps: '1. Improve the focus where needed.',
      },
      editPlan: {
        ...critique.categories[5]!.editPlan!,
        issue: 'the jaw edge against the dark collar is no crisper than the softer cheek edge into the wall',
        intendedChange:
          'sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more',
        expectedOutcome:
          'the face claims first attention while the useful cheek softness still stays atmospheric',
      },
    };
    critique.simpleFeedback!.studioChanges[2] = {
      text: 'Define certain edges more clearly to enhance the focus hierarchy.',
      previewCriterion: 'Edge and focus control',
    };

    const guarded = applyCritiqueGuardrails(critique);
    const edgeCategory = guarded.categories.find(
      (category) => category.criterion === 'Edge and focus control'
    );

    expect(edgeCategory).toBeTruthy();
    expect(edgeCategory!.phase3.teacherNextSteps).toMatch(/jaw edge|dark collar|cheek edge/i);
    expect(edgeCategory!.phase3.teacherNextSteps).toMatch(/sharpen|lose/i);
    expect(guarded.simpleFeedback!.studioChanges[2]!.text).toMatch(/jaw edge|dark collar/i);
    expect(guarded.simpleFeedback!.studioChanges[2]!.text).toMatch(/sharpen|lose/i);
  });

  it('records guardrail categories when a repair mutation occurs', () => {
    const critique = makeCritiqueResultFixture();
    critique.categories[5] = {
      ...critique.categories[5]!,
      phase3: {
        teacherNextSteps: '1. Improve the focus where needed.',
      },
    };

    const instrumenter = createCritiqueInstrumenter(true);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      applyCritiqueGuardrails(critique, instrumenter);
      const loggedPayloads = infoSpy.mock.calls
        .map(([message]) => message)
        .filter((message): message is string => typeof message === 'string')
        .filter((message) => message.includes('"type":"critique_mutation"'));

      expect(loggedPayloads.some((message) => message.includes('"category":"repair"'))).toBe(true);
    } finally {
      infoSpy.mockRestore();
    }
  });
});
