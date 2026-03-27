import type { CritiqueResultDTO } from './critiqueTypes.js';

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function rewriteGenericMainIssue(
  mainIssue: string,
  preserve: string,
  working: string[]
): string {
  const text = normalizeWhitespace(mainIssue);
  const genericPatterns = [
    /lack of a clear focal point/i,
    /stronger focal point/i,
    /spatial definition/i,
    /more dynamic integration/i,
    /lacks cohesion/i,
    /lacks clear spatial definition/i,
  ];
  if (!containsAny(text, genericPatterns)) return mainIssue;

  const preserveText = normalizeWhitespace(preserve);
  const workingText = normalizeWhitespace(working.join(' '));

  if (/(atmosphere|soft|mist|harmony|tranquil|calm|serene|glow)/i.test(preserveText + ' ' + workingText)) {
    return 'The main issue is not a lack of drama; it is that one or two relationships inside the existing calm are not yet fully decided, so the painting can read slightly diffuse instead of deliberate.';
  }

  if (/(distributed|all-over|energy|movement|dynamic|vibrant)/i.test(preserveText + ' ' + workingText)) {
    return 'The main issue is not that the work needs one dominant focal point; it is that a few competing accents are equally loud, so the eye does not quite know which relationship matters most.';
  }

  return 'The main issue is not simply that the painting needs more focus; it is that the current structure does not yet fully separate what should lead from what should support.';
}

function rewriteGenericStep(step: string, preserve: string, intent: string): string {
  const text = normalizeWhitespace(step);
  const context = `${preserve} ${intent}`;

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
  const hasNoIssueLanguage = Boolean(
    simple &&
      containsAny(simple.mainIssue, [
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

  const softenedMainIssue = simple
    ? /no significant issues/i.test(simple.mainIssue)
      ? 'The painting is strong overall; the most useful next step is to protect what is already working while identifying one relationship that could become more deliberate.'
      : simple.mainIssue
    : undefined;

  return {
    ...critique,
    categories: softenedCategories,
    ...(simple
      ? {
          simpleFeedback: {
            ...simple,
            mainIssue: softenedMainIssue ?? simple.mainIssue,
          },
        }
      : {}),
  };
}

function inferNoviceSignalCount(critique: CritiqueResultDTO): number {
  const text = normalizeWhitespace(
    [
      critique.summary,
      critique.simpleFeedback?.intent ?? '',
      critique.simpleFeedback?.mainIssue ?? '',
      critique.simpleFeedback?.preserve ?? '',
      ...(critique.simpleFeedback?.working ?? []),
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
    /easy to read/i,
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

    if (noviceSignals >= 4 && category.level === 'Advanced') {
      return {
        ...category,
        level:
          category.criterion === 'Intent and necessity' ||
          category.criterion === 'Presence, point of view, and human force'
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
            mainIssue:
              noviceSignals >= 4
                ? 'The main issue is that the picture is working with simple, early-stage decisions: the subject is readable, but drawing, spatial logic, value grouping, and edge control are still at a beginner-to-intermediate stage rather than an advanced one.'
                : 'The main issue is that the picture is still working at a simple, early-stage level: the big shapes read, but drawing, value grouping, and edge control are not yet developed enough to support higher ratings.',
          },
        }
      : {}),
  };
}

function rewriteMediumInsensitiveStep(step: string, critique: CritiqueResultDTO): string {
  const text = normalizeWhitespace(step);
  const medium = critique.summary + ' ' + (critique.simpleFeedback?.intent ?? '');

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

function hasConcreteAdjustment(step: string): boolean {
  return /soften|darken|lighten|group|separate|sharpen|lose|compress|cool|warm|straighten|widen|narrow|simplify|restate|quiet|reduce|push|shift|thicken|thin/i.test(
    step
  );
}

function enforceSpecificNextSteps(
  nextSteps: string[],
  critique: CritiqueResultDTO
): string[] {
  const hasBelowMasterCategory = critique.categories.some((category) => category.level !== 'Master');
  if (!hasBelowMasterCategory) return nextSteps;

  return nextSteps.map((step, index) => {
    const text = normalizeWhitespace(step);
    if (hasConcreteAdjustment(text)) return step;

    if (index === 0) {
      return 'On the next pass, adjust the weakest visible relationship first by simplifying one busy passage and separating its main shape from the neighboring shape with a clearer value or edge decision.';
    }

    if (index === 1) {
      return 'After that, choose one supporting area and either quiet it, soften it, or group it more simply so the stronger passage can lead without competition.';
    }

    return 'Finish by checking one specific edge, value grouping, or color-temperature relationship that still feels undecided and correct only that passage.';
  });
}

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  const tonedDown = capInflatedRatingsForNoviceLikeWork(toneDownOverpraise(critique));
  const tonedSimple = tonedDown.simpleFeedback;
  if (!tonedSimple) return tonedDown;

  const nextSteps = enforceSpecificNextSteps(
    tonedSimple.nextSteps.map((step) =>
      rewriteLowLeverageStep(
        rewriteMediumInsensitiveStep(
          rewriteGenericStep(step, tonedSimple.preserve, tonedSimple.intent),
          tonedDown
        )
    )
    ),
    tonedDown
  );

  return {
    ...tonedDown,
    simpleFeedback: {
      ...tonedSimple,
      mainIssue: rewriteGenericMainIssue(
        tonedSimple.mainIssue,
        tonedSimple.preserve,
        tonedSimple.working
      ),
      nextSteps,
    },
  };
}
