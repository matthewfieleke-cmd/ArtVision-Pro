import { describe, expect, it } from 'vitest';

import { CritiqueGroundingError, CritiqueValidationError } from './critiqueErrors';
import {
  makeCritiqueEvidenceFixture,
  makeCritiqueResultFixture,
  makeVoiceAStageFixture,
  makeVoiceBStageFixture,
} from './critiqueTestFixtures';
import {
  validateCritiqueGrounding,
  validateEvidenceResult,
  validateVoiceAStageOutput,
  validateVoiceBStageOutput,
} from './critiqueValidation';

describe('validateVoiceAStageOutput', () => {
  it('accepts a high-quality Voice A stage fixture', () => {
    expect(() =>
      validateVoiceAStageOutput(makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).not.toThrow();
  });

  it('accepts short evidence-signal paraphrases when they still point to the same visible passage', () => {
    const voiceA = makeVoiceAStageFixture();
    voiceA.categories[1] = {
      ...voiceA.categories[1]!,
      evidenceSignals: ['Middle slat cuts too hard.', 'Chair scaffold still holds.'],
    };

    expect(() =>
      validateVoiceAStageOutput(voiceA, makeCritiqueEvidenceFixture())
    ).not.toThrow();
  });

  it('rejects Voice A analysis that drifts away from anchored evidence', () => {
    const voiceA = makeVoiceAStageFixture();
    voiceA.summary = 'This painting creates a strong atmosphere.';
    voiceA.studioAnalysis.whatWorks = 'The painting effectively uses composition and value.';
    voiceA.categories[5] = {
      ...voiceA.categories[5]!,
      phase2: {
        criticsAnalysis: 'The focus could be stronger in places.',
      },
    };

    expect(() =>
      validateVoiceAStageOutput(voiceA, makeCritiqueEvidenceFixture())
    ).toThrow(CritiqueGroundingError);
  });
});

describe('validateEvidenceResult', () => {
  function neutralizeTopLevelEvidence() {
    const evidence = makeCritiqueEvidenceFixture();
    evidence.intentHypothesis =
      'The painting appears to organize the scene around a path, a small house, and bright flower bands.';
    evidence.strongestVisibleQualities = [
      'The path, roof, and flower bands are easy to locate in the image.',
      'The watercolor washes keep the sky, flowers, and path visibly separate in several passages.',
    ];
    evidence.comparisonObservations = [
      'The image uses broken color and soft watercolor edges across the path, house, and garden forms.',
    ];
    return evidence;
  }

  function neutralizeCompositionEvidence() {
    return {
      anchor: 'the foreground chair back around the sitter',
      visibleEvidence: [
        'The foreground chair back around the sitter cuts a tall vertical band through the center-left of the picture.',
        'The middle slat in the foreground chair back around the sitter cuts the route more abruptly than the outer silhouette.',
        'The outer chair silhouette leaves a wider gap above the shoulder than the middle slat does.',
        'The window strip at left, the chair back, and the sitter stack into three readable vertical bands.',
      ],
      strengthRead:
        'The foreground chair back around the sitter already gives the rectangle a strong vertical scaffold and a clear central interruption.',
      tensionRead:
        'The middle slat in the foreground chair back around the sitter interrupts the route too abruptly, so one shape pulls harder than the larger scaffold needs.',
      preserve: 'Preserve the three-band scaffold between window strip, chair back, and sitter.',
      confidence: 'high' as const,
    };
  }

  it('accepts minimal-abstraction surface anchors when visible evidence restates the same passage with equivalent concrete terms', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.criterionEvidence[6] = {
      ...evidence.criterionEvidence[6]!,
      criterion: 'Surface and medium handling',
      anchor: 'the uniform texture across the tilted square and background',
      visibleEvidence: [
        'The surface across the tilted square and surrounding ground stays almost equally smooth.',
        'The pale square edge against the off-white ground is slightly softer on one side than the other.',
        'The square and the field stay close in value even where the tilt is still legible.',
        'The paint surface shows only slight variation between the square interior and the outer ground.',
      ],
      strengthRead:
        'The near-uniform surface across the square and ground supports the painting’s restrained read.',
      tensionRead:
        'The square interior and the surrounding ground stay so similar in surface character that the tilt risks dissolving too evenly.',
      preserve: 'Preserve the quiet near-uniform surface across the square and the outer ground.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('rejects weak-work evidence that stays at painting-level summary language', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      anchor: 'the figure against the sunset',
      visibleEvidence: [
        'The figure against the sunset creates a strong focal point in the painting.',
        'The figure against the sunset suggests a clear story in the scene.',
        'The figure against the sunset adds atmosphere to the painting.',
        'The figure against the sunset provides balance to the landscape.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic/);
  });

  it('rejects evaluative weak-landscape anchors even when the evidence repeats them', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the arrangement of flowers in the foreground',
      visibleEvidence: [
        'The arrangement of flowers in the foreground forms a dense band across the lower edge.',
        'The arrangement of flowers in the foreground is cut by the path as it bends toward the house.',
        'The arrangement of flowers in the foreground sits below the fence and tree band.',
        'The arrangement of flowers in the foreground stays brighter than the path beside it.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Invalid evidence anchor/);
  });

  it('rejects conceptual anchors that name a route rather than a carrier relationship', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the path leading to the house',
      visibleEvidence: [
        'The path leading to the house narrows as it approaches the doorway.',
        'The path leading to the house passes between the flower band and the red wall.',
        'The path leading to the house stays lighter than the flower patch beside it.',
        'The path leading to the house bends just below the red roof.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Conceptual evidence anchor is too soft/);
  });

  it('rejects conceptual strength and preserve lines that slip into mood summary language', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the path bend where it meets the house shadow',
      visibleEvidence: [
        'The path bend where it meets the house shadow narrows sharply before the doorway.',
        'The path bend where it meets the house shadow is lighter than the flower patch beside it.',
        'The path bend where it meets the house shadow sits directly below the red wall.',
        'The path bend where it meets the house shadow is cut by a darker wash under the house.',
      ],
      strengthRead:
        'The path bend where it meets the house shadow creates a clear narrative journey through the painting.',
      preserve: 'Preserve the inviting warmth and sense of life in this passage.',
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/strengthRead is too generic|preserve is too generic/);
  });

  it('rejects flattering top-level evidence prose on weak work', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.intentHypothesis = 'The painting conveys a sense of whimsical charm and idyllic rural life.';
    evidence.strongestVisibleQualities = [
      'The vibrant color palette creates a lively atmosphere.',
      'The overall composition suggests a momentary impression of a garden scene.',
    ];
    evidence.comparisonObservations = ["The use of color is reminiscent of Monet's garden scenes."];

    expect(() => validateEvidenceResult(evidence)).toThrow(/too flattering or style-biased/);
  });

  it('neutralizes flattering comparison observations instead of failing the whole evidence payload', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.comparisonObservations = ["The use of color is reminiscent of Monet's garden scenes."];

    const validated = validateEvidenceResult(evidence);

    expect(validated.comparisonObservations).toEqual([
      'The image uses broken color and soft edges, but the structural control remains uneven.',
    ]);
  });

  it('rejects top-level evidence prose that stays too abstract even without explicit praise words', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.intentHypothesis = 'The painting appears to organize the scene around a gentle sense of place.';
    evidence.strongestVisibleQualities = [
      'The overall scene feels unified and calm.',
      'The composition holds together in a readable way.',
    ];
    evidence.comparisonObservations = ['The image generally aligns with an impressionistic landscape approach.'];

    expect(() => validateEvidenceResult(evidence)).toThrow(/too flattering or style-biased/);
  });

  it('rejects weak composition evidence that relies on stock composition praise', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path bend under the house',
      visibleEvidence: [
        'The path bend under the house creates dynamic tension in the composition.',
        'The house placement slightly off-center adds interest to the scene.',
        'The flowers and trees frame the path and guide the viewer’s eye.',
        'The fence lines create a sense of depth and balance.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic for Composition and shape structure/);
  });

  it('rejects composition evidence that names the anchor but not the structural event', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path bend under the house',
      visibleEvidence: [
        'The path bend under the house is the main compositional focus.',
        'The path bend under the house gives the painting a strong structure.',
        'The path bend under the house keeps the composition unified.',
        'The path bend under the house helps the viewer read the scene clearly.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic for Composition and shape structure/);
  });

  it('rejects composition evidence that slips back into balance and rhythm summary language', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path bend under the red house',
      visibleEvidence: [
        'The path bend under the red house narrows before the doorway and leaves a wider flower band on the left than on the right.',
        'The trees balance the house on the left, creating symmetry.',
        'The fence line creates a horizontal rhythm across the painting.',
        'The sun provides a counterbalance to the darker mass of the house.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic for Composition and shape structure/);
  });

  it('rejects composition evidence that describes strong lines or divisions without the visible difference they produce', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path bend under the red house',
      visibleEvidence: [
        'The path bend under the red house narrows before the doorway and leaves a wider flower band on the left than on the right.',
        'The house roof edge against the sky creates a strong horizontal line that anchors the composition.',
        'The fence line creates a horizontal division that balances the vertical tree shapes.',
        'The trees on the right create a vertical rhythm that contrasts with the horizontal path.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic for Composition and shape structure/);
  });

  it('accepts composition evidence built from line and division events when the passage stays concrete', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path bend under the red house',
      visibleEvidence: [
        'The path bend under the red house narrows before the doorway and leaves a wider flower band on the left than on the right.',
        'The fence line separates the garden from the sky and leaves a thinner blue strip above the roof than above the trees.',
        'The tree line on the right rises higher than the roof and creates a taller vertical division than the house mass does.',
        'The sun in the upper left sits above the fence line and leaves a larger open sky shape on the left than on the right.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });
});

describe('validateVoiceBStageOutput', () => {
  it('accepts a high-quality Voice B stage fixture', () => {
    expect(() =>
      validateVoiceBStageOutput(
        makeVoiceBStageFixture(),
        makeVoiceAStageFixture(),
        makeCritiqueEvidenceFixture()
      )
    ).not.toThrow();
  });

  it('accepts non-Master change verbs like integrate when the move stays specific', () => {
    const voiceB = makeVoiceBStageFixture();
    voiceB.categories[1] = {
      ...voiceB.categories[1]!,
      phase3: {
        teacherNextSteps:
          '1. In the foreground chair back around the sitter, integrate the middle slat more coherently with the larger chair scaffold so the eye can step to the head without losing the obstruction.',
      },
      actionPlanSteps: [
        {
          ...voiceB.categories[1]!.actionPlanSteps[0]!,
          move: 'integrate the middle slat more coherently with the larger chair scaffold',
        },
      ],
      voiceBPlan: {
        ...voiceB.categories[1]!.voiceBPlan,
        bestNextMove: 'integrate the middle slat more coherently with the larger chair scaffold',
      },
      editPlan: {
        ...voiceB.categories[1]!.editPlan,
        intendedChange: 'integrate the middle slat more coherently with the larger chair scaffold',
      },
    };

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).not.toThrow();
  });

  it('rejects generic, location-free teacher guidance', () => {
    const voiceB = makeVoiceBStageFixture();
    voiceB.categories[5] = {
      ...voiceB.categories[5]!,
      phase3: {
        teacherNextSteps: '1. Improve the focus where needed across the painting.',
      },
      actionPlanSteps: [
        {
          ...voiceB.categories[5]!.actionPlanSteps[0]!,
          area: 'focus hierarchy',
          currentRead: 'the focus could be stronger overall',
          move: 'improve the focus where needed',
        },
      ],
      voiceBPlan: {
        ...voiceB.categories[5]!.voiceBPlan,
        currentRead: 'the focus could be stronger overall',
        bestNextMove: 'improve the focus where needed',
      },
      editPlan: {
        ...voiceB.categories[5]!.editPlan,
        targetArea: 'focus hierarchy',
        issue: 'the focus could be stronger overall',
        intendedChange: 'improve the focus where needed',
      },
    };

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).toThrow(CritiqueValidationError);
  });

  it('rejects edge coaching that names focus improvement but not an edge relationship', () => {
    const voiceB = makeVoiceBStageFixture();
    voiceB.categories[4] = {
      ...voiceB.categories[4]!,
      phase3: {
        teacherNextSteps:
          '1. In the pale square against the off-white ground, improve the focus hierarchy so the form reads more clearly.',
      },
      plan: {
        ...voiceB.categories[4]!.plan!,
        move: 'improve the focus hierarchy so the form reads more clearly',
      },
    };

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).toThrow(CritiqueValidationError);
  });

  it('rejects duplicated criterion coaching across the teaching plan', () => {
    const voiceB = makeVoiceBStageFixture();
    const duplicated = {
      ...voiceB.categories[5]!,
      criterion: 'Surface and medium handling' as const,
    };
    voiceB.categories[6] = duplicated;

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).toThrow(CritiqueValidationError);
  });

  it('rejects teaching moves that drift away from the anchored passage', () => {
    const voiceB = makeVoiceBStageFixture();
    voiceB.categories[1] = {
      ...voiceB.categories[1]!,
      phase3: {
        teacherNextSteps:
          '1. In the figure standing near the boat, adjust the silhouette so it integrates more clearly with the shoreline.',
      },
      plan: {
        ...voiceB.categories[1]!.plan!,
        move: 'adjust the figure standing near the boat so it integrates more clearly with the shoreline',
        expectedRead: 'the figure sits more naturally in the shoreline space',
      },
    };

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).toThrow(/drifted away from the anchored passage/);
  });
});

describe('validateCritiqueGrounding', () => {
  it('accepts a merged critique fixture that stays traceable to evidence', () => {
    expect(() =>
      validateCritiqueGrounding(makeCritiqueResultFixture(), makeCritiqueEvidenceFixture())
    ).not.toThrow();
  });

  it('rejects final critique drift after merge', () => {
    const critique = makeCritiqueResultFixture();
    critique.categories[2] = {
      ...critique.categories[2]!,
      phase2: {
        criticsAnalysis: 'The palette feels pleasant and unified.',
      },
      phase3: {
        teacherNextSteps: '1. Add more color variation to improve the realism.',
      },
      editPlan: {
        ...critique.categories[2]!.editPlan!,
        issue: 'the palette needs more life overall',
      },
    };

    expect(() =>
      validateCritiqueGrounding(critique, makeCritiqueEvidenceFixture())
    ).toThrow(CritiqueGroundingError);
  });

  it('rejects final teacher guidance when it switches to a different passage than the anchor', () => {
    const critique = makeCritiqueResultFixture();
    critique.categories[4] = {
      ...critique.categories[4]!,
      phase3: {
        teacherNextSteps:
          '1. In the foreground figure near the boat, soften the silhouette into the shoreline so the scene feels more unified.',
      },
      plan: {
        ...critique.categories[4]!.plan!,
        move: 'soften the foreground figure near the boat into the shoreline',
      },
    };

    expect(() =>
      validateCritiqueGrounding(critique, makeCritiqueEvidenceFixture())
    ).toThrow(/anchored passage/);
  });
});
