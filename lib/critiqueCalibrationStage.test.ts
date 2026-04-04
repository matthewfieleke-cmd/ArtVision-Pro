import { describe, expect, it } from 'vitest';

import {
  applyCalibrationToCritique,
  type CritiqueCalibrationDTO,
} from './critiqueCalibrationStage';
import { makeCritiqueResultFixture } from './critiqueTestFixtures';

function makeCalibrationFixture(
  overrides?: Partial<CritiqueCalibrationDTO>
): CritiqueCalibrationDTO {
  return {
    overallClass: 'developing',
    overallRead: 'The work has some control but should not score at the highest bands yet.',
    calibrationFlags: ['student-level structural control', 'selective local strengths'],
    criterionCaps: [
      {
        criterion: 'Intent and necessity',
        maxLevel: 'Intermediate',
        reason: 'Intent reads developing rather than fully authored.',
      },
      {
        criterion: 'Composition and shape structure',
        maxLevel: 'Intermediate',
        reason: 'The shape scaffold is credible but not yet advanced.',
      },
      {
        criterion: 'Value and light structure',
        maxLevel: 'Intermediate',
        reason: 'The main value relationships still remain in a developing band.',
      },
      {
        criterion: 'Color relationships',
        maxLevel: 'Advanced',
        reason: 'Color handling is the strongest axis in the work.',
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        maxLevel: 'Intermediate',
        reason: 'Spatial construction still reads student-level in the weaker passages.',
      },
      {
        criterion: 'Edge and focus control',
        maxLevel: 'Intermediate',
        reason: 'Edge hierarchy remains developing rather than advanced.',
      },
      {
        criterion: 'Surface and medium handling',
        maxLevel: 'Advanced',
        reason: 'Handling is credible and can stay in the advanced band.',
      },
      {
        criterion: 'Presence, point of view, and human force',
        maxLevel: 'Advanced',
        reason: 'Presence is strong enough to remain above the core structural caps.',
      },
    ],
    ...overrides,
  };
}

describe('applyCalibrationToCritique', () => {
  it('clamps category levels to deterministic caps while preserving anchored prose', () => {
    const critique = makeCritiqueResultFixture();
    const calibration = makeCalibrationFixture();

    const adjusted = applyCalibrationToCritique(critique, calibration);

    expect(
      adjusted.categories.find((category) => category.criterion === 'Composition and shape structure')!.level
    ).toBe('Intermediate');
    expect(
      adjusted.categories.find((category) => category.criterion === 'Color relationships')!.level
    ).toBe('Advanced');
    expect(adjusted.categories[1]!.phase2.criticsAnalysis).toContain(
      'foreground chair back around the sitter'
    );
    expect(adjusted.categories[1]!.phase3.teacherNextSteps).toContain(
      'foreground chair back around the sitter'
    );
  });

  it('forces low confidence and novice framing for novice-like work', () => {
    const critique = makeCritiqueResultFixture();
    const adjusted = applyCalibrationToCritique(
      critique,
      makeCalibrationFixture({ overallClass: 'novice_like' })
    );

    expect(adjusted.overallConfidence).toBe('low');
    expect(adjusted.overallSummary!.analysis).toMatch(/early-stage/i);
  });

  it('downshifts high confidence and overall framing for developing work', () => {
    const critique = makeCritiqueResultFixture();
    const adjusted = applyCalibrationToCritique(
      critique,
      makeCalibrationFixture({ overallClass: 'developing' })
    );

    expect(adjusted.overallConfidence).toBe('medium');
    expect(adjusted.categories.some((category) => category.confidence === 'medium')).toBe(true);
    expect(adjusted.categories.some((category) => category.confidence === 'high')).toBe(true);
    expect(adjusted.overallSummary!.analysis).toMatch(/mixed and in-progress/i);
  });

  it('keeps non-level prose stable when no cap change is needed', () => {
    const critique = makeCritiqueResultFixture();
    const calibration = makeCalibrationFixture({
      overallClass: 'competent_or_better',
      criterionCaps: critique.categories.map((category) => ({
        criterion: category.criterion,
        maxLevel: category.level!,
        reason: 'No clamp needed for this criterion.',
      })),
    });

    const adjusted = applyCalibrationToCritique(critique, calibration);

    expect(adjusted).toEqual(critique);
  });
});
