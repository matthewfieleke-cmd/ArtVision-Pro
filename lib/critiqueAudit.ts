import { CRITERIA_ORDER } from '../shared/criteria.js';
import { splitNumberedSteps } from './numberedSteps.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

const ANCHOR_STOPWORDS = new Set([
  'about',
  'across',
  'after',
  'around',
  'because',
  'before',
  'below',
  'between',
  'could',
  'figure',
  'from',
  'into',
  'like',
  'near',
  'onto',
  'over',
  'painting',
  'passage',
  'same',
  'should',
  'still',
  'their',
  'there',
  'these',
  'this',
  'through',
  'toward',
  'under',
  'using',
  'while',
  'with',
]);

function anchorTokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !ANCHOR_STOPWORDS.has(token))
    )
  );
}

function matchedAnchorTokenCount(text: string, source: string): number {
  const normalized = normalizeWhitespace(text).toLowerCase();
  return anchorTokens(source).filter((token) => normalized.includes(token)).length;
}

function hasConcreteAnchorReference(
  text: string,
  anchorSummary: string,
  evidencePointer = ''
): boolean {
  if (!anchorSummary.trim()) return false;
  if (normalizedContains(text, anchorSummary)) return true;
  if (evidencePointer.trim() && normalizedContains(text, evidencePointer)) return true;

  const summaryMatches = matchedAnchorTokenCount(text, anchorSummary);
  const pointerMatches = evidencePointer.trim() ? matchedAnchorTokenCount(text, evidencePointer) : 0;
  const summaryNeeded = Math.min(2, anchorTokens(anchorSummary).length);
  const pointerNeeded = Math.min(2, anchorTokens(evidencePointer).length);

  return (
    (summaryNeeded > 0 && summaryMatches >= summaryNeeded) ||
    (pointerNeeded > 0 && pointerMatches >= pointerNeeded) ||
    (summaryMatches >= 1 && pointerMatches >= 1)
  );
}

function anchoredCategoryMatchesText(
  text: string,
  category: CritiqueResultDTO['categories'][number]
): boolean {
  return hasConcreteAnchorReference(
    text,
    category.anchor?.areaSummary ?? '',
    category.anchor?.evidencePointer ?? ''
  );
}

function distinctAnchorMentions(
  text: string,
  critique: CritiqueResultDTO,
  options?: { limit?: number }
): number {
  let count = 0;
  for (const category of critique.categories) {
    if (!category.anchor) continue;
    if (!anchoredCategoryMatchesText(text, category)) continue;
    count += 1;
    if (options?.limit && count >= options.limit) return count;
  }
  return count;
}

function topLevelVoicesStayGrounded(critique: CritiqueResultDTO): boolean {
  if (distinctAnchorMentions(critique.summary, critique, { limit: 1 }) < 1) return false;
  if (distinctAnchorMentions(critique.overallSummary?.analysis ?? '', critique, { limit: 2 }) < 2) {
    return false;
  }

  const whatWorks = critique.simpleFeedback?.studioAnalysis.whatWorks ?? '';
  if (distinctAnchorMentions(whatWorks, critique, { limit: 1 }) < 1) return false;

  const whatCouldImprove = critique.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '';
  if (distinctAnchorMentions(whatCouldImprove, critique, { limit: 1 }) < 1) return false;

  const topPriorities = critique.overallSummary?.topPriorities ?? [];
  return topPriorities.every((priority) => distinctAnchorMentions(priority, critique, { limit: 1 }) >= 1);
}

function alignedStudioChanges(critique: CritiqueResultDTO): boolean {
  if (!critique.simpleFeedback) return true;
  const categoryByCriterion = new Map(
    critique.categories.map((category) => [category.criterion, category] as const)
  );
  return critique.simpleFeedback.studioChanges.every((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    if (!category?.anchor) return false;
    return hasConcreteAnchorReference(change.text, category.anchor.areaSummary, category.anchor.evidencePointer);
  });
}

export function critiqueNeedsFreshEvidenceRead(critique: CritiqueResultDTO): boolean {
  for (const category of critique.categories) {
    const anchor = category.anchor;
    if (!anchor) return true;
    if (!hasConcreteAnchorReference(category.feedback, anchor.areaSummary, anchor.evidencePointer)) return true;
    if (!hasConcreteAnchorReference(category.actionPlan, anchor.areaSummary, anchor.evidencePointer)) return true;
    if (!normalizedContains(category.editPlan?.targetArea ?? '', anchor.areaSummary)) return true;
  }
  return !topLevelVoicesStayGrounded(critique) || !alignedStudioChanges(critique);
}

const LEVEL_RANK = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
} as const;

function firstSentence(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';
  const match = normalized.match(/^.+?[.!?](?=\s|$)/);
  return match?.[0] ?? normalized;
}

function sentenceCase(text: string): string {
  const trimmed = normalizeWhitespace(text).replace(/[.!?]+$/, '');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function lowerFirst(text: string): string {
  const trimmed = normalizeWhitespace(text).replace(/[.!?]+$/, '');
  if (!trimmed) return '';
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

const VAGUE_VOICE_B_PATTERNS = [
  /\bdefine\b.*\bedges?\b.*\bmore clearly\b/i,
  /\benhance\b.*\bfocus hierarchy\b/i,
  /\benhance\b.*\bnarrative\b/i,
  /\badd\b.*\bsmall details\b/i,
  /\bcontribute to the story\b/i,
  /\bsmooth out\b.*\bcolor transitions\b/i,
  /\benhance\b.*\brealism\b/i,
  /\bimprove the focus where needed\b/i,
  /\bimprove the main focal area\b/i,
];

function isVagueVoiceBText(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  return VAGUE_VOICE_B_PATTERNS.some((pattern) => pattern.test(normalized));
}

function ensureTrailingPeriod(text: string): string {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function concretePhrase(text: string): string {
  return normalizeWhitespace(text).replace(/^[A-Z]/, (m) => m.toLowerCase());
}

function looksConceptualLabel(text: string): boolean {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return true;
  return (
    /\b(left side of the painting|right side of the painting|background colors?|background color transitions|color transitions|peripheral elements|narrative focus|story|composition overall)\b/i.test(
      normalized
    ) ||
    (!/[,'’\-]/.test(normalized) &&
      /\b(arrangement|transitions|elements|background|foreground|narrative|composition|integration)\b/i.test(normalized))
  );
}

function structuredFieldsAreConcrete(category: CritiqueResultDTO['categories'][number]): boolean {
  const area = category.anchor?.areaSummary ?? category.editPlan?.targetArea ?? '';
  const issue = category.editPlan?.issue ?? '';
  const move = category.editPlan?.intendedChange ?? '';
  const outcome = category.editPlan?.expectedOutcome ?? '';
  if (!area.trim() || !issue.trim() || !move.trim() || !outcome.trim()) return false;
  if (looksConceptualLabel(area)) return false;
  if (
    /\b(more depth|better narrative|improve realism|enhanced clarity|more cohesive|more integrated)\b/i.test(
      `${issue} ${move} ${outcome}`
    )
  ) {
    return false;
  }
  return true;
}

function fallbackVoiceBStep(
  category: CritiqueResultDTO['categories'][number],
  index: number
): string {
  if (!structuredFieldsAreConcrete(category)) {
    const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
    const existingSteps = splitNumberedSteps(category.actionPlan);
    const reusable = existingSteps.find((step) => normalizeWhitespace(step).length > 0 && !isVagueVoiceBText(step));
    if (reusable) return `${index + 1}. ${ensureTrailingPeriod(reusable)}`;
    return `${index + 1}. Keep the strongest relationship in ${area} intact and make only one clearly local revision there.`;
  }
  const area = category.anchor?.areaSummary?.trim() || category.editPlan?.targetArea?.trim() || 'the anchored passage';
  const issue =
    concretePhrase(category.editPlan?.issue ?? '') ||
    concretePhrase(category.anchor?.evidencePointer ?? '') ||
    'the current relationship still reads too generically';
  const move =
    concretePhrase(category.editPlan?.intendedChange ?? '') ||
    'make one clearer directional adjustment there';
  const outcome =
    concretePhrase(category.editPlan?.expectedOutcome ?? '') ||
    'the passage reads with more deliberate control';
  return `${index + 1}. In ${area}, ${issue}; ${move} so ${outcome}.`;
}

function rewriteActionPlanFromStructuredFields(
  category: CritiqueResultDTO['categories'][number]
): string {
  if (category.level === 'Master') return category.actionPlan;
  const existingSteps = splitNumberedSteps(category.actionPlan);
  if (!structuredFieldsAreConcrete(category) && existingSteps.length > 0) {
    return existingSteps.map((step, index) => `${index + 1}. ${ensureTrailingPeriod(step)}`).join('\n');
  }
  const minimumSteps = category.level === 'Advanced' ? 2 : 3;
  const steps: string[] = [];
  const usedNormalizedSteps = new Set<string>();
  for (let i = 0; i < Math.max(minimumSteps, existingSteps.length); i++) {
    const existing = existingSteps[i];
    const normalizedExisting = existing ? normalizeWhitespace(existing).toLowerCase() : '';
    if (
      existing &&
      !isVagueVoiceBText(existing) &&
      anchoredCategoryMatchesText(existing, category) &&
      !usedNormalizedSteps.has(normalizedExisting)
    ) {
      steps.push(`${i + 1}. ${ensureTrailingPeriod(existing)}`);
      usedNormalizedSteps.add(normalizedExisting);
    } else {
      const fallback = fallbackVoiceBStep(category, i);
      const normalizedFallback = normalizeWhitespace(fallback).toLowerCase();
      if (usedNormalizedSteps.has(normalizedFallback)) continue;
      steps.push(fallback);
      usedNormalizedSteps.add(normalizedFallback);
    }
  }
  return steps.slice(0, minimumSteps).join('\n');
}

function rewriteStudioChangeFromStructuredFields(
  category: CritiqueResultDTO['categories'][number],
  existingText?: string
): string {
  if (!structuredFieldsAreConcrete(category)) {
    return existingText && normalizeWhitespace(existingText).length > 0
      ? existingText
      : `Keep the strongest visible relationship in ${category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase()} intact before making any revision on this criterion.`;
  }
  const area = category.anchor?.areaSummary?.trim() || category.editPlan?.targetArea?.trim() || 'the anchored passage';
  const issue =
    concretePhrase(category.editPlan?.issue ?? '') ||
    concretePhrase(category.anchor?.evidencePointer ?? '') ||
    'the current passage still needs a more deliberate read';
  const move =
    concretePhrase(category.editPlan?.intendedChange ?? '') ||
    'make one clearer adjustment there';
  const outcome =
    concretePhrase(category.editPlan?.expectedOutcome ?? '') ||
    'the painting reads more clearly afterward';

  if (
    existingText &&
    !isVagueVoiceBText(existingText) &&
    anchoredCategoryMatchesText(existingText, category)
  ) {
    return existingText;
  }

  return `In ${area}, ${issue}; ${move} so ${outcome}.`;
}

function hybridizeVoiceBFromStructuredFields(critique: CritiqueResultDTO): CritiqueResultDTO {
  let changed = false;
  const categories = critique.categories.map((category) => {
    if (category.level === 'Master') return category;
    const rewritten = rewriteActionPlanFromStructuredFields(category);
    if (rewritten === category.actionPlan) return category;
    changed = true;
    return {
      ...category,
      actionPlan: rewritten,
    };
  });

  if (!critique.simpleFeedback) {
    return changed ? { ...critique, categories } : critique;
  }

  const categoryByCriterion = new Map(categories.map((category) => [category.criterion, category] as const));
  const studioChanges = critique.simpleFeedback.studioChanges.map((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    if (!category) return change;
    const rewritten = rewriteStudioChangeFromStructuredFields(category, change.text);
    if (rewritten === change.text) return change;
    changed = true;
    return {
      ...change,
      text: rewritten,
    };
  });

  return changed
    ? {
        ...critique,
        categories,
        simpleFeedback: {
          ...critique.simpleFeedback,
          studioChanges,
        },
      }
    : critique;
}

function weakestAnchoredCategories(
  critique: CritiqueResultDTO,
  limit: number
): CritiqueResultDTO['categories'] {
  return [...critique.categories]
    .filter((category) => category.anchor)
    .sort((a, b) => {
      const aRank = a.level ? LEVEL_RANK[a.level] : LEVEL_RANK.Intermediate;
      const bRank = b.level ? LEVEL_RANK[b.level] : LEVEL_RANK.Intermediate;
      if (aRank !== bRank) return aRank - bRank;
      return CRITERIA_ORDER.indexOf(a.criterion) - CRITERIA_ORDER.indexOf(b.criterion);
    })
    .slice(0, limit);
}

function anchoredIssueSentence(category: CritiqueResultDTO['categories'][number]): string {
  const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
  const issueSource =
    category.editPlan?.issue?.trim() ||
    category.anchor?.evidencePointer?.trim() ||
    firstSentence(category.feedback);
  if (!issueSource) {
    return `In ${area}, the structure is still too underdeveloped for a higher read.`;
  }
  const issue = sentenceCase(issueSource);
  if (normalizedContains(issue, area)) return `${issue}.`;
  return `In ${area}, ${issue.charAt(0).toLowerCase()}${issue.slice(1)}.`;
}

function anchoredPriorityLine(category: CritiqueResultDTO['categories'][number]): string {
  const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
  const intendedChange = sentenceCase(category.editPlan?.intendedChange ?? '');
  if (intendedChange) return `Focus on ${area}: ${intendedChange}.`;
  return `Focus on ${area}: restate that passage with simpler value and edge decisions before adding more detail.`;
}

function buildSpecificNoviceAnalysis(critique: CritiqueResultDTO): string {
  const weakest = weakestAnchoredCategories(critique, 2);
  const localRead = weakest.map(anchoredIssueSentence).join(' ');
  return normalizeWhitespace(
    `Using the chosen style and medium lens, the work still reads as early-stage rather than as successful advanced stylization. ${localRead} These visible problems do not support high ratings across the criteria.`
  );
}

function buildSpecificNoviceImprove(critique: CritiqueResultDTO): string {
  const weakest = weakestAnchoredCategories(critique, 2);
  const localRead = weakest.map(anchoredIssueSentence).join(' ');
  return normalizeWhitespace(
    `This work still reads as an early-stage drawing rather than as advanced expressive simplification. ${localRead} The current shape control, value structure, and edge hierarchy are still too undeveloped to justify higher ratings.`
  );
}

function buildSpecificNovicePriorities(critique: CritiqueResultDTO): string[] {
  const priorities = weakestAnchoredCategories(critique, 2).map(anchoredPriorityLine);
  return priorities.length > 0
    ? priorities
    : [
        'Focus on the weakest visible passage: simplify its value groups before pushing stylization further.',
        'Focus on the main focal passage: separate it from nearby shapes with clearer edge decisions.',
      ];
}

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
            analysis: buildSpecificNoviceAnalysis({ ...critique, categories: adjustedCategories }),
            topPriorities: buildSpecificNovicePriorities({ ...critique, categories: adjustedCategories }),
          }
        : critique.overallSummary,
      simpleFeedback: critique.simpleFeedback
        ? {
            ...critique.simpleFeedback,
            studioAnalysis: {
              ...critique.simpleFeedback.studioAnalysis,
              whatCouldImprove: buildSpecificNoviceImprove({ ...critique, categories: adjustedCategories }),
            },
          }
        : critique.simpleFeedback,
    };
    return hybridizeVoiceBFromStructuredFields(
      rebalanceEdgeSurfaceIntermediateCluster(normalizeActionPlansToLevels(adjusted))
    );
  }
  return hybridizeVoiceBFromStructuredFields(
    rebalanceEdgeSurfaceIntermediateCluster(normalizeActionPlansToLevels(critique))
  );
}
