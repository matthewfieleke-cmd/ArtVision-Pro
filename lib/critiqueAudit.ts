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

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  const tonedDown = toneDownOverpraise(critique);
  const tonedSimple = tonedDown.simpleFeedback;
  if (!tonedSimple) return tonedDown;

  const nextSteps = tonedSimple.nextSteps.map((step) =>
    rewriteMediumInsensitiveStep(
      rewriteGenericStep(step, tonedSimple.preserve, tonedSimple.intent),
      tonedDown
    )
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
