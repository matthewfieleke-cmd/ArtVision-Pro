import { CRITERIA_ORDER } from '../shared/criteria.js';
import { phase2Text, phase3Text } from '../shared/critiquePhaseText.js';
import type { CritiqueInstrumenter } from './critiqueInstrumentation.js';
import { noopCritiqueInstrumenter } from './critiqueInstrumentation.js';
import { splitNumberedSteps } from './numberedSteps.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import { isVagueOrGenericStudioText } from './critiqueTextRules.js';
import { hasAnchorReference } from './critiqueGrounding.js';
import { renderStructuredVoiceBStep } from './critiqueVoiceBProse.js';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const SOFT_WORKSHOP_BOILERPLATE_PATTERN =
  /\b(harmonious|harmony|narrative connection|moment of contemplation|contemplative mood|connection with nature|human presence|visual interest|balanced composition|dynamic composition|dynamic tension|guides? the viewer'?s eye|leading the eye|supports the mood|integrated into the landscape|suggests rest|suggests contemplation|atmospheric effect|vibrant palette|cohesive|cohesion)\b/i;
const GENERIC_STRUCTURED_PHRASE_PATTERN =
  /\b(add(?:ing)? more definition|without disrupting|remain harmonious|support the overall mood|background figures?|figures? in the background|enhance(?:\s+the)?\s+(?:spatial depth|vibrancy|coherence|clarity|medium handling)|maintain(?:ing)?\s+(?:the\s+)?overall\s+(?:spatial coherence|coherence|mood|clarity|balance)|ensure\b[^.]{0,80}\b(?:harmonious|coherent|clarity|spatial coherence)|refine(?:\s+the)?\s+(?:texture|color)\s+transitions|blend more naturally|integrate(?:\s+\w+){0,4}\s+(?:scene|background|atmosphere)|overall atmosphere|without losing(?:\s+\w+){0,4}\s+presence|introduce more varied texture|using a combination of|more engaging|stand out more distinctly|enhancing(?:\s+\w+){0,4}\s+presence|key spatial relationship)\b/i;

function needsStructuredStudioRewrite(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  return (
    isVagueOrGenericStudioText(normalized) ||
    SOFT_WORKSHOP_BOILERPLATE_PATTERN.test(normalized) ||
    GENERIC_STRUCTURED_PHRASE_PATTERN.test(normalized)
  );
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

function anchoredCategoryMatchesText(
  text: string,
  category: CritiqueResultDTO['categories'][number]
): boolean {
  return hasAnchorReference(
    text,
    category.anchor?.areaSummary ?? '',
    category.anchor?.evidencePointer ?? '',
    'strictAudit'
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
    return hasAnchorReference(
      change.text,
      category.anchor.areaSummary,
      category.anchor.evidencePointer,
      'strictAudit'
    );
  });
}

function summaryLayerNeedsStructuredRewrite(critique: CritiqueResultDTO): boolean {
  if (!critique.simpleFeedback) return false;

  const topPriorities = critique.overallSummary?.topPriorities ?? [];
  if (
    topPriorities.length === 0 ||
    topPriorities.some(
      (priority) =>
        !normalizeWhitespace(priority) ||
        needsStructuredStudioRewrite(priority) ||
        distinctAnchorMentions(priority, critique, { limit: 1 }) < 1
    )
  ) {
    return true;
  }

  const categoryByCriterion = new Map(
    critique.categories.map((category) => [category.criterion, category] as const)
  );

  if (critique.simpleFeedback.studioChanges.length < 2) return true;
  return critique.simpleFeedback.studioChanges.some((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    return !category || needsStructuredStudioRewrite(change.text) || !anchoredCategoryMatchesText(change.text, category);
  });
}

export function critiqueNeedsFreshEvidenceRead(critique: CritiqueResultDTO): boolean {
  for (const category of critique.categories) {
    const anchor = category.anchor;
    if (!anchor) return true;
    if (!hasAnchorReference(phase2Text(category), anchor.areaSummary, anchor.evidencePointer, 'strictAudit')) return true;
    if (!hasAnchorReference(phase3Text(category), anchor.areaSummary, anchor.evidencePointer, 'strictAudit')) return true;
    if (!normalizedContains(category.editPlan?.targetArea ?? '', anchor.areaSummary)) return true;
  }
  return !topLevelVoicesStayGrounded(critique) || !alignedStudioChanges(critique);
}

type GuardrailCategory = 'normalization' | 'repair' | 'policyOverride';

function guardrailChanged(before: CritiqueResultDTO, after: CritiqueResultDTO): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function applyGuardrailStep(
  critique: CritiqueResultDTO,
  category: GuardrailCategory,
  label: string,
  fn: (input: CritiqueResultDTO) => CritiqueResultDTO,
  instrumenter: CritiqueInstrumenter
): CritiqueResultDTO {
  const next = fn(critique);
  if (guardrailChanged(critique, next)) {
    instrumenter.recordMutation(category, label);
  }
  return next;
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


function ensureTrailingPeriod(text: string): string {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function concretePhrase(text: string): string {
  return normalizeWhitespace(text)
    .replace(/[.!?;,]+$/, '')
    .replace(/^[A-Z]/, (m) => m.toLowerCase());
}

function looksConceptualLabel(text: string): boolean {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return true;
  return (
    /\b(left side of the painting|right side of the painting|background colors?|background color transitions|background figures?|color transitions|peripheral elements|narrative focus|story|composition overall)\b/i.test(
      normalized
    ) ||
    (!/[,'’\-]/.test(normalized) &&
      /\b(arrangement|transitions|elements|background|foreground|narrative|composition|integration)\b/i.test(normalized))
  );
}

function firstUsableStructuredPhrase(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const normalized = concretePhrase(candidate ?? '');
    if (!normalized) continue;
    if (
      /\b(more depth|better narrative|improve realism|enhanced clarity|more cohesive|more integrated|needs more structure|feels unresolved)\b/i.test(
        normalized
      )
    ) {
      continue;
    }
    if (GENERIC_STRUCTURED_PHRASE_PATTERN.test(normalized)) continue;
    if (needsStructuredStudioRewrite(normalized)) continue;
    return normalized;
  }
  return '';
}

function bestAnchoredArea(category: CritiqueResultDTO['categories'][number]): string {
  const candidates = [
    category.anchor?.areaSummary,
    category.editPlan?.targetArea,
    category.actionPlanSteps?.[0]?.area,
  ]
    .map((candidate) => normalizeWhitespace(candidate ?? ''))
    .filter(Boolean);
  const concrete = candidates.find((candidate) => !looksConceptualLabel(candidate));
  return concrete ?? candidates[0] ?? category.criterion.toLowerCase();
}

function bestAnchoredIssue(category: CritiqueResultDTO['categories'][number]): string {
  return (
    firstUsableStructuredPhrase(
      category.editPlan?.issue,
      category.actionPlanSteps?.[0]?.currentRead,
      category.voiceBPlan?.currentRead,
      category.anchor?.evidencePointer,
      firstSentence(phase2Text(category))
    ) || 'the current relationship still needs a more deliberate read'
  );
}

function bestAnchoredMove(category: CritiqueResultDTO['categories'][number]): string {
  const structured =
    firstUsableStructuredPhrase(
      category.editPlan?.intendedChange,
      category.actionPlanSteps?.[0]?.move,
      category.voiceBPlan?.bestNextMove
    );
  if (structured) return structured;

  const area = bestAnchoredArea(category);
  switch (category.criterion) {
    case 'Composition and shape structure':
      return `group the main shape break in ${area} so one side of that passage reads more clearly than the other`;
    case 'Value and light structure':
      return `separate the lighter passage from the darker neighbor in ${area}`;
    case 'Color relationships':
      return `shift the warmest note in ${area} a little cooler so the surrounding color family holds together`;
    case 'Drawing, proportion, and spatial form':
      return `restate the main overlap in ${area} so the form sits more convincingly in space`;
    case 'Edge and focus control':
      return `sharpen the clearest edge in ${area} against the neighboring shape while losing a nearby edge in that same passage`;
    case 'Surface and medium handling':
      return `vary two or three repeated marks in ${area} so the surface reads less patterned and more deliberate`;
    case 'Intent and necessity':
      return `quiet the least necessary accent in ${area} so that passage carries the painting's intent more decisively`;
    case 'Presence, point of view, and human force':
      return `quiet the weaker accent around ${area} so that passage carries the human pressure more clearly`;
    default:
      return `make one clearer directional adjustment in ${area}`;
  }
}

function bestAnchoredOutcome(category: CritiqueResultDTO['categories'][number]): string {
  const structured =
    firstUsableStructuredPhrase(
      category.editPlan?.expectedOutcome,
      category.actionPlanSteps?.[0]?.expectedRead,
      category.voiceBPlan?.expectedRead
    );
  if (structured) return structured;

  switch (category.criterion) {
    case 'Composition and shape structure':
      return 'the route through that passage reads more deliberately';
    case 'Value and light structure':
      return 'the light-dark separation reads sooner';
    case 'Color relationships':
      return 'the color relationship holds together without flattening';
    case 'Drawing, proportion, and spatial form':
      return 'the form sits more convincingly in space';
    case 'Edge and focus control':
      return 'the focus hierarchy reads more clearly in that passage';
    case 'Surface and medium handling':
      return 'the handling reads more deliberate in that passage';
    case 'Intent and necessity':
      return "the painting's intent reads more decisively through that passage";
    case 'Presence, point of view, and human force':
      return 'the human pressure stays centered in that passage';
    default:
      return 'the passage reads with more deliberate control';
  }
}

function fallbackVoiceBStep(category: CritiqueResultDTO['categories'][number], index: number): string {
  const area = bestAnchoredArea(category);
  const issue = bestAnchoredIssue(category);
  const move = bestAnchoredMove(category);
  const outcome = bestAnchoredOutcome(category);
  return renderStructuredVoiceBStep({ index, area, issue, move, outcome });
}

function rewriteActionPlanFromStructuredFields(
  category: CritiqueResultDTO['categories'][number]
): string {
  if (category.level === 'Master') return phase3Text(category);
  const existingSteps = splitNumberedSteps(phase3Text(category));
  const steps: string[] = [];
  const usedNormalizedSteps = new Set<string>();
  for (let i = 0; i < existingSteps.length; i++) {
    const existing = existingSteps[i];
    const normalizedExisting = existing ? normalizeWhitespace(existing).toLowerCase() : '';
    if (
      existing &&
      !needsStructuredStudioRewrite(existing) &&
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
  if (steps.length === 0) {
    steps.push(fallbackVoiceBStep(category, 0));
  }
  return steps.join('\n');
}

function rewriteStudioChangeFromStructuredFields(
  category: CritiqueResultDTO['categories'][number],
  existingText?: string
): string {
  if (category.level === 'Master') {
    const preserved = firstUsableStructuredPhrase(category.anchor?.evidencePointer, category.editPlan?.preserveArea);
    return `Preserve ${preserved || bestAnchoredArea(category)}.`;
  }

  const area = bestAnchoredArea(category);
  const issue = bestAnchoredIssue(category);
  const move = bestAnchoredMove(category);
  const outcome =
    firstUsableStructuredPhrase(
      category.editPlan?.expectedOutcome,
      category.actionPlanSteps?.[0]?.expectedRead,
      category.voiceBPlan?.expectedRead
    ) || 'the painting reads more clearly afterward';

  if (
    existingText &&
    !needsStructuredStudioRewrite(existingText) &&
    anchoredCategoryMatchesText(existingText, category)
  ) {
    return existingText;
  }

  return renderStructuredVoiceBStep({ area, issue, move, outcome });
}

function forceStructuredTeachingPass(critique: CritiqueResultDTO): CritiqueResultDTO {
  const hasGenericCategoryAdvice = critique.categories.some(
    (category) => category.level !== 'Master' && needsStructuredStudioRewrite(phase3Text(category))
  );
  const hasGenericStudioChanges = critique.simpleFeedback?.studioChanges.some((change) =>
    needsStructuredStudioRewrite(change.text)
  );
  if (!hasGenericCategoryAdvice && !hasGenericStudioChanges) return critique;

  const categories = critique.categories.map((category) =>
    category.level === 'Master'
      ? category
      : {
          ...category,
          phase3: {
            teacherNextSteps: fallbackVoiceBStep(category, 0),
          },
        }
  );

  if (!critique.simpleFeedback) {
    return { ...critique, categories };
  }

  const categoryByCriterion = new Map(categories.map((category) => [category.criterion, category] as const));
  const studioChanges = critique.simpleFeedback.studioChanges.map((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    if (!category) return change;
    return {
      ...change,
      text: rewriteStudioChangeFromStructuredFields(category),
    };
  });

  return {
    ...critique,
    categories,
    simpleFeedback: {
      ...critique.simpleFeedback,
      studioChanges,
    },
  };
}

function rewriteCriticAnalysisFromAnchor(
  category: CritiqueResultDTO['categories'][number]
): string {
  const existing = phase2Text(category);
  if (anchoredCategoryMatchesText(existing, category)) return existing;
  const area = bestAnchoredArea(category);
  const pointer =
    firstUsableStructuredPhrase(
      category.anchor?.evidencePointer,
      category.editPlan?.issue,
      category.actionPlanSteps?.[0]?.currentRead
    ) || `the visible relationships in ${area}`;
  const issue = bestAnchoredIssue(category);
  return `In ${area}, ${pointer}. ${sentenceCase(issue)}.`;
}

function stabilizeCriticAnchorReferences(critique: CritiqueResultDTO): CritiqueResultDTO {
  let changed = false;
  const categories = critique.categories.map((category) => {
    const rewritten = rewriteCriticAnalysisFromAnchor(category);
    if (rewritten === phase2Text(category)) return category;
    changed = true;
    return {
      ...category,
      phase2: {
        criticsAnalysis: rewritten,
      },
    };
  });
  return changed ? { ...critique, categories } : critique;
}

function hybridizeVoiceBFromStructuredFields(critique: CritiqueResultDTO): CritiqueResultDTO {
  let changed = false;
  const categories = critique.categories.map((category) => {
    if (category.level === 'Master') return category;
    const rewritten = rewriteActionPlanFromStructuredFields(category);
    if (rewritten === phase3Text(category)) return category;
    changed = true;
    return {
      ...category,
      phase3: {
        teacherNextSteps: rewritten,
      },
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

function strongestAnchoredCategories(
  critique: CritiqueResultDTO,
  limit: number
): CritiqueResultDTO['categories'] {
  return [...critique.categories]
    .filter((category) => category.anchor)
    .sort((a, b) => {
      const aRank = a.level ? LEVEL_RANK[a.level] : LEVEL_RANK.Intermediate;
      const bRank = b.level ? LEVEL_RANK[b.level] : LEVEL_RANK.Intermediate;
      if (aRank !== bRank) return bRank - aRank;
      return CRITERIA_ORDER.indexOf(a.criterion) - CRITERIA_ORDER.indexOf(b.criterion);
    })
    .slice(0, limit);
}

function anchoredStrengthSentence(category: CritiqueResultDTO['categories'][number]): string {
  const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
  const strengthSource =
    category.anchor?.evidencePointer?.trim() ||
    category.editPlan?.preserveArea?.trim() ||
    firstSentence(phase2Text(category));
  if (!strengthSource) {
    return `In ${area}, the anchored passage already carries one of the painting's clearer strengths.`;
  }
  const strength = sentenceCase(strengthSource);
  if (normalizedContains(strength, area)) return `${strength}.`;
  return `In ${area}, ${strength.charAt(0).toLowerCase()}${strength.slice(1)}.`;
}

function anchoredIssueSentence(category: CritiqueResultDTO['categories'][number]): string {
  const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
  const issueSource =
    category.editPlan?.issue?.trim() ||
    category.anchor?.evidencePointer?.trim() ||
    firstSentence(phase2Text(category));
  if (!issueSource) {
    return `In ${area}, the structure is still too underdeveloped for a higher read.`;
  }
  const issue = sentenceCase(issueSource);
  if (normalizedContains(issue, area)) return `${issue}.`;
  return `In ${area}, ${issue.charAt(0).toLowerCase()}${issue.slice(1)}.`;
}

function anchoredPriorityLine(category: CritiqueResultDTO['categories'][number]): string {
  const area = category.anchor?.areaSummary?.trim() || category.criterion.toLowerCase();
  const intendedChange = bestAnchoredMove(category);
  if (intendedChange) return `Focus on ${area}: ${ensureTrailingPeriod(intendedChange)}`;
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

function buildGroundedSummary(critique: CritiqueResultDTO): string {
  const strongest = strongestAnchoredCategories(critique, 1);
  const weakest = weakestAnchoredCategories(critique, 1);
  return normalizeWhitespace(
    [strongest.map(anchoredStrengthSentence).join(' '), weakest.map(anchoredIssueSentence).join(' ')].join(' ')
  );
}

function buildGroundedOverallAnalysis(critique: CritiqueResultDTO): string {
  const strongest = strongestAnchoredCategories(critique, 1);
  const weakest = weakestAnchoredCategories(critique, 1);
  return normalizeWhitespace(
    `${strongest.map(anchoredStrengthSentence).join(' ')} ${weakest.map(anchoredIssueSentence).join(' ')} These mixed signals keep the work from reading as fully resolved across the rubric.`
  );
}

function buildGroundedWhatWorks(critique: CritiqueResultDTO): string {
  const strongest = strongestAnchoredCategories(critique, 2);
  return normalizeWhitespace(
    `${strongest.map(anchoredStrengthSentence).join(' ')} These are the clearest passages already working in the painting's favor.`
  );
}

function buildGroundedWhatCouldImprove(critique: CritiqueResultDTO): string {
  const weakest = weakestAnchoredCategories(critique, 2);
  return normalizeWhitespace(
    `${weakest.map(anchoredIssueSentence).join(' ')} Those passages are the main leverage points for the next pass.`
  );
}

function rebuildTopLevelGroundedVoices(critique: CritiqueResultDTO): CritiqueResultDTO {
  const currentSummary = critique.summary ?? '';
  const currentAnalysis = critique.overallSummary?.analysis ?? '';
  const currentWhatWorks = critique.simpleFeedback?.studioAnalysis.whatWorks ?? '';
  const currentWhatCouldImprove = critique.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '';

  const nextSummary =
    distinctAnchorMentions(currentSummary, critique, { limit: 1 }) >= 1
      ? currentSummary
      : buildGroundedSummary(critique);
  const nextAnalysis =
    distinctAnchorMentions(currentAnalysis, critique, { limit: 2 }) >= 2
      ? currentAnalysis
      : buildGroundedOverallAnalysis(critique);
  const nextWhatWorks =
    distinctAnchorMentions(currentWhatWorks, critique, { limit: 1 }) >= 1
      ? currentWhatWorks
      : buildGroundedWhatWorks(critique);
  const nextWhatCouldImprove =
    distinctAnchorMentions(currentWhatCouldImprove, critique, { limit: 1 }) >= 1
      ? currentWhatCouldImprove
      : buildGroundedWhatCouldImprove(critique);

  if (
    nextSummary === currentSummary &&
    nextAnalysis === currentAnalysis &&
    nextWhatWorks === currentWhatWorks &&
    nextWhatCouldImprove === currentWhatCouldImprove
  ) {
    return critique;
  }

  return {
    ...critique,
    summary: nextSummary,
    overallSummary: critique.overallSummary
      ? {
          ...critique.overallSummary,
          analysis: nextAnalysis,
        }
      : critique.overallSummary,
    simpleFeedback: critique.simpleFeedback
      ? {
          ...critique.simpleFeedback,
          studioAnalysis: {
            ...critique.simpleFeedback.studioAnalysis,
            whatWorks: nextWhatWorks,
            whatCouldImprove: nextWhatCouldImprove,
          },
        }
      : critique.simpleFeedback,
  };
}

function rebuildStructuredSummaryFromCategories(critique: CritiqueResultDTO): CritiqueResultDTO {
  if (!critique.simpleFeedback || !summaryLayerNeedsStructuredRewrite(critique)) return critique;

  const studioChangeCount = Math.max(2, Math.min(5, critique.simpleFeedback.studioChanges.length || 2));
  const summaryCategories = weakestAnchoredCategories(critique, studioChangeCount);
  const priorityCategories = weakestAnchoredCategories(critique, 2);

  return {
    ...critique,
    overallSummary: critique.overallSummary
      ? {
          ...critique.overallSummary,
          topPriorities: priorityCategories.map(anchoredPriorityLine),
        }
      : critique.overallSummary,
    simpleFeedback: {
      ...critique.simpleFeedback,
      studioChanges: summaryCategories.map((category) => ({
        previewCriterion: category.criterion,
        text: rewriteStudioChangeFromStructuredFields(category),
      })),
    },
  };
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
        phase2Text(category),
        phase3Text(category),
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

const PRESERVATION_LEAD = /^\s*\d*[.\)]*\s*(maintain|preserve|keep|continue|protect)\b/i;

function isPreservationOnlyPlan(actionPlan: string): boolean {
  const steps = splitNumberedSteps(actionPlan);
  if (steps.length === 0) {
    return PRESERVATION_LEAD.test(actionPlan.trim());
  }
  return steps.every((step) => PRESERVATION_LEAD.test(step.trim()));
}

function buildImprovementFallback(cat: CritiqueResultDTO['categories'][number]): string {
  const area = bestAnchoredArea(cat);
  const nextBand =
    cat.level === 'Beginner'
      ? 'Intermediate'
      : cat.level === 'Intermediate'
        ? 'Advanced'
        : 'Master';
  const issue = bestAnchoredIssue(cat);
  const move = bestAnchoredMove(cat);
  if (issue && move) {
    return `1. In ${area}, ${issue}\u2014${move} to push this criterion toward ${nextBand}.`;
  }
  return `1. In ${area}, identify the single visible relationship that most limits this criterion at ${cat.level} and make one concrete adjustment toward ${nextBand}.`;
}

/** Voice B must only use "Don't change a thing" when level is Master; fix model drift including preservation-only advice. */
function normalizeActionPlansToLevels(critique: CritiqueResultDTO): CritiqueResultDTO {
  const dontChange = /^don['\u2019]t change a thing[.!]?\s*/i;
  let changed = false;
  const categories = critique.categories.map((cat) => {
    if (cat.level === 'Master') return cat;
    const raw = phase3Text(cat).trim();

    if (dontChange.test(raw)) {
      const stripped = raw.replace(dontChange, '').trim();
      if (/^1[\.\)]\s/m.test(stripped) && stripped.length >= 50 && !isPreservationOnlyPlan(stripped)) {
        changed = true;
        return {
          ...cat,
          phase3: {
            teacherNextSteps: stripped,
          },
        };
      }
      changed = true;
      return {
        ...cat,
        phase3: {
          teacherNextSteps: buildImprovementFallback(cat),
        },
      };
    }

    if (isPreservationOnlyPlan(raw)) {
      changed = true;
      return {
        ...cat,
        phase3: {
          teacherNextSteps: buildImprovementFallback(cat),
        },
      };
    }

    return cat;
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
    const currentFeedback = phase2Text(cat);
    const feedback = currentFeedback.includes('Read at Advanced on this capture')
      ? currentFeedback
      : `${currentFeedback.trim()}${bandNote}`;
    return {
      ...cat,
      level: 'Advanced' as const,
      nextTarget,
      phase2: {
        criticsAnalysis: feedback,
      },
      ...(subskills ? { subskills } : {}),
    };
  });

  return changed ? { ...critique, categories } : critique;
}

export function applyCritiqueGuardrails(
  critique: CritiqueResultDTO,
  instrumenter: CritiqueInstrumenter = noopCritiqueInstrumenter
): CritiqueResultDTO {
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
    if (guardrailChanged(critique, adjusted)) {
      instrumenter.recordMutation('policyOverride', 'noviceLikeOverrated');
    }
    let next = adjusted;
    next = applyGuardrailStep(
      next,
      'repair',
      'normalizeActionPlansToLevels',
      normalizeActionPlansToLevels,
      instrumenter
    );
    next = applyGuardrailStep(
      next,
      'policyOverride',
      'rebalanceEdgeSurfaceIntermediateCluster',
      rebalanceEdgeSurfaceIntermediateCluster,
      instrumenter
    );
    next = applyGuardrailStep(
      next,
      'normalization',
      'stabilizeCriticAnchorReferences',
      stabilizeCriticAnchorReferences,
      instrumenter
    );
    next = applyGuardrailStep(
      next,
      'repair',
      'hybridizeVoiceBFromStructuredFields',
      hybridizeVoiceBFromStructuredFields,
      instrumenter
    );
    next = applyGuardrailStep(
      next,
      'repair',
      'rebuildTopLevelGroundedVoices',
      rebuildTopLevelGroundedVoices,
      instrumenter
    );
    return next;
  }
  let next = applyGuardrailStep(
    critique,
    'repair',
    'normalizeActionPlansToLevels',
    normalizeActionPlansToLevels,
    instrumenter
  );
  next = applyGuardrailStep(
    next,
    'policyOverride',
    'rebalanceEdgeSurfaceIntermediateCluster',
    rebalanceEdgeSurfaceIntermediateCluster,
    instrumenter
  );
  next = applyGuardrailStep(
    next,
    'normalization',
    'stabilizeCriticAnchorReferences',
    stabilizeCriticAnchorReferences,
    instrumenter
  );
  next = applyGuardrailStep(
    next,
    'repair',
    'hybridizeVoiceBFromStructuredFields',
    hybridizeVoiceBFromStructuredFields,
    instrumenter
  );
  next = applyGuardrailStep(
    next,
    'repair',
    'rebuildTopLevelGroundedVoices',
    rebuildTopLevelGroundedVoices,
    instrumenter
  );
  next = applyGuardrailStep(
    next,
    'repair',
    'rebuildStructuredSummaryFromCategories',
    rebuildStructuredSummaryFromCategories,
    instrumenter
  );
  return applyGuardrailStep(
    next,
    'repair',
    'forceStructuredTeachingPass',
    forceStructuredTeachingPass,
    instrumenter
  );
}
