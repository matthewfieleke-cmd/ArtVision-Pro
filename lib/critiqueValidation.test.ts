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
import { hasNeutralWeakWorkTopLevelText } from './critiqueWeakWorkContracts';

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

  it('rejects conceptual visibleEvidence that repeats the anchor but only states interpretive effect', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the path leading to the house',
      visibleEvidence: [
        'The path leading to the house creates a directional flow through the painting.',
        'The path leading to the house draws attention to the structure.',
        'The path leading to the house gives the scene a welcoming sense of arrival.',
        'The path leading to the house emphasizes the importance of the house.',
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

  it('accepts conceptual route anchors when the evidence keeps the route visually specific', () => {
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

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
    expect(() => validateEvidenceResult(evidence, { mode: 'lenient' })).not.toThrow();
  });

  it('accepts recoverable soft conceptual anchors in lenient mode when visible evidence contains a concrete carrier passage', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the diagonal alignment of telegraph poles',
      visibleEvidence: [
        "The telegraph poles lean diagonally against the train's path and repeat that push across the scene.",
        "The smoke trail above the engine follows the train's path against the pale sky and keeps the motion visible.",
        "The engine stays darkest where the train's path meets the pale sky, so that passage holds the pressure.",
        "The leaning poles beside the engine tilt harder than the roofline, making the directional force legible in one passage.",
      ],
      strengthRead:
        "The telegraph poles leaning against the train's path make the directional force legible rather than merely described.",
      preserve:
        "Preserve the telegraph poles against the train's path as the passage carrying the directional pressure.",
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Conceptual evidence anchor is too soft/);
    expect(() => validateEvidenceResult(evidence, { mode: 'lenient' })).not.toThrow();
  });

  it('accepts conceptual anchors built from concrete visible carriers like a reflection in water', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: "the sun's reflection in the water",
      visibleEvidence: [
        "The sun's reflection in the water forms a bright vertical streak below the sun.",
        "The sun's reflection in the water breaks into shorter orange marks across the blue-gray harbor.",
        "The boats sit to one side of the sun's reflection in the water, leaving the bright passage exposed.",
        "The sun's reflection in the water stays brighter than the surrounding harbor wash.",
      ],
      strengthRead:
        "The sun's reflection in the water is the concrete carrier that makes the dawn read immediate rather than merely described.",
      preserve:
        "Preserve the sun's reflection in the water as the passage that carries the painting's felt arrival of light.",
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts flower-based conceptual anchors when the evidence keeps the visible relation concrete', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the flowers against the green background',
      visibleEvidence: [
        'The flowers against the green background stay lighter than the leaves behind them, so the bouquet reads first.',
        'The flowers against the green background bunch tighter near the vase rim and open wider near the top edge.',
        'The vase shoulder below the flowers against the green background keeps the bouquet tied to the table instead of floating loose.',
        'The darker leaf band behind the flowers against the green background breaks around the petals and keeps the bouquet legible.',
      ],
      strengthRead:
        'The flowers against the green background are the visible carrier that makes the bouquet read as the painting’s main pressure point.',
      preserve:
        'Preserve the flowers against the green background as the passage that keeps the bouquet legible and forward.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts figure-in-landscape presence evidence when the human carrier stays physical and repeated', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[7] = {
      ...evidence.criterionEvidence[7]!,
      criterion: 'Presence, point of view, and human force',
      anchor: 'the small dark figure against the pale shore',
      visibleEvidence: [
        'The small dark figure against the pale shore sits just below the leaning tree and reads as the clearest human carrier in the scene.',
        'The small dark figure against the pale shore stays darker than the light sand behind it, so the body holds together at a distance.',
        'The leaning tree trunk rises just behind the small dark figure against the pale shore and keeps the figure from floating loose in the open water band.',
        'A second figure farther right is lighter and less insistent, leaving the small dark figure against the pale shore to carry the main human pressure.',
      ],
      strengthRead:
        'The small dark figure against the pale shore gives the landscape a specific human address because that body stays legible against the lighter ground.',
      preserve:
        'Preserve the small dark figure against the pale shore as the passage that carries the painting\'s human pressure.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts train-based conceptual anchors when the carrier stays physical and repeated', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[7] = {
      ...evidence.criterionEvidence[7]!,
      criterion: 'Presence, point of view, and human force',
      anchor: "the train's diagonal path across the canvas",
      visibleEvidence: [
        "The train's diagonal path across the canvas cuts through the flatter ground bands and drives the scene forward.",
        "The leaning telegraph poles repeat the train's diagonal path across the canvas and intensify that push.",
        "The smoke trail follows the train's diagonal path across the canvas and keeps the motion visible above the roofline.",
        "The front of the train stays darkest where the train's diagonal path across the canvas meets the pale sky, so the engine holds the pressure.",
      ],
      strengthRead:
        "The train's diagonal path across the canvas is the physical carrier that makes the scene feel driven rather than merely described.",
      preserve:
        "Preserve the train's diagonal path across the canvas as the passage that carries the scene's force.",
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('rejects train-led conceptual summaries that name movement instead of a physical carrier passage', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[7] = {
      ...evidence.criterionEvidence[7]!,
      criterion: 'Presence, point of view, and human force',
      anchor: 'the movement of the train',
      visibleEvidence: [
        'The movement of the train creates momentum across the whole scene.',
        'The movement of the train makes the image feel dramatic and fast.',
        'The telegraph poles add speed and rhythm to that movement.',
        'The smoke reinforces the energetic motion of the train.',
      ],
      strengthRead: 'The movement of the train gives the painting urgency and excitement.',
      preserve: 'Preserve the speed and drama of the train.',
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Conceptual evidence anchor is too soft|Visible evidence is too generic|strengthRead is too generic|preserve is too generic/);
  });

  it('rejects figure-led conceptual summaries that name emotion or personality instead of the carrier passage', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[7] = {
      ...evidence.criterionEvidence[7]!,
      criterion: 'Presence, point of view, and human force',
      anchor: 'the emotional pose of the sitter',
      visibleEvidence: [
        'The emotional pose of the sitter creates a contemplative mood.',
        'The pose adds personality and drama to the figure.',
        'The body language makes the sitter feel vulnerable.',
        'The overall posture communicates strong emotion.',
      ],
      strengthRead: 'The emotional pose of the sitter gives the painting personality.',
      preserve: 'Preserve the contemplative emotion in the pose.',
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Conceptual evidence anchor is too soft|Visible evidence is too generic|strengthRead is too generic|preserve is too generic/);
  });

  it('accepts bridge-based conceptual anchors when concrete visible lines support the carrier relationship', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the bridge rail against the bright background',
      visibleEvidence: [
        'The bridge rail against the bright background cuts diagonally upward and stays darker than the color field behind it.',
        'The bridge rail against the bright background keeps the passage directional because the far end narrows as it reaches the hotter orange band.',
        'The darker bridge support below the bridge rail against the bright background holds the diagonal to the ground instead of letting it float loose.',
        'The foliage on both sides of the bridge rail against the bright background breaks into softer shapes, so the hard rail carries the directional pressure.',
      ],
      strengthRead:
        'The bridge rail against the bright background is the physical carrier that keeps the directional push visible instead of merely decorative.',
      preserve: 'Preserve the bridge rail against the bright background as the passage carrying that directional push.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
    expect(() => validateEvidenceResult(evidence, { mode: 'lenient' })).not.toThrow();
  });

  it('rejects object-study conceptual anchors that describe theme or elegance instead of a physical carrier', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the elegance of the bottle',
      visibleEvidence: [
        'The elegance of the bottle suggests a refined and graceful object.',
        'The elegance of the bottle is reinforced by the clean outline and smooth shading.',
        'The elegance of the bottle adds a decorative note to the study.',
        'The elegance of the bottle keeps the object feeling polished.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Conceptual evidence anchor is too soft/);
  });

  it('accepts object-study conceptual anchors when the carrier stays on a concrete bottle passage', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the floral label on the glass bottle',
      visibleEvidence: [
        'The floral label on the glass bottle sits inside the clear body and stays centered below the pump.',
        'The floral label on the glass bottle stays darker than the pale liquid behind it, so the motif remains legible through the glass.',
        'The pump head above the floral label on the glass bottle introduces a mechanical countershape to the softer petals below.',
        'The bottle shoulder curves around the floral label on the glass bottle and keeps the decoration tied to the container instead of floating loose.',
      ],
      strengthRead:
        'The floral label on the glass bottle is the physical carrier that keeps the object from reading as a blank container.',
      preserve:
        'Preserve the floral label on the glass bottle as the passage that carries the object’s decorative pressure.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts cafe-scene conceptual anchors when tables and umbrellas stay the repeated visible carrier', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      ...neutralizeCompositionEvidence(),
      criterion: 'Composition and shape structure',
    };
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the cafe tables with yellow umbrellas',
      visibleEvidence: [
        'The cafe tables with yellow umbrellas sit in the center and stay framed by the darker tree trunks on both sides.',
        'The path narrows as it approaches the cafe tables with yellow umbrellas and leaves a wider open ground shape on the left than on the right.',
        'The building arches line up behind the cafe tables with yellow umbrellas and keep that cluster tied to the wall instead of floating loose.',
        'The seated figures under the cafe tables with yellow umbrellas stay smaller than the umbrellas above them, so the shelter shape carries the scene first.',
      ],
      strengthRead:
        'The cafe tables with yellow umbrellas are the physical carrier that makes the social focus read immediately rather than as a vague outdoor mood.',
      preserve:
        'Preserve the cafe tables with yellow umbrellas as the centered cluster that keeps the seated figures tied to the wall and path.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
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

  it('accepts concrete harbor-scene nouns as neutral top-level evidence language', () => {
    expect(
      hasNeutralWeakWorkTopLevelText(
        'The painting appears to organize the scene around a low sun, a few boats, and the reflection crossing the harbor water.'
      )
    ).toBe(true);
  });

  it('accepts top-level strongest-visible-qualities language that stays visual for an impressionist harbor scene', () => {
    expect(
      hasNeutralWeakWorkTopLevelText(
        'The soft edges, loose brushwork, and warm-cool palette keep the harbor water and sky in one atmospheric field.'
      )
    ).toBe(true);
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

  it('rejects object-study composition evidence that stays at centered/stable verdict language', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the pump head against the bottle neck',
      visibleEvidence: [
        'The pump head against the bottle neck is centered and creates a stable arrangement.',
        'The bottle body feels balanced under the pump head.',
        'The bottle silhouette is well-placed on the page.',
        'The vertical arrangement keeps the object organized.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic for Composition and shape structure/);
  });

  it('accepts architectural composition evidence when roof, windows, and door are described as concrete events', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the roofline above the lit windows',
      visibleEvidence: [
        'The roofline above the lit windows steps down toward the porch and leaves a taller dark sky wedge on the left than on the right.',
        'The lit window stack under the roofline above the lit windows lands slightly right of center and leaves a wider wall strip beside the red door.',
        'The red door sits below the roofline above the lit windows and interrupts the blue facade as a narrower vertical accent than the windows.',
        'The snow band crosses in front of the house and leaves the lower wall visible longer on the right side than on the left.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts house-scene conceptual interpretation when it stays tied to a concrete entrance passage', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the red door under the lit window',
      visibleEvidence: [
        'The red door under the lit window sits below the brightest window stack and interrupts the blue wall as a narrower vertical accent.',
        'The red door under the lit window stays warmer than the snow band around it, so the entrance holds together against the cooler ground.',
        'The porch roof drops just above the red door under the lit window and compresses that entrance passage against the facade.',
        'The snow band crosses in front of the red door under the lit window and leaves only a short dark threshold visible.',
      ],
      strengthRead:
        'The red door under the lit window creates a welcoming holiday mood for the whole house.',
      preserve:
        'Preserve the welcoming festive atmosphere around the entrance.',
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts harbor-scene composition evidence when it names concrete structural elements and events', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: "the boat's silhouette against the water",
      visibleEvidence: [
        "The boat's silhouette against the water anchors the lower foreground just left of the sun's reflection.",
        "The sun's reflection intersects the horizontal water bands and leaves a brighter vertical track than the nearby harbor water.",
        'The distant masts echo the reflection as slimmer verticals above the horizon band.',
        'The horizon line sits high enough to leave a larger water field below than sky above.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts cafe-scene composition evidence when it names path, tables, and arch events concretely', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the path narrowing into the cafe tables',
      visibleEvidence: [
        'The path narrowing into the cafe tables leaves a wider pale ground shape on the left than on the right before it reaches the seated group.',
        'The dark tree trunks cut down on both sides of the path narrowing into the cafe tables and keep the opening compressed around the center.',
        'The nearest building arch lands just behind the cafe tables and repeats their curve higher up the wall.',
        'The yellow umbrellas sit above the seated figures and create a broader horizontal cap than the table band below.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('accepts harbor-scene composition evidence that uses concrete structure plus light shorthand', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: "the boat's silhouette against the water",
      visibleEvidence: [
        "The boat's silhouette against the water is positioned slightly off-center in the lower field.",
        "The vertical reflection of the sun aligns with the boat, guiding the viewer's eye through the harbor water.",
        'The distant masts echo the reflection as slimmer verticals above the horizon band.',
        'The water ripples contrast with the vertical reflection, leaving a different directional pull on each side.',
      ],
    };

    expect(() => validateEvidenceResult(evidence)).not.toThrow();
  });

  it('allows final-retry lenient mode to keep concrete-but-shorthand landscape composition evidence', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[1] = {
      ...evidence.criterionEvidence[1]!,
      criterion: 'Composition and shape structure',
      anchor: 'the tree branches against the sky',
      visibleEvidence: [
        'The tree branches create a dynamic diagonal across the sky, leading the eye upward.',
        'The seated figure and tree trunk form a vertical axis on the right side of the painting.',
        'The rocky shoreline creates a horizontal band that anchors the composition.',
        'The clouds form a sweeping curve that echoes the tree branches.',
      ],
      strengthRead:
        'The tree branches create a dynamic diagonal across the sky that keeps the upper field active.',
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/Visible evidence is too generic/);
    expect(() => validateEvidenceResult(evidence, { mode: 'lenient' })).not.toThrow();
  });

  it('allows final-retry lenient mode to keep concrete figure-in-landscape conceptual shorthand', () => {
    const evidence = neutralizeTopLevelEvidence();
    evidence.criterionEvidence[0] = {
      ...evidence.criterionEvidence[0]!,
      criterion: 'Intent and necessity',
      anchor: 'the seated figure against the rocky shoreline',
      visibleEvidence: [
        "The seated figure's yellow clothing contrasts with the dark rocks and keeps the body legible.",
        'The seated figure against the rocky shoreline stays lower than the standing figure and reads as the quieter human carrier.',
        'The tree trunk rises just behind the seated figure against the rocky shoreline and keeps that body from floating loose.',
        'A second figure farther right is lighter and less insistent, leaving the seated figure against the rocky shoreline to carry the main human address.',
      ],
      strengthRead:
        "The seated figure's integration with the rocky shoreline creates a cohesive narrative moment.",
      preserve:
        'Preserve the seated figure against the rocky shoreline as the passage that carries the painting’s human address.',
    };

    expect(() => validateEvidenceResult(evidence)).toThrow(/strengthRead is too generic/);
    expect(() => validateEvidenceResult(evidence, { mode: 'lenient' })).not.toThrow();
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
    const baseCategory = voiceB.categories[1]!;
    const baseStep = baseCategory.actionPlanSteps?.[0];
    const basePlan = baseCategory.voiceBPlan;
    const baseEditPlan = baseCategory.editPlan;
    if (!baseStep || !basePlan || !baseEditPlan) {
      throw new Error('Expected canonical fixture to include legacy Voice B compatibility fields.');
    }
    voiceB.categories[1] = {
      ...baseCategory,
      phase3: {
        teacherNextSteps:
          '1. In the foreground chair back around the sitter, integrate the middle slat more coherently with the larger chair scaffold so the eye can step to the head without losing the obstruction.',
      },
      actionPlanSteps: [
        {
          ...baseStep,
          move: 'integrate the middle slat more coherently with the larger chair scaffold',
        },
      ],
      voiceBPlan: {
        ...basePlan,
        bestNextMove: 'integrate the middle slat more coherently with the larger chair scaffold',
      },
      editPlan: {
        ...baseEditPlan,
        intendedChange: 'integrate the middle slat more coherently with the larger chair scaffold',
      },
    };

    expect(() =>
      validateVoiceBStageOutput(voiceB, makeVoiceAStageFixture(), makeCritiqueEvidenceFixture())
    ).not.toThrow();
  });

  it('rejects generic, location-free teacher guidance', () => {
    const voiceB = makeVoiceBStageFixture();
    const baseCategory = voiceB.categories[5]!;
    const baseStep = baseCategory.actionPlanSteps?.[0];
    const basePlan = baseCategory.voiceBPlan;
    const baseEditPlan = baseCategory.editPlan;
    if (!baseStep || !basePlan || !baseEditPlan) {
      throw new Error('Expected canonical fixture to include legacy Voice B compatibility fields.');
    }
    voiceB.categories[5] = {
      ...baseCategory,
      phase3: {
        teacherNextSteps: '1. Improve the focus where needed across the painting.',
      },
      actionPlanSteps: [
        {
          ...baseStep,
          area: 'focus hierarchy',
          currentRead: 'the focus could be stronger overall',
          move: 'improve the focus where needed',
        },
      ],
      voiceBPlan: {
        ...basePlan,
        currentRead: 'the focus could be stronger overall',
        bestNextMove: 'improve the focus where needed',
      },
      editPlan: {
        ...baseEditPlan,
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
