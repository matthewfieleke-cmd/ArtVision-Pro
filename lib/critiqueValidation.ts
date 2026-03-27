import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';

export type CritiqueEvidenceDTO = {
  intentHypothesis: string;
  strongestVisibleQualities: string[];
  mainTensions: string[];
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

export function buildCritiqueSchemaInstruction(): string {
  return `Return JSON with:
- summary
- intent
- working
- mainIssue
- nextSteps
- preserveSummary
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- feedback: 3+ sentences grounded in visible evidence
- actionPlan: exactly ONE sentence (no list): one concrete adjustment for this criterion in this painting, naming a visible area or element from the evidence
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- subskills`;
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
    photoQualityRead: {
      level: p.level as 'poor' | 'fair' | 'good',
      summary: p.summary,
      issues: p.issues as string[],
    },
    comparisonObservations: o.comparisonObservations as string[],
    criterionEvidence: normalized,
  };
}

export function validateCritiqueResult(raw: unknown): CritiqueResultDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('Invalid critique: summary');
  if (typeof o.intent !== 'string') throw new Error('Invalid critique: intent');
  if (!Array.isArray(o.working) || o.working.length < 2 || o.working.length > 3 || o.working.some((v) => typeof v !== 'string')) {
    throw new Error('Invalid critique: working');
  }
  if (typeof o.mainIssue !== 'string') throw new Error('Invalid critique: mainIssue');
  if (
    !Array.isArray(o.nextSteps) ||
    o.nextSteps.length < 3 ||
    o.nextSteps.length > 4 ||
    o.nextSteps.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid critique: nextSteps');
  }
  if (typeof o.preserveSummary !== 'string') throw new Error('Invalid critique: preserveSummary');
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
  return {
    summary: o.summary,
    simpleFeedback: {
      intent: o.intent,
      working: o.working as string[],
      mainIssue: o.mainIssue,
      nextSteps: o.nextSteps as string[],
      preserve: o.preserveSummary,
    },
    categories,
    overallConfidence: o.overallConfidence as 'low' | 'medium' | 'high',
    photoQuality: {
      level: pq.level as 'poor' | 'fair' | 'good',
      summary: pq.summary,
      issues: pq.issues as string[],
      tips: pq.tips as string[],
    },
    analysisSource: 'api',
    ...(typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
  };
}
