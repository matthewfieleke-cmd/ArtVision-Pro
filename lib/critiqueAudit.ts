import { CRITERIA_ORDER } from '../shared/criteria.js';
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

/** Voice B must only use "Don't change a thing" when level is Master; fix model drift. */
function normalizeActionPlansToLevels(critique: CritiqueResultDTO): CritiqueResultDTO {
  const dontChange = /^don['\u2019]t change a thing[.!]?\s*/i;
  let changed = false;
  const categories = critique.categories.map((cat) => {
    if (cat.level === 'Master') return cat;
    const raw = cat.actionPlan.trim();
    if (!dontChange.test(raw)) return cat;
    const stripped = raw.replace(dontChange, '').trim();
    if (/^1[\.\)]\s/m.test(stripped) && stripped.length >= 50) {
      changed = true;
      return { ...cat, actionPlan: stripped };
    }
    const area = cat.anchor?.areaSummary?.trim() || 'the passage described in your feedback above';
    const nextBand =
      cat.level === 'Beginner'
        ? 'Intermediate'
        : cat.level === 'Intermediate'
          ? 'Advanced'
          : 'Master';
    const fallback = `1. Focus on ${area}: use your feedback above to name what still limits this criterion at ${cat.level}.\n2. Make one concrete adjustment in that same zone toward ${nextBand}—use the lever this criterion cares about (edges and selective sharpness vs softness for edge/focus; mark vocabulary, wet/dry, or surface clarity for surface/medium).\n3. Step back and check that the change reads as clearer control, not busier detail.`;
    changed = true;
    return { ...cat, actionPlan: fallback };
  });
  return changed ? { ...critique, categories } : critique;
}

const EDGE = 'Edge and focus control' as const;
const SURFACE = 'Surface and medium handling' as const;

/** When photo is good and six structural criteria are Advanced but edge+surface are both Intermediate, nudge those two to Advanced unless work is clearly unfinished. */
function rebalanceEdgeSurfaceIntermediateCluster(critique: CritiqueResultDTO): CritiqueResultDTO {
  if (critique.photoQuality?.level !== 'good') return critique;
  if (critique.completionRead?.state === 'unfinished') return critique;

  const byCrit = new Map(critique.categories.map((c) => [c.criterion, c] as const));
  const edge = byCrit.get(EDGE);
  const surface = byCrit.get(SURFACE);
  if (!edge || !surface) return critique;
  if (edge.level !== 'Intermediate' || surface.level !== 'Intermediate') return critique;

  const others = CRITERIA_ORDER.filter((c) => c !== EDGE && c !== SURFACE);
  const allOthersAdvanced = others.every((c) => byCrit.get(c)?.level === 'Advanced');
  if (!allOthersAdvanced) return critique;

  const bandNote =
    '\n\n(Read at Advanced on this capture: structural criteria are consistently strong and photo quality is good, so this axis is not held a band lower by capture limits alone.)';

  let changed = false;
  const categories = critique.categories.map((cat) => {
    if (cat.criterion !== EDGE && cat.criterion !== SURFACE) return cat;
    changed = true;
    const nextTarget =
      cat.criterion === EDGE
        ? 'Push edge and focus control toward Master.'
        : 'Push surface and medium handling toward Master.';
    const subskills = cat.subskills?.map((s) => ({
      ...s,
      level: 'Advanced' as const,
      score: Math.min(0.9, Math.max(s.score, 0.66)),
    }));
    const feedback = cat.feedback.includes('Read at Advanced on this capture')
      ? cat.feedback
      : `${cat.feedback.trim()}${bandNote}`;
    return {
      ...cat,
      level: 'Advanced' as const,
      nextTarget,
      feedback,
      ...(subskills ? { subskills } : {}),
    };
  });

  return changed ? { ...critique, categories } : critique;
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

    const adjusted: CritiqueResultDTO = {
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
    return rebalanceEdgeSurfaceIntermediateCluster(normalizeActionPlansToLevels(adjusted));
  }
  return rebalanceEdgeSurfaceIntermediateCluster(normalizeActionPlansToLevels(critique));
}
