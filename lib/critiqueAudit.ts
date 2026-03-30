import type { CritiqueResultDTO } from './critiqueTypes.js';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

function hasConcreteAnchorReference(text: string, anchorSummary: string): boolean {
  if (!anchorSummary.trim()) return false;
  if (normalizedContains(text, anchorSummary)) return true;
  const fallbackTokens = anchorSummary
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
  return fallbackTokens.some((token) => normalizeWhitespace(text).toLowerCase().includes(token));
}

function alignedStudioChanges(critique: CritiqueResultDTO): boolean {
  if (!critique.simpleFeedback) return true;
  const categoryByCriterion = new Map(
    critique.categories.map((category) => [category.criterion, category] as const)
  );
  return critique.simpleFeedback.studioChanges.every((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    if (!category?.anchor) return false;
    return hasConcreteAnchorReference(change.text, category.anchor.areaSummary);
  });
}

export function critiqueNeedsFreshEvidenceRead(critique: CritiqueResultDTO): boolean {
  for (const category of critique.categories) {
    const anchor = category.anchor;
    if (!anchor) return true;
    if (!hasConcreteAnchorReference(category.feedback, anchor.areaSummary)) return true;
    if (!hasConcreteAnchorReference(category.actionPlan, anchor.areaSummary)) return true;
    if (!normalizedContains(category.editPlan?.targetArea ?? '', anchor.areaSummary)) return true;
  }
  return !alignedStudioChanges(critique);
}

const LEVEL_RANK = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
} as const;

function critiqueText(critique: CritiqueResultDTO): string {
  return normalizeWhitespace(
    [
      critique.summary,
      critique.overallSummary?.analysis ?? '',
      critique.simpleFeedback?.studioAnalysis.whatWorks ?? '',
      critique.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '',
      ...(critique.simpleFeedback?.studioChanges.map((change) => change.text) ?? []),
      ...critique.categories.flatMap((category) => [
        category.feedback,
        category.actionPlan,
        ...(category.evidenceSignals ?? []),
        category.anchor?.areaSummary ?? '',
        category.anchor?.evidencePointer ?? '',
        category.editPlan?.issue ?? '',
      ]),
    ].join(' ')
  );
}

function noviceSignalCount(text: string): number {
  const patterns = [
    /\bchildlike\b/i,
    /\bkindergarten\b/i,
    /\bscribble\b/i,
    /\bnaive\b/i,
    /\bearly stage\b/i,
    /\bunderdeveloped\b/i,
    /\bvery simple\b/i,
    /\brudimentary\b/i,
    /\bbasic shapes\b/i,
    /\bflat spacing\b/i,
    /\buncertain drawing\b/i,
    /\blimited control\b/i,
    /\bcrude\b/i,
    /\bnaive spacing\b/i,
  ];
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function suspiciousInflationSignalCount(text: string): number {
  const patterns = [
    /\bexpressionist technique\b/i,
    /\bseen in works by\b/i,
    /\breminiscent of expressionist\b/i,
    /\bdynamic composition\b/i,
    /\bexpert use of\b/i,
    /\bmasterful\b/i,
    /\bstrong human force\b/i,
    /\bpowerful point of view\b/i,
    /\badvanced\b/i,
    /\bmaster\b/i,
    /\bsuccessful abstraction\b/i,
    /\bintentional stylization\b/i,
  ];
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function noviceLikeOverrated(critique: CritiqueResultDTO): boolean {
  const text = critiqueText(critique);
  const noviceSignals = noviceSignalCount(text);
  const inflatedSignals = suspiciousInflationSignalCount(text);
  const highRatings = critique.categories.filter(
    (category) => category.level != null && LEVEL_RANK[category.level] >= LEVEL_RANK.Advanced
  ).length;
  const weakFundamentals = critique.categories.filter(
    (category) =>
      category.criterion === 'Drawing, proportion, and spatial form' ||
      category.criterion === 'Value and light structure' ||
      category.criterion === 'Edge and focus control'
  );
  const lowFundamentalCount = weakFundamentals.filter(
    (category) => category.level != null && LEVEL_RANK[category.level] <= LEVEL_RANK.Intermediate
  ).length;

  return noviceSignals >= 1 && inflatedSignals >= 1 && highRatings >= 4 && lowFundamentalCount >= 2;
}

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  if (noviceLikeOverrated(critique)) {
    const adjustedCategories = critique.categories.map((category) => {
      if (
        category.criterion === 'Intent and necessity' ||
        category.criterion === 'Presence, point of view, and human force'
      ) {
        return {
          ...category,
          level: 'Intermediate' as const,
        };
      }
      return {
        ...category,
        level:
          category.level != null && LEVEL_RANK[category.level] >= LEVEL_RANK.Advanced
            ? ('Beginner' as const)
            : category.level,
      };
    });

    return {
      ...critique,
      categories: adjustedCategories,
      overallConfidence: 'low',
      overallSummary: critique.overallSummary
        ? {
            ...critique.overallSummary,
            analysis:
              'Using the chosen style and medium lens, the work still reads as early-stage rather than as successful advanced stylization. The simplified face, blunt features, and limited spatial or value development do not support high ratings across the criteria.',
            topPriorities: [
              'Simplify the head into clearer large shapes before trying to push expressive stylization.',
              'Separate the main facial features with more deliberate value and edge decisions.',
            ],
          }
        : critique.overallSummary,
      simpleFeedback: critique.simpleFeedback
        ? {
            ...critique.simpleFeedback,
            studioAnalysis: {
              ...critique.simpleFeedback.studioAnalysis,
              whatCouldImprove:
                'This work reads as an early-stage drawing rather than as advanced expressive simplification. The current shape control, value structure, and edge hierarchy are still too undeveloped to justify higher ratings.',
            },
          }
        : critique.simpleFeedback,
    };
  }
  return critique;
}
