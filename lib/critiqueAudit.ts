import type {
  CritiqueCategoryDTO,
  CritiqueResultDTO,
  CritiqueSimpleFeedbackDTO,
} from './critiqueTypes.js';

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function simpleStudioReadText(simple: CritiqueSimpleFeedbackDTO | undefined): string {
  if (!simple) return '';
  return normalizeWhitespace(
    [
      simple.studioAnalysis.whatWorks,
      simple.studioAnalysis.whatCouldImprove,
      ...simple.studioChanges.map((c) => c.text),
    ].join(' ')
  );
}

function rewriteGenericWhatCouldImprove(whatCouldImprove: string, whatWorks: string): string {
  const text = normalizeWhitespace(whatCouldImprove);
  const genericPatterns = [
    /lack of a clear focal point/i,
    /stronger focal point/i,
    /spatial definition/i,
    /more dynamic integration/i,
    /lacks cohesion/i,
    /lacks clear spatial definition/i,
  ];
  if (!containsAny(text, genericPatterns)) return whatCouldImprove;

  const positive = normalizeWhitespace(whatWorks);

  if (/(atmosphere|soft|mist|harmony|tranquil|calm|serene|glow)/i.test(positive + ' ' + text)) {
    return 'What could improve is not a lack of drama; it is that one or two relationships inside the existing calm are not yet fully decided, so the painting can read slightly diffuse instead of deliberate.';
  }

  if (/(distributed|all-over|energy|movement|dynamic|vibrant)/i.test(positive + ' ' + text)) {
    return 'What could improve is not that the work needs one dominant focal point; it is that a few competing accents are equally loud, so the eye does not quite know which relationship matters most.';
  }

  return 'What could improve is not simply that the painting needs more focus; it is that the current structure does not yet fully separate what should lead from what should support.';
}

function rewriteGenericStep(step: string, contextA: string, contextB: string): string {
  const text = normalizeWhitespace(step);
  const context = `${contextA} ${contextB}`;

  if (/continue exploring/i.test(text)) {
    if (/(atmosphere|distance|background|mountain|mist|soft)/i.test(text + ' ' + context)) {
      return 'On the next pass, deepen the distance by softening one background edge and separating one mountain or sky shape with a smaller temperature or value shift.';
    }
    return 'On the next pass, replace the most generic repeated move with one specific adjustment to shape, edge, or value in the passage that is still undecided.';
  }

  if (/increase contrast/i.test(text) && /(atmosphere|mist|soft|calm|serene|glow|compression)/i.test(context)) {
    return 'Keep the current value compression, but separate just one important shape from its neighbor with a smaller value or temperature shift instead of a broad contrast increase.';
  }

  if (/(stronger focal point|bring it forward|create a focal point)/i.test(text) && /(distributed|movement|all-over|energy|atmosphere)/i.test(context)) {
    return 'Do not force a single dominant focal point; instead, quiet the one competing accent that keeps the eye from moving naturally through the painting.';
  }

  if (/refine edges|sharpen/i.test(text) && /(soft|atmosphere|mist|glow|tranquil|serene)/i.test(context)) {
    return 'Keep most of the softness that gives the painting atmosphere, but sharpen only the one edge that needs to hold the eye briefly before it moves on.';
  }

  if (/more depth|spatial clarity|separate planes/i.test(text) && /(atmosphere|tranquil|mist|soft)/i.test(context)) {
    return 'Preserve the current softness of space, but clarify one foreground-to-midground relationship so the depth reads by contrast of role, not by over-definition.';
  }

  return step;
}

function toneDownOverpraise(
  critique: CritiqueResultDTO
): CritiqueResultDTO {
  const allMaster = critique.categories.length > 0 && critique.categories.every((category) => category.level === 'Master');
  if (!allMaster) return critique;

  const simple = critique.simpleFeedback;
  const studioText = simpleStudioReadText(simple);
  const hasNoIssueLanguage = Boolean(
    simple &&
      containsAny(simple.studioAnalysis.whatCouldImprove + ' ' + studioText, [
        /no significant issues/i,
        /strong across all evaluated criteria/i,
        /successfully achieves/i,
      ])
  );

  if (!hasNoIssueLanguage) return critique;

  const softenedCategories = critique.categories.map((category) => {
    if (
      category.criterion === 'Intent and necessity' ||
      category.criterion === 'Drawing, proportion, and spatial form'
    ) {
      return {
        ...category,
        level: 'Advanced' as const,
      };
    }
    return category;
  });

  const softenedImprove = simple
    ? /no significant issues/i.test(simple.studioAnalysis.whatCouldImprove)
      ? 'The painting is strong overall; the most useful next move is to protect what is already working while identifying one visible relationship that could become more deliberate.'
      : simple.studioAnalysis.whatCouldImprove
    : undefined;

  return {
    ...critique,
    categories: softenedCategories,
    ...(simple && softenedImprove
      ? {
          simpleFeedback: {
            ...simple,
            studioAnalysis: {
              ...simple.studioAnalysis,
              whatCouldImprove: softenedImprove,
            },
          },
        }
      : {}),
  };
}

function inferNoviceSignalCount(critique: CritiqueResultDTO): number {
  const text = normalizeWhitespace(
    [
      critique.summary,
      simpleStudioReadText(critique.simpleFeedback),
      ...critique.categories.flatMap((category) => [
        category.feedback,
        category.actionPlan,
        ...(category.evidenceSignals ?? []),
        category.preserve ?? '',
      ]),
    ].join(' ')
  );

  const patterns = [
    /childlike|child-like|second grader|second-grade|elementary/i,
    /children'?s drawing|childhood|innocence|nostalgia/i,
    /simplified forms?|simple shapes|basic shapes|readable big shapes|straightforward perspective/i,
    /lack of depth|lack of perspective|flat spacing|flat scene|naive spacing|symbol-like/i,
    /cheerful mood|playful theme|domestic, playful theme/i,
    /bright local color|bright, flat colors|primary colors dominate/i,
    /easy to read|clear and easy to interpret/i,
    /stylized|simplified and distorted|expression over realism/i,
    /whimsical|playful visual interest/i,
    /focus on simplicity/i,
    /soft edges are used throughout|focus is evenly distributed across the scene/i,
    /the path provides a sense of perspective|spatial depth is suggested/i,
  ];

  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function capInflatedRatingsForNoviceLikeWork(
  critique: CritiqueResultDTO
): CritiqueResultDTO {
  const noviceSignals = inferNoviceSignalCount(critique);
  if (noviceSignals < 2) return critique;

  const softenedCategories = critique.categories.map((category) => {
    if (noviceSignals >= 4 && category.level === 'Master') {
      return {
        ...category,
        level: 'Beginner' as const,
      };
    }

    if (noviceSignals >= 6 && category.level === 'Advanced') {
      return {
        ...category,
        level: 'Beginner' as const,
      };
    }

    if (noviceSignals >= 4 && category.level === 'Advanced') {
      return {
        ...category,
        level:
          category.criterion === 'Intent and necessity' ||
          category.criterion === 'Presence, point of view, and human force' ||
          category.criterion === 'Drawing, proportion, and spatial form' ||
          category.criterion === 'Edge and focus control'
            ? ('Beginner' as const)
            : ('Intermediate' as const),
      };
    }

    if (category.level === 'Master') {
      return {
        ...category,
        level: 'Intermediate' as const,
      };
    }

    if (category.level === 'Advanced') {
      return {
        ...category,
        level: 'Intermediate' as const,
      };
    }

    return category;
  });

  const simple = critique.simpleFeedback;
  return {
    ...critique,
    categories: softenedCategories,
    overallConfidence:
      critique.overallConfidence === 'high'
        ? noviceSignals >= 4
          ? 'low'
          : 'medium'
        : critique.overallConfidence,
    ...(simple
      ? {
          simpleFeedback: {
            ...simple,
            studioAnalysis: {
              ...simple.studioAnalysis,
              whatCouldImprove:
                noviceSignals >= 4
                  ? 'What could improve is that the picture is still working with simple, early-stage decisions: the subject is readable, but drawing, spatial logic, value grouping, and edge control are still at a beginner-to-intermediate stage rather than an advanced one.'
                  : 'What could improve is that the picture is still working at a simple, early-stage level: the big shapes read, but drawing, value grouping, and edge control are not yet developed enough to support higher ratings.',
            },
          },
        }
      : {}),
  };
}

function inferUnderdevelopedSignalCount(critique: CritiqueResultDTO): number {
  const text = normalizeWhitespace(
    [
      critique.summary,
      simpleStudioReadText(critique.simpleFeedback),
      ...critique.categories.flatMap((category) => [
        category.feedback,
        category.actionPlan,
        ...(category.evidenceSignals ?? []),
        category.preserve ?? '',
      ]),
    ].join(' ')
  );

  const patterns = [
    /expression over precision|suggested rather than defined/i,
    /lack of strong shadows|no single focal point|soft edges.*distributed focus/i,
    /playful|whimsical|inviting and lively/i,
    /loose brushwork|loosely drawn|simplification/i,
    /straightforward perspective|easy to interpret|balanced composition/i,
    /refine spatial relationships|improve clarity|enhance depth perception/i,
    /supports the painting's playful nature|supports the whimsical style/i,
    /vibrant colors enhance the mood|soft light effect|soft transitions/i,
    /drawn loosely|expression over realism|emphasizing expression over precision/i,
    /slight adjustments could enhance depth|could be refined to enhance/i,
  ];

  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function capInflatedRatingsForUnderdevelopedWork(
  critique: CritiqueResultDTO
): CritiqueResultDTO {
  const intermediateOrBelowCount = critique.categories.filter(
    (category) => category.level === 'Intermediate' || category.level === 'Beginner'
  ).length;
  const advancedOrAboveCount = critique.categories.filter(
    (category) => category.level === 'Advanced' || category.level === 'Master'
  ).length;
  const underdevelopedSignals = inferUnderdevelopedSignalCount(critique);

  if (intermediateOrBelowCount < 2 || advancedOrAboveCount < 4 || underdevelopedSignals < 2) {
    return critique;
  }

  const text = normalizeWhitespace(
    [
      critique.summary,
      simpleStudioReadText(critique.simpleFeedback),
      ...critique.categories.flatMap((category) => [
        category.feedback,
        ...(category.evidenceSignals ?? []),
      ]),
    ].join(' ')
  );
  const watercolorLikeWeakness = containsAny(text, [
    /whimsical|playful|inviting and lively/i,
    /soft transitions|soft light effect|vibrant colors enhance the mood/i,
    /drawn loosely|suggested rather than defined|expression over precision/i,
    /lack of strong shadows|no single focal point/i,
    /bright color palette|loose brushwork typical of impressionism/i,
    /captures a whimsical and colorful garden scene/i,
    /focus on mood and atmosphere/i,
    /arrangement of flowers and trees/i,
    /distributed focus across the scene/i,
    /watercolor medium is used effectively to create soft transitions/i,
  ]);

  const softenedCategories = critique.categories.map((category) => {
    if (!watercolorLikeWeakness && category.criterion === 'Surface and medium handling') {
      return {
        ...category,
        level: 'Intermediate' as const,
      };
    }

    return {
      ...category,
      level: 'Beginner' as const,
    };
  });

  const simple = critique.simpleFeedback;
  return {
    ...critique,
    categories: softenedCategories,
    overallConfidence: 'low',
    ...(simple
      ? {
          simpleFeedback: {
            ...simple,
            studioAnalysis: {
              ...simple.studioAnalysis,
              whatCouldImprove:
                'What could improve is that the painting is still underdeveloped in the fundamentals: the image is readable, but drawing, space, value, and edge decisions remain too loose to support advanced ratings.',
            },
          },
        }
      : {}),
  };
}

const LEVEL_RANK = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
} as const;

const FUNDAMENTAL_CRITERIA = new Set([
  'Composition and shape structure',
  'Value and light structure',
  'Drawing, proportion, and spatial form',
  'Edge and focus control',
]);

function capInflatedRatingsWhenFundamentalsAreWeak(
  critique: CritiqueResultDTO
): CritiqueResultDTO {
  const coreCategories = critique.categories.filter((category) =>
    FUNDAMENTAL_CRITERIA.has(category.criterion)
  );
  const weakCoreCount = coreCategories.filter(
    (category) => LEVEL_RANK[category.level] <= LEVEL_RANK.Intermediate
  ).length;
  const advancedOrAboveCount = critique.categories.filter(
    (category) => LEVEL_RANK[category.level] >= LEVEL_RANK.Advanced
  ).length;
  const hasCoreBeginner = coreCategories.some(
    (category) => category.level === 'Beginner'
  );
  const underdevelopedSignals = inferUnderdevelopedSignalCount(critique);
  const noviceSignals = inferNoviceSignalCount(critique);
  const poorPhoto = critique.photoQuality?.level === 'fair' || critique.photoQuality?.level === 'poor';

  if (weakCoreCount < 3 || advancedOrAboveCount < 4) return critique;

  const aggressive = poorPhoto || underdevelopedSignals >= 3 || noviceSignals >= 4;

  const softenedCategories = critique.categories.map((category) => {
    if (LEVEL_RANK[category.level] <= LEVEL_RANK.Intermediate) return category;

    if (!aggressive) {
      return {
        ...category,
        level: 'Intermediate' as const,
      };
    }

    if (
      category.criterion === 'Color relationships' ||
      category.criterion === 'Surface and medium handling'
    ) {
      return {
        ...category,
        level: 'Intermediate' as const,
      };
    }

    return {
      ...category,
      level:
        hasCoreBeginner ||
        category.criterion === 'Intent and necessity' ||
        category.criterion === 'Presence, point of view, and human force'
          ? ('Beginner' as const)
          : ('Intermediate' as const),
    };
  });

  const simple = critique.simpleFeedback;
  return {
    ...critique,
    categories: softenedCategories,
    overallConfidence: aggressive ? 'low' : critique.overallConfidence === 'high' ? 'medium' : critique.overallConfidence,
    ...(simple
      ? {
          simpleFeedback: {
            ...simple,
            studioAnalysis: {
              ...simple.studioAnalysis,
              whatCouldImprove:
                'The fundamentals are not yet strong enough to justify high ratings across the board: composition, value, drawing, and edge control still need clearer decisions before the more expressive qualities can carry the work.',
            },
          },
        }
      : {}),
  };
}

function rewriteMediumInsensitiveStep(step: string, critique: CritiqueResultDTO): string {
  const text = normalizeWhitespace(step);
  const medium = critique.summary + ' ' + simpleStudioReadText(critique.simpleFeedback);

  if (/subtle color variations/i.test(text) && /drawing/i.test(medium)) {
    return 'Instead of adding color, use pressure, edge weight, and value grouping to deepen the mood without weakening the drawing medium.';
  }

  if (/brushwork techniques/i.test(text) && /pastel/i.test(medium)) {
    return 'Use changes in pastel stroke direction, pressure, and layering to vary surface energy instead of treating the medium like oil brushwork.';
  }

  if (/line thickness/i.test(text) && /watercolor/i.test(medium)) {
    return 'Use wash edge, lost-and-found transitions, and reserved light shapes to redirect attention rather than relying on line-weight changes.';
  }

  return step;
}

function rewriteLowLeverageStep(step: string): string {
  const text = normalizeWhitespace(step);

  if (/^continue to explore\b/i.test(text)) {
    return text.replace(/^continue to explore\b/i, 'Push one visible relationship further by');
  }

  if (/^maintain the\b/i.test(text)) {
    return text.replace(/^maintain the\b/i, 'On the next pass, keep the');
  }

  if (/^consider\b/i.test(text)) {
    return text.replace(/^consider\b/i, 'On the next pass,');
  }

  if (/^experiment with\b/i.test(text)) {
    return text.replace(/^experiment with\b/i, 'Test');
  }

  return step;
}

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  const tonedDown = capInflatedRatingsWhenFundamentalsAreWeak(
    capInflatedRatingsForUnderdevelopedWork(capInflatedRatingsForNoviceLikeWork(toneDownOverpraise(critique)))
  );
  const tonedSimple = tonedDown.simpleFeedback;
  if (!tonedSimple) return tonedDown;

  const ctxA = tonedSimple.studioAnalysis.whatWorks;
  const ctxB = tonedSimple.studioAnalysis.whatCouldImprove;
  const studioChanges = tonedSimple.studioChanges.map((ch) => ({
    ...ch,
    text: rewriteLowLeverageStep(
      rewriteMediumInsensitiveStep(rewriteGenericStep(ch.text, ctxA, ctxB), tonedDown)
    ),
  })).slice(0, 5);

  return {
    ...tonedDown,
    simpleFeedback: {
      ...tonedSimple,
      studioAnalysis: {
        ...tonedSimple.studioAnalysis,
        whatCouldImprove: rewriteGenericWhatCouldImprove(
          tonedSimple.studioAnalysis.whatCouldImprove,
          tonedSimple.studioAnalysis.whatWorks
        ),
      },
      studioChanges,
    },
  };
}
