import { canonicalCriterionLabel, CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';
import type {
  CritiqueResultDTO,
  CritiqueSimpleFeedbackDTO,
  StudioChangeDTO,
} from './critiqueTypes.js';

export type CritiqueEvidenceDTO = {
  intentHypothesis: string;
  strongestVisibleQualities: string[];
  mainTensions: string[];
  completionRead: {
    state: 'unfinished' | 'likely_finished' | 'uncertain';
    confidence: 'low' | 'medium' | 'high';
    cues: string[];
    rationale: string;
  };
  photoQualityRead: {
    level: 'poor' | 'fair' | 'good';
    summary: string;
    issues: string[];
  };
  comparisonObservations: string[];
  criterionEvidence: Array<{
    criterion: (typeof CRITERIA_ORDER)[number];
    visibleEvidence: string[];
    strengthRead: string;
    tensionRead: string;
    preserve: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
};

function isNormalizedNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateAnchor(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]): CriterionAnchor {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid anchor for ${criterion}`);
  const o = raw as Record<string, unknown>;
  const region = o.region;
  if (
    typeof o.areaSummary !== 'string' ||
    o.areaSummary.trim().length < 4 ||
    typeof o.evidencePointer !== 'string' ||
    o.evidencePointer.trim().length < 4 ||
    !region ||
    typeof region !== 'object'
  ) {
    throw new Error(`Invalid anchor fields for ${criterion}`);
  }
  const r = region as Record<string, unknown>;
  if (
    !isNormalizedNumber(r.x) ||
    !isNormalizedNumber(r.y) ||
    !isNormalizedNumber(r.width) ||
    !isNormalizedNumber(r.height) ||
    r.width <= 0 ||
    r.height <= 0 ||
    (r.x as number) + (r.width as number) > 1 ||
    (r.y as number) + (r.height as number) > 1
  ) {
    throw new Error(`Invalid anchor region for ${criterion}`);
  }
  return {
    areaSummary: o.areaSummary.trim(),
    evidencePointer: o.evidencePointer.trim(),
    region: {
      x: r.x as number,
      y: r.y as number,
      width: r.width as number,
      height: r.height as number,
    },
  };
}

function validateEditPlan(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]): CriterionEditPlan {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid edit plan for ${criterion}`);
  const o = raw as Record<string, unknown>;
  if (
    typeof o.targetArea !== 'string' ||
    typeof o.preserveArea !== 'string' ||
    typeof o.issue !== 'string' ||
    typeof o.intendedChange !== 'string' ||
    typeof o.expectedOutcome !== 'string' ||
    typeof o.editability !== 'string' ||
    !(['yes', 'no'] as const).includes(o.editability as 'yes' | 'no')
  ) {
    throw new Error(`Invalid edit plan fields for ${criterion}`);
  }
  return {
    targetArea: o.targetArea.trim(),
    preserveArea: o.preserveArea.trim(),
    issue: o.issue.trim(),
    intendedChange: o.intendedChange.trim(),
    expectedOutcome: o.expectedOutcome.trim(),
    editability: o.editability as 'yes' | 'no',
  };
}

function normalizePreviewCriterion(raw: string): (typeof CRITERIA_ORDER)[number] {
  const c = canonicalCriterionLabel(raw);
  if (c) return c;
  if (CRITERIA_ORDER.includes(raw as (typeof CRITERIA_ORDER)[number])) {
    return raw as (typeof CRITERIA_ORDER)[number];
  }
  return 'Composition and shape structure';
}

export function migrateLegacySimpleFeedback(o: Record<string, unknown>): CritiqueSimpleFeedbackDTO {
  const intent = typeof o.intent === 'string' ? o.intent : '';
  const working = Array.isArray(o.working) ? (o.working as string[]).filter((x) => typeof x === 'string') : [];
  const mainIssue = typeof o.mainIssue === 'string' ? o.mainIssue : '';
  const nextSteps = Array.isArray(o.nextSteps) ? (o.nextSteps as string[]).filter((x) => typeof x === 'string') : [];
  const preserve =
    typeof o.preserveSummary === 'string'
      ? o.preserveSummary
      : typeof o.preserve === 'string'
        ? o.preserve
        : '';

  const whatWorks =
    working.length > 0
      ? working.map((w) => `• ${w}`).join(' ')
      : intent.trim().length > 0
        ? intent
        : 'The painting offers a readable surface to build on; see the detailed categories for specifics.';

  const whatCouldImprove =
    mainIssue.trim().length > 0
      ? mainIssue
      : 'Several relationships could still be sharpened; use the criterion breakdown below for the main leverage points.';

  const studioChanges: StudioChangeDTO[] = [];
  for (let i = 0; i < nextSteps.length && studioChanges.length < 5; i++) {
    const text = nextSteps[i]!.trim();
    if (text.length < 8) continue;
    studioChanges.push({
      text,
      previewCriterion: CRITERIA_ORDER[Math.min(i, CRITERIA_ORDER.length - 1)]!,
    });
  }
  while (studioChanges.length < 2) {
    studioChanges.push({
      text:
        preserve.trim().length > 0
          ? `Protect ${preserve.slice(0, 120)}${preserve.length > 120 ? '…' : ''} while you refine one adjacent passage with a clearer value or edge.`
          : 'Choose the weakest visible passage and restate it with simpler value groups before adding detail elsewhere.',
      previewCriterion: 'Composition and shape structure',
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

function fallbackSubskills(
  criterion: (typeof CRITERIA_ORDER)[number],
  level: (typeof RATING_LEVELS)[number],
  evidenceSignals: string[]
): Array<{
  label: string;
  score: number;
  level: (typeof RATING_LEVELS)[number];
}> {
  const fallbackLabels: Record<(typeof CRITERIA_ORDER)[number], [string, string]> = {
    'Intent and necessity': ['Coherence of aim', 'Support from formal choices'],
    'Composition and shape structure': ['Big-shape organization', 'Eye path control'],
    'Value and light structure': ['Light-dark grouping', 'Range control'],
    'Color relationships': ['Palette harmony', 'Temperature control'],
    'Drawing, proportion, and spatial form': ['Shape placement', 'Spatial construction'],
    'Edge and focus control': ['Edge hierarchy', 'Focus placement'],
    'Surface and medium handling': ['Mark economy', 'Surface character'],
    'Presence, point of view, and human force': ['Atmospheric force', 'Point of view'],
  };

  const numericLevel =
    level === 'Master' ? 0.92 : level === 'Advanced' ? 0.74 : level === 'Intermediate' ? 0.5 : 0.28;

  const fromEvidence = evidenceSignals
    .slice(0, 2)
    .map((signal, idx) => ({
      label: signal
        .replace(/^[a-z]/, (m) => m.toUpperCase())
        .replace(/\.$/, '')
        .slice(0, 48),
      score: Math.max(0, Math.min(1, numericLevel - idx * 0.04)),
      level,
    }))
    .filter((entry) => entry.label.length > 0);

  if (fromEvidence.length >= 2) return fromEvidence;

  const [labelA, labelB] = fallbackLabels[criterion];
  return [
    { label: labelA, score: numericLevel, level },
    { label: labelB, score: Math.max(0, Math.min(1, numericLevel - 0.06)), level },
  ];
}

export function validateEvidenceResult(raw: unknown): CritiqueEvidenceDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid evidence API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.intentHypothesis !== 'string') throw new Error('Invalid evidence: intentHypothesis');
  if (
    !Array.isArray(o.strongestVisibleQualities) ||
    o.strongestVisibleQualities.length < 2 ||
    o.strongestVisibleQualities.length > 4 ||
    o.strongestVisibleQualities.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: strongestVisibleQualities');
  }
  if (
    !Array.isArray(o.mainTensions) ||
    o.mainTensions.length < 2 ||
    o.mainTensions.length > 4 ||
    o.mainTensions.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: mainTensions');
  }
  const cr = o.completionRead;
  if (!cr || typeof cr !== 'object') throw new Error('Invalid evidence: completionRead');
  const crObj = cr as Record<string, unknown>;
  if (
    typeof crObj.state !== 'string' ||
    !(['unfinished', 'likely_finished', 'uncertain'] as const).includes(
      crObj.state as 'unfinished' | 'likely_finished' | 'uncertain'
    ) ||
    typeof crObj.confidence !== 'string' ||
    !(['low', 'medium', 'high'] as const).includes(crObj.confidence as 'low' | 'medium' | 'high') ||
    typeof crObj.rationale !== 'string' ||
    !Array.isArray(crObj.cues) ||
    crObj.cues.length < 1 ||
    crObj.cues.length > 4 ||
    crObj.cues.some((v: unknown) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: completionRead fields');
  }
  if (
    !o.photoQualityRead ||
    typeof o.photoQualityRead !== 'object' ||
    !Array.isArray((o.photoQualityRead as Record<string, unknown>).issues)
  ) {
    throw new Error('Invalid evidence: photoQualityRead');
  }
  const p = o.photoQualityRead as Record<string, unknown>;
  if (
    typeof p.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(p.level as 'poor' | 'fair' | 'good') ||
    typeof p.summary !== 'string' ||
    (p.issues as unknown[]).some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: photoQualityRead fields');
  }
  if (
    !Array.isArray(o.comparisonObservations) ||
    o.comparisonObservations.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: comparisonObservations');
  }
  const criterionEvidence = o.criterionEvidence;
  if (!Array.isArray(criterionEvidence) || criterionEvidence.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid evidence: criterionEvidence length');
  }
  const normalized = CRITERIA_ORDER.map((expected, i) => {
    const c = criterionEvidence[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid evidence criterion');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid evidence criterion at index ${i}`);
    }
    if (
      !Array.isArray(r.visibleEvidence) ||
      r.visibleEvidence.length < 2 ||
      r.visibleEvidence.length > 5 ||
      r.visibleEvidence.some((v) => typeof v !== 'string')
    ) {
      throw new Error(`Invalid visibleEvidence for ${expected}`);
    }
    if (
      typeof r.strengthRead !== 'string' ||
      typeof r.tensionRead !== 'string' ||
      typeof r.preserve !== 'string' ||
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid evidence fields for ${expected}`);
    }
    return {
      criterion: expected,
      visibleEvidence: r.visibleEvidence as string[],
      strengthRead: r.strengthRead,
      tensionRead: r.tensionRead,
      preserve: r.preserve,
      confidence: r.confidence as 'low' | 'medium' | 'high',
    };
  });

  return {
    intentHypothesis: o.intentHypothesis,
    strongestVisibleQualities: o.strongestVisibleQualities as string[],
    mainTensions: o.mainTensions as string[],
    completionRead: {
      state: crObj.state as 'unfinished' | 'likely_finished' | 'uncertain',
      confidence: crObj.confidence as 'low' | 'medium' | 'high',
      cues: crObj.cues as string[],
      rationale: crObj.rationale,
    },
    photoQualityRead: {
      level: p.level as 'poor' | 'fair' | 'good',
      summary: p.summary,
      issues: p.issues as string[],
    },
    comparisonObservations: o.comparisonObservations as string[],
    criterionEvidence: normalized,
  };
}

function parseSimpleFeedback(o: Record<string, unknown>): CritiqueSimpleFeedbackDTO {
  const sa = o.studioAnalysis;
  const sc = o.studioChanges;
  if (sa && typeof sa === 'object' && Array.isArray(sc)) {
    const a = sa as Record<string, unknown>;
    if (typeof a.whatWorks !== 'string' || typeof a.whatCouldImprove !== 'string') {
      throw new Error('Invalid critique: studioAnalysis fields');
    }
    if (sc.length < 2 || sc.length > 5) throw new Error('Invalid critique: studioChanges length');
    const studioChanges: StudioChangeDTO[] = [];
    for (const item of sc) {
      if (!item || typeof item !== 'object') throw new Error('Invalid critique: studioChanges item');
      const r = item as Record<string, unknown>;
      if (typeof r.text !== 'string' || typeof r.previewCriterion !== 'string') {
        throw new Error('Invalid critique: studioChanges item fields');
      }
      studioChanges.push({
        text: r.text,
        previewCriterion: normalizePreviewCriterion(r.previewCriterion),
      });
    }
    return {
      studioAnalysis: { whatWorks: a.whatWorks, whatCouldImprove: a.whatCouldImprove },
      studioChanges,
    };
  }
  if (typeof o.intent === 'string' && Array.isArray(o.working) && typeof o.mainIssue === 'string') {
    return migrateLegacySimpleFeedback(o);
  }
  throw new Error('Invalid critique: studioRead (studioAnalysis + studioChanges or legacy simple fields)');
}

export function validateCritiqueResult(raw: unknown): CritiqueResultDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('Invalid critique: summary');
  const overallSummaryRaw = o.overallSummary;
  if (!overallSummaryRaw || typeof overallSummaryRaw !== 'object') {
    throw new Error('Invalid critique: overallSummary');
  }
  const overallSummaryObj = overallSummaryRaw as Record<string, unknown>;
  const topPrioritiesRaw = overallSummaryObj.topPriorities;
  if (
    typeof overallSummaryObj.analysis !== 'string' ||
    !Array.isArray(topPrioritiesRaw) ||
    topPrioritiesRaw.some((v: unknown) => typeof v !== 'string')
  ) {
    throw new Error('Invalid critique: overallSummary');
  }
  const simpleFeedback = parseSimpleFeedback(o);
  if (
    typeof o.overallConfidence !== 'string' ||
    !(['low', 'medium', 'high'] as const).includes(o.overallConfidence as 'low' | 'medium' | 'high')
  ) {
    throw new Error('Invalid critique: overallConfidence');
  }
  const cats = o.categories;
  if (!Array.isArray(cats) || cats.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid critique: categories length');
  }
  const categories = CRITERIA_ORDER.map((expected: (typeof CRITERIA_ORDER)[number], i: number) => {
    const c = cats[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid category');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid criterion at index ${i}`);
    }
    if (typeof r.level !== 'string' || !RATING_LEVELS.includes(r.level as (typeof RATING_LEVELS)[number])) {
      throw new Error(`Invalid level for ${expected}`);
    }
    if (typeof r.feedback !== 'string' || typeof r.actionPlan !== 'string') {
      throw new Error(`Invalid text for ${expected}`);
    }
    if (
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid confidence for ${expected}`);
    }
    if (!Array.isArray(r.evidenceSignals) || r.evidenceSignals.some((v) => typeof v !== 'string')) {
      throw new Error(`Invalid evidence signals for ${expected}`);
    }
    if (
      typeof r.preserve !== 'string' ||
      typeof r.practiceExercise !== 'string' ||
      typeof r.nextTarget !== 'string'
    ) {
      throw new Error(`Invalid coaching metadata for ${expected}`);
    }
    const anchor = validateAnchor(r.anchor, expected);
    const editPlan = validateEditPlan(r.editPlan, expected);
    const subskills =
      Array.isArray(r.subskills) &&
      r.subskills.length >= 2 &&
      r.subskills.length <= 4 &&
      !r.subskills.some((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const sub = entry as Record<string, unknown>;
        return (
          typeof sub.label !== 'string' ||
          typeof sub.score !== 'number' ||
          sub.score < 0 ||
          sub.score > 1 ||
          typeof sub.level !== 'string' ||
          !RATING_LEVELS.includes(sub.level as (typeof RATING_LEVELS)[number])
        );
      })
        ? (r.subskills as Array<{
            label: string;
            score: number;
            level: (typeof RATING_LEVELS)[number];
          }>)
        : fallbackSubskills(
            expected,
            r.level as (typeof RATING_LEVELS)[number],
            Array.isArray(r.evidenceSignals) ? (r.evidenceSignals as string[]) : []
          );
    return {
      criterion: r.criterion as (typeof CRITERIA_ORDER)[number],
      level: r.level as (typeof RATING_LEVELS)[number],
      feedback: r.feedback,
      actionPlan: r.actionPlan,
      confidence: r.confidence as 'low' | 'medium' | 'high',
      evidenceSignals: r.evidenceSignals as string[],
      preserve: r.preserve,
      practiceExercise: r.practiceExercise,
      nextTarget: r.nextTarget,
      anchor,
      editPlan,
      subskills,
    };
  });
  const cn = o.comparisonNote;
  if (cn !== null && (typeof cn !== 'string' || cn.length === 0)) {
    throw new Error('Invalid comparisonNote');
  }
  const photoQuality = o.photoQuality;
  if (!photoQuality || typeof photoQuality !== 'object') throw new Error('Invalid photoQuality');
  const pq = photoQuality as Record<string, unknown>;
  if (
    typeof pq.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(pq.level as 'poor' | 'fair' | 'good') ||
    typeof pq.summary !== 'string' ||
    !Array.isArray(pq.issues) ||
    pq.issues.some((v) => typeof v !== 'string') ||
    !Array.isArray(pq.tips) ||
    pq.tips.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid photoQuality fields');
  }
  const titlesRaw = o.suggestedPaintingTitles;
  if (!Array.isArray(titlesRaw) || titlesRaw.length !== 3 || titlesRaw.some((v) => typeof v !== 'string')) {
    throw new Error('Invalid critique: suggestedPaintingTitles');
  }
  const suggestedPaintingTitles = titlesRaw.map((t) => t.trim()).filter((t) => t.length > 0);
  if (suggestedPaintingTitles.length !== 3) {
    throw new Error('Invalid critique: suggestedPaintingTitles empty');
  }
  return {
    summary: o.summary,
    overallSummary: {
      analysis: overallSummaryObj.analysis as string,
      topPriorities: overallSummaryObj.topPriorities as string[],
    },
    simpleFeedback,
    categories,
    overallConfidence: o.overallConfidence as 'low' | 'medium' | 'high',
    photoQuality: {
      level: pq.level as 'poor' | 'fair' | 'good',
      summary: pq.summary,
      issues: pq.issues as string[],
      tips: pq.tips as string[],
    },
    analysisSource: 'api',
    suggestedPaintingTitles,
    ...(typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
  };
}
