import {
  canonicalCriterionLabel,
  CRITERIA_ORDER,
} from '../shared/criteria';
import type {
  CritiqueCategory,
  CritiqueConfidence,
  CritiqueResult,
  CritiqueSimpleFeedback,
  Criterion,
  OverallSummaryCard,
  PhotoQualityAssessment,
  RatingLevel,
} from './types';

const LEVEL_ORDER: RatingLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Master'];
const CONFIDENCE_ORDER: CritiqueConfidence[] = ['low', 'medium', 'high'];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function criticText(category: CritiqueCategory): string {
  return category.phase2.criticsAnalysis;
}

function teacherText(category: CritiqueCategory): string {
  return category.phase3.teacherNextSteps;
}

function ensureSentence(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function lowerFirst(text: string): string {
  if (!text) return '';
  if (/^[A-Z][a-z]/.test(text)) return text.charAt(0).toLowerCase() + text.slice(1);
  return text;
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.!?;,]+$/, '').trim();
}

const ANCHOR_GENERIC_TOKENS = new Set([
  'area', 'areas', 'color', 'colors', 'edge', 'edges', 'form', 'forms',
  'light', 'paint', 'space', 'style', 'surface', 'texture', 'value',
  'values', 'composition', 'structure', 'handling', 'focus', 'control',
  'painting', 'canvas', 'work', 'piece', 'image', 'scene', 'overall',
  'main', 'some', 'more', 'most', 'less', 'with', 'from', 'into',
  'between', 'across', 'within', 'where', 'that', 'this', 'these',
  'those', 'there', 'their', 'which', 'about', 'through', 'around',
]);

function actionPlanReferencesAnchor(actionPlan: string, anchor?: { areaSummary?: string }): boolean {
  if (!anchor?.areaSummary) return false;
  const plan = normalizeWhitespace(actionPlan).toLowerCase();
  const summary = normalizeWhitespace(anchor.areaSummary).toLowerCase();
  if (!summary || summary.length < 4) return false;
  if (plan.includes(summary)) return true;
  const tokens = summary.split(/\s+/).filter(
    (t) => t.length >= 4 && !ANCHOR_GENERIC_TOKENS.has(t)
  );
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => plan.includes(t)).length;
  return matched >= Math.max(2, Math.ceil(tokens.length * 0.6));
}

function stripRedundantPreserve(text: string): string {
  return text
    .replace(/\s+should be (preserved|maintained|protected)\.?$/i, '')
    .replace(/\s+needs? to be (preserved|maintained|protected)\.?$/i, '')
    .trim();
}

function deriveActionPlanFromSteps(
  steps?: Array<{
    area: string;
    currentRead: string;
    move: string;
    expectedRead: string;
    preserve?: string;
  }>
): string | undefined {
  if (!steps?.length) return undefined;
  const lines = steps
    .map((step, index) => {
      const area = normalizeWhitespace(step.area);
      const currentRead = stripTrailingPunctuation(lowerFirst(normalizeWhitespace(step.currentRead)));
      const move = stripTrailingPunctuation(lowerFirst(normalizeWhitespace(step.move)));
      const expectedRead = stripTrailingPunctuation(lowerFirst(normalizeWhitespace(step.expectedRead)));
      const rawPreserve = normalizeWhitespace(step.preserve ?? '');
      const preserve = stripTrailingPunctuation(lowerFirst(stripRedundantPreserve(rawPreserve)));
      if (!area || !move || !expectedRead) return '';
      let sentence = `In ${area}, ${currentRead || 'the current read still needs work'}—${move}, so that ${expectedRead}`;
      if (preserve) sentence += `. Protect ${preserve}`;
      return `${index + 1}. ${ensureSentence(sentence)}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : undefined;
}

function capConfidence(
  confidence: CritiqueConfidence,
  maxConfidence: CritiqueConfidence
): CritiqueConfidence {
  const idx = Math.min(
    CONFIDENCE_ORDER.indexOf(confidence),
    CONFIDENCE_ORDER.indexOf(maxConfidence)
  );
  return CONFIDENCE_ORDER[Math.max(0, idx)] ?? 'low';
}

export function levelWidth(level: RatingLevel): string {
  const pct = ((LEVEL_ORDER.indexOf(level) + 1) / LEVEL_ORDER.length) * 100;
  return `${Math.max(25, pct)}%`;
}

export function nextRatingLevel(level: RatingLevel): RatingLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1]! : null;
}

export function defaultNextTarget(criterion: Criterion, level: RatingLevel): string {
  const next = nextRatingLevel(level);
  const label = criterion.toLowerCase();
  if (!next) {
    return `Sustain ${label} while taking one measured risk.`;
  }
  return `Push ${label} toward ${next}.`;
}

export function confidenceLabel(confidence: CritiqueConfidence): string {
  switch (confidence) {
    case 'high':
      return 'strong read';
    case 'medium':
      return 'usable read';
    default:
      return 'provisional';
  }
}

export function deriveOverallConfidence(
  categories: CritiqueCategory[],
  photoQuality?: PhotoQualityAssessment
): CritiqueConfidence {
  const numeric: number[] = categories.map((cat) => {
    switch (cat.confidence) {
      case 'high':
        return 2;
      case 'medium':
        return 1;
      default:
        return 0;
    }
  });
  const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 1;
  let confidence: CritiqueConfidence = avg >= 1.55 ? 'high' : avg >= 0.8 ? 'medium' : 'low';

  if (photoQuality?.level === 'fair') confidence = capConfidence(confidence, 'medium');
  if (photoQuality?.level === 'poor') confidence = 'low';
  return confidence;
}

function fallbackSimpleRead(categories: CritiqueCategory[]): CritiqueSimpleFeedback {
  const levelRank = (level?: RatingLevel): number =>
    level ? LEVEL_ORDER.indexOf(level) : LEVEL_ORDER.indexOf('Intermediate');
  const sorted = [...categories].sort((a, b) => levelRank(a.level) - levelRank(b.level));
  const mainIssue = sorted[0] ?? categories[0];
  const strongest = [...categories].sort((a, b) => levelRank(b.level) - levelRank(a.level));
  const keep = strongest[0] ?? categories[0];
  const planPairs = sorted
    .map((cat) => ({ cat, plan: teacherText(cat).trim() }))
    .filter((x): x is { cat: CritiqueCategory; plan: string } => Boolean(x.plan && x.plan.length > 0))
    .slice(0, 5);
  const strengthCats = strongest
    .filter((cat) => levelRank(cat.level) >= LEVEL_ORDER.indexOf('Advanced'))
    .slice(0, 2);
  const whatWorksParts: string[] = [];
  if (strengthCats.length) {
    for (const cat of strengthCats) {
      const p = cat.preserve?.trim();
      if (p) whatWorksParts.push(`${cat.criterion}: ${p}`);
    }
  }
  const whatWorks =
    whatWorksParts.length > 0
      ? whatWorksParts.join(' ')
      : keep?.preserve?.trim() ||
        'The capture already suggests at least one passage worth building around while you address weaker structure elsewhere.';

  const whatCouldImprove =
    (mainIssue ? criticText(mainIssue).trim() : '') ||
    'One structural area still lags the rest; use the detailed categories below to prioritize before smaller fixes.';

  const studioChanges: CritiqueSimpleFeedback['studioChanges'] = planPairs.map(({ cat, plan }) => ({
    text: plan,
    previewCriterion: cat.criterion,
  }));
  while (studioChanges.length < 2) {
    const cat = sorted[studioChanges.length] ?? mainIssue;
    studioChanges.push({
      text:
        'Choose the weakest visible passage, simplify its value groups, then rebuild it against the strongest silhouette already working in the piece.',
      previewCriterion: cat!.criterion,
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

/** Migrate saved critiques that used readOfWork / nextSteps into studioAnalysis + studioChanges. */
export function migrateCritiqueSimpleFeedback(
  simple: CritiqueSimpleFeedback | (Record<string, unknown> & Partial<CritiqueSimpleFeedback>)
): CritiqueSimpleFeedback | undefined {
  if (!simple || typeof simple !== 'object') return undefined;
  const s = simple as Record<string, unknown>;
  if (
    s.studioAnalysis &&
    typeof s.studioAnalysis === 'object' &&
    Array.isArray(s.studioChanges)
  ) {
    const sa = s.studioAnalysis as { whatWorks?: string; whatCouldImprove?: string };
    const changes = (s.studioChanges as CritiqueSimpleFeedback['studioChanges']).map((ch) => ({
      text: ch.text,
      previewCriterion: canonicalCriterionLabel(ch.previewCriterion) ?? ch.previewCriterion,
    }));
    return {
      studioAnalysis: {
        whatWorks: typeof sa.whatWorks === 'string' ? sa.whatWorks : '',
        whatCouldImprove: typeof sa.whatCouldImprove === 'string' ? sa.whatCouldImprove : '',
      },
      studioChanges: changes,
    };
  }
  const readOfWork = typeof s.readOfWork === 'string' ? s.readOfWork : '';
  const working = Array.isArray(s.working) ? (s.working as string[]).filter((x) => typeof x === 'string') : [];
  const mainIssue = typeof s.mainIssue === 'string' ? s.mainIssue : '';
  const nextSteps = Array.isArray(s.nextSteps) ? (s.nextSteps as string[]).filter((x) => typeof x === 'string') : [];
  const preserve = typeof s.preserve === 'string' ? s.preserve : '';

  const whatWorks =
    working.length > 0
      ? [readOfWork, ...working.map((w) => w.trim())].filter(Boolean).join(' ')
      : readOfWork || 'Strengths are summarized in the detailed categories below.';

  const whatCouldImprove =
    mainIssue.trim() ||
    'Areas to develop are detailed in the criterion breakdown below.';

  const studioChanges: CritiqueSimpleFeedback['studioChanges'] = [];
  for (let i = 0; i < nextSteps.length && studioChanges.length < 5; i++) {
    const text = nextSteps[i]!.trim();
    if (text.length < 4) continue;
    studioChanges.push({
      text,
      previewCriterion: CRITERIA_ORDER[Math.min(i, CRITERIA_ORDER.length - 1)]!,
    });
  }
  while (studioChanges.length < 2) {
    studioChanges.push({
      text:
        preserve.trim().length > 0
          ? `Protect the strongest passage while refining one adjacent area: ${preserve.slice(0, 100)}${preserve.length > 100 ? '…' : ''}`
          : 'Choose one weak passage and restate it with simpler value groups before adding detail.',
      previewCriterion: CRITERIA_ORDER[studioChanges.length % CRITERIA_ORDER.length]!,
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

function deriveOverallSummaryFromSimple(simple: CritiqueSimpleFeedback): OverallSummaryCard {
  const analysis = [simple.studioAnalysis.whatWorks, simple.studioAnalysis.whatCouldImprove]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
  return {
    analysis: analysis.length > 0 ? analysis : 'See the criterion cards below for detailed feedback.',
    topPriorities: simple.studioChanges.map((ch) => ch.text.trim()).filter(Boolean),
  };
}

export function finalizeCritiqueResult(
  critique: CritiqueResult,
  options?: {
    photoQuality?: PhotoQualityAssessment;
  }
): CritiqueResult {
  const categories = critique.categories.map((cat) => ({
    ...cat,
    criterion:
      typeof cat.criterion === 'string'
        ? canonicalCriterionLabel(cat.criterion) ?? (cat.criterion as Criterion)
        : cat.criterion,
    nextTarget:
      cat.nextTarget ??
      (cat.level
        ? defaultNextTarget(
            typeof cat.criterion === 'string'
              ? canonicalCriterionLabel(cat.criterion) ?? (cat.criterion as Criterion)
              : cat.criterion,
            cat.level
          )
        : undefined),
    phase3: {
      teacherNextSteps:
        teacherText(cat) &&
        normalizeWhitespace(teacherText(cat)).length > 0 &&
        actionPlanReferencesAnchor(teacherText(cat), cat.anchor)
          ? teacherText(cat)
          : deriveActionPlanFromSteps(cat.actionPlanSteps) ?? teacherText(cat),
    },
  }));
  const photoQuality = options?.photoQuality ?? critique.photoQuality;
  const simple =
    (critique.simple ? migrateCritiqueSimpleFeedback(critique.simple) : undefined) ??
    fallbackSimpleRead(categories);
  const overallSummary =
    critique.overallSummary ?? deriveOverallSummaryFromSimple(simple);
  return {
    ...critique,
    categories,
    simple,
    overallSummary,
    analysisSource: 'api',
    ...(photoQuality ? { photoQuality } : {}),
    overallConfidence:
      critique.overallConfidence ??
      deriveOverallConfidence(categories, photoQuality),
  };
}

