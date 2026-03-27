import type { CritiqueCategoryDTO, CritiqueResultDTO } from './critiqueTypes.js';

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
            mainIssue:
              noviceSignals >= 4
                ? 'The main issue is that the picture is working with simple, early-stage decisions: the subject is readable, but drawing, spatial logic, value grouping, and edge control are still at a beginner-to-intermediate stage rather than an advanced one.'
                : 'The main issue is that the picture is still working at a simple, early-stage level: the big shapes read, but drawing, value grouping, and edge control are not yet developed enough to support higher ratings.',
          },
        }
      : {}),
  };
}

function inferUnderdevelopedSignalCount(critique: CritiqueResultDTO): number {
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
      critique.simpleFeedback?.intent ?? '',
      critique.simpleFeedback?.mainIssue ?? '',
      ...(critique.simpleFeedback?.working ?? []),
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
            mainIssue:
              'The main issue is that the painting is still underdeveloped in the fundamentals: the image is readable, but drawing, space, value, and edge decisions remain too loose to support advanced ratings.',
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
            mainIssue:
              'The fundamentals are not yet strong enough to justify high ratings across the board: composition, value, drawing, and edge control still need clearer decisions before the more expressive qualities can carry the work.',
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

function splitNumberedActionPlan(actionPlan: string): string[] {
  return actionPlan
    .split(/\s+(?=\d+\.)/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function stripNumberPrefix(step: string): string {
  return step.replace(/^\d+\.\s*/, '').trim();
}

/** First sentence only; keeps decimals inside the sentence intact. */
function firstSentence(text: string): string {
  const t = normalizeWhitespace(text);
  if (!t) return t;
  const match = t.match(/^(.+?[.!?])(\s+|$)/);
  return match ? match[1]!.trim() : t;
}

function hasPaintingSpecificAnchor(text: string): boolean {
  return /(foreground|background|middle ground|midground|upper|lower|left|right|center|central|corner|edge|sky|tree|trees|foliage|figure|figures|face|hands|roof|house|path|water|shadow|highlight|light|horizon|canvas|building|window|door|boat|mountain|cloud|vase|table|cloth|ground|floor|wall|street|hair|skin|flowers|object|shape|mass|passage|area|plane|motif)/i.test(
    text
  );
}

/** Motifs, objects, or color words that tie advice to this picture—not just "background" or "one edge". */
function hasStrictContentAnchor(text: string): boolean {
  const t = text;
  if (
    /\b(cat|cats|dog|dogs|horse|horses|bird|birds|figure|figures|portrait|face|faces|head|table|chair|vase|bowl|flower|flowers|hand|hands|sleeve|sleeves|window|windows|door|roof|sky|water|boat|boats|person|people|child|children|animal|animals|fabric|drape|hair|skin|eyes?|apple|fruit|book|books|cup|mug|bottle|landscape|building|buildings|tree|trees|mountain|mountains|church|churches|field|path|rock|grass|sand|snow|foreground|still life|figure study)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (/\b(upper|lower|top|bottom)\s*[- ]?(left|right)\b/i.test(t)) return true;
  if (/\b(left|right)\s+(side|edge|third)\b/i.test(t) && /\b(background|foreground|midground|figure|face|table|cloth|sky|cat|dog|object)\b/i.test(t)) {
    return true;
  }
  if (/^(on|along|in)\s+the\s+(right|left)\b/i.test(t)) return true;
  const colorHits = t.match(
    /\b(red|blue|green|yellow|orange|violet|purple|pink|brown|ochre|sienna|ultramarine|cadmium|vermilion|turquoise|crimson|teal|maroon|navy|scarlet|ivory|sepia|grey|gray|black|white)s?\b/gi
  );
  if (colorHits && colorHits.length >= 2) return true;
  if (
    /\b(red|blue|green|yellow|orange|violet|purple|pink|crimson|ultramarine|cadmium)\b/i.test(t) &&
    /\b(and|versus|vs\.?|meet|meets|against|near|into|between)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

const VAGUE_NEXT_STEP_SUBJECT = /\b(one|the)\s+(important\s+)?(contour|neighbor|neighbour|passage|shape|zone|span|band|relationship)s?\b/i;
const GENERIC_COLOR_FAMILIES = /two\s+color\s+families/i;
const WEAKEST_EVIDENCE_PHRASE = /weakest\s+against\s+your\s+evidence|reads\s+weakest/i;
const SUPPORTING_ZONE_GENERIC = /\bone\s+supporting\s+zone\b/i;

function nextStepIsSpecificEnough(text: string): boolean {
  const t = normalizeWhitespace(text);
  if (t.length < 52) return false;
  if (!hasConcreteAdjustment(t)) return false;
  if (WEAKEST_EVIDENCE_PHRASE.test(t)) return false;
  if (GENERIC_COLOR_FAMILIES.test(t)) return false;
  if (SUPPORTING_ZONE_GENERIC.test(t)) return false;
  if (/\bone\s+edge\b|\ban\s+edge\b/i.test(t) && !hasStrictContentAnchor(t)) return false;
  if (VAGUE_NEXT_STEP_SUBJECT.test(t) && !hasStrictContentAnchor(t)) return false;
  if (!hasStrictContentAnchor(t)) return false;
  return true;
}

function collectContentAnchors(critique: CritiqueResultDTO): string[] {
  const raw: string[] = [];
  const s = critique.simpleFeedback;
  if (s) {
    if (typeof s.intent === 'string') raw.push(s.intent);
    for (const w of s.working ?? []) raw.push(w);
    if (typeof s.mainIssue === 'string') raw.push(s.mainIssue);
    if (typeof s.preserve === 'string') raw.push(s.preserve);
  }
  if (typeof critique.summary === 'string') raw.push(critique.summary);
  for (const c of critique.categories) {
    for (const e of c.evidenceSignals ?? []) raw.push(e);
    if (typeof c.feedback === 'string') raw.push(c.feedback);
    if (typeof c.actionPlan === 'string') raw.push(c.actionPlan);
  }
  const phrases: string[] = [];
  for (const block of raw) {
    const n = normalizeWhitespace(block);
    if (n.length < 14) continue;
    const chunks = n.split(/\s*;\s*/).flatMap((p) => p.split(/(?<=[.!?])\s+/));
    for (const chunk of chunks) {
      const q = normalizeWhitespace(chunk);
      if (q.length >= 14 && q.length <= 170) phrases.push(q);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function clipPhrase(s: string, max: number): string {
  const t = normalizeWhitespace(s);
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** When model steps are too generic, rebuild from visible phrases already in the critique JSON. */
function buildEvidenceAnchoredNextSteps(critique: CritiqueResultDTO): string[] {
  const anchors = collectContentAnchors(critique);
  if (!anchors.length) return [];
  const a0 = clipPhrase(anchors[0]!, 95);
  const a1 = clipPhrase(anchors[1] ?? anchors[0]!, 95);
  const a2 = clipPhrase(anchors[2] ?? anchors[0]!, 95);
  const a3 = clipPhrase(anchors[3] ?? anchors[1] ?? anchors[0]!, 95);
  return [
    `Starting from what is already visible (${a0}), separate the main mass there from what sits beside it with one clearer value step or a cleaner edge so that relationship reads first.`,
    `In the passage your notes describe (${a1}), soften or simplify competing marks so the stronger area leads without equal-strength neighbors.`,
    `Along the transition that still feels sticky (${a2}), sharpen or lose a short span of edge so depth and focus read more deliberately.`,
    `Where color or temperature needs to knit together (${a3}), use a thin glaze or scumble so the shift supports space instead of flattening into a hard cut.`,
  ];
}

function evidenceAnchorSnippet(category: CritiqueCategoryDTO): string {
  const signals = category.evidenceSignals ?? [];
  const pick = signals.find((s: string) => typeof s === 'string' && s.trim().length >= 8);
  if (!pick) return '';
  const t = normalizeWhitespace(pick);
  if (t.length <= 100) return t;
  return `${t.slice(0, 97)}…`;
}

function rewriteGenericActionPlanStep(step: string): string {
  const text = normalizeWhitespace(stripNumberPrefix(step));

  if (/continue using/i.test(text)) {
    return 'Keep the strongest passage, but restate one weaker neighboring shape so the difference in role is clearer.';
  }

  if (/maintain|preserve|ensure|continue to|experiment with|consider/i.test(text) && !hasPaintingSpecificAnchor(text)) {
    return 'Adjust one visible area rather than the whole painting: simplify a busy passage, separate one shape from its neighbor, or restate one edge so the read becomes clearer.';
  }

  if (/enhance depth|improve clarity|increase contrast/i.test(text) && !hasPaintingSpecificAnchor(text)) {
    return 'Create depth by changing one concrete relationship: soften one background edge, darken one shadow family, or separate one foreground shape from the passage behind it.';
  }

  return text;
}

function fallbackCategoryImprovement(category: CritiqueCategoryDTO): string {
  const anchor = evidenceAnchorSnippet(category);
  const crit = category.criterion;
  if (anchor) {
    return `In the passage described by your evidence (${anchor}), make one focused change for ${crit}: separate the main shape from what sits beside it with a smaller value shift or a cleaner edge so this area reads more decisively.`;
  }
  return `For ${crit} in this painting, pick the busiest visible area and simplify it with one grouping move—fewer competing accents—so the stronger passage can lead without everything calling for equal attention.`;
}

/**
 * One painting-specific sentence per category for the "How to improve it" UI.
 */
function enforceSpecificCategoryActionPlans(
  critique: CritiqueResultDTO
): CritiqueResultDTO {
  const categories = critique.categories.map((category) => {
    const numberedSteps = splitNumberedActionPlan(category.actionPlan);
    const primary =
      numberedSteps.length > 0
        ? normalizeWhitespace(stripNumberPrefix(numberedSteps[0]!))
        : normalizeWhitespace(category.actionPlan);

    let sentence = firstSentence(primary);
    sentence = rewriteGenericActionPlanStep(`1. ${sentence}`).replace(/^\d+\.\s*/, '').trim();
    sentence = firstSentence(sentence);

    const anchored = hasPaintingSpecificAnchor(sentence);
    const tooThin = sentence.length < 36;
    if (!anchored || tooThin) {
      sentence = fallbackCategoryImprovement(category);
    }

    if (!/[.!?]$/.test(sentence)) {
      sentence = `${sentence}.`;
    }

    return {
      ...category,
      actionPlan: sentence,
    };
  });

  return {
    ...critique,
    categories,
  };
}

function hasConcreteAdjustment(step: string): boolean {
  return /soften|darken|lighten|group|separate|sharpen|lose|compress|cool|warm|straighten|widen|narrow|simplify|restate|quiet|reduce|push|shift|thicken|thin|glaze|scumble|blend|drag|lift|mute|deepen|unify|knit/i.test(
    step
  );
}

function enforceSpecificNextSteps(
  nextSteps: string[],
  critique: CritiqueResultDTO
): string[] {
  const hasBelowMasterCategory = critique.categories.some((category) => category.level !== 'Master');
  if (!hasBelowMasterCategory) return nextSteps.slice(0, 4);

  const trimmed = nextSteps.map((s) => normalizeWhitespace(s)).filter(Boolean);
  const allSpecific = trimmed.length >= 3 && trimmed.every((step) => nextStepIsSpecificEnough(step));
  if (allSpecific) return trimmed.slice(0, 4);

  const anchored = buildEvidenceAnchoredNextSteps(critique);
  if (anchored.length >= 3) return anchored.slice(0, 4);

  return trimmed.slice(0, 4);
}

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  const tonedDown = enforceSpecificCategoryActionPlans(
    capInflatedRatingsWhenFundamentalsAreWeak(
      capInflatedRatingsForUnderdevelopedWork(
        capInflatedRatingsForNoviceLikeWork(toneDownOverpraise(critique))
      )
    )
  );
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
