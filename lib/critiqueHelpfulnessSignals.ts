/**
 * Phase 5 — soft, advisory signals for critique quality (not hard gates).
 * Use in scripts, tests, or human review; tune thresholds over time.
 */

import { CRITERIA_ORDER } from '../shared/criteria.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

function sentencesFrom(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 12);
}

/** Jaccard similarity on word sets (0–1). */
function wordJaccard(a: string, b: string): number {
  const wa = new Set(normalizeForCompare(a).split(/\s+/).filter(Boolean));
  const wb = new Set(normalizeForCompare(b).split(/\s+/).filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) {
    if (wb.has(w)) inter += 1;
  }
  return inter / (wa.size + wb.size - inter);
}

export type CritiqueSoftSignals = {
  categoryCount: number;
  phase2PairwiseJaccardMax: number;
  phase2MeanChars: number;
  teacherPairwiseJaccardMax: number;
  teacherMeanChars: number;
  studioChangeCount: number;
  notes: string[];
};

/**
 * Computes lightweight repetition and length signals for human or CI review.
 */
export function computeCritiqueSoftSignals(critique: CritiqueResultDTO): CritiqueSoftSignals {
  const notes: string[] = [];
  const cats = critique.categories ?? [];

  const phase2 = cats.map((c) => c.phase2?.criticsAnalysis ?? '').filter(Boolean);
  const teachers = cats.map((c) => c.phase3?.teacherNextSteps ?? '').filter(Boolean);

  let phase2Max = 0;
  for (let i = 0; i < phase2.length; i++) {
    for (let j = i + 1; j < phase2.length; j++) {
      const sim = wordJaccard(phase2[i]!, phase2[j]!);
      if (sim > phase2Max) phase2Max = sim;
    }
  }

  let teacherMax = 0;
  for (let i = 0; i < teachers.length; i++) {
    for (let j = i + 1; j < teachers.length; j++) {
      const sim = wordJaccard(teachers[i]!, teachers[j]!);
      if (sim > teacherMax) teacherMax = sim;
    }
  }

  const phase2MeanChars =
    phase2.length > 0 ? phase2.reduce((s, t) => s + t.length, 0) / phase2.length : 0;
  const teacherMeanChars =
    teachers.length > 0 ? teachers.reduce((s, t) => s + t.length, 0) / teachers.length : 0;

  if (phase2Max >= 0.55) {
    notes.push(
      'High similarity between some Voice A phase2 paragraphs — consider whether criteria are differentiated.'
    );
  }
  if (teacherMax >= 0.5) {
    notes.push(
      'High similarity between some Voice B teaching paragraphs — check for copy-paste moves across criteria.'
    );
  }
  if (cats.length !== CRITERIA_ORDER.length) {
    notes.push(`Expected ${CRITERIA_ORDER.length} categories; got ${cats.length}.`);
  }

  const sc = critique.simpleFeedback?.studioChanges?.length ?? 0;

  return {
    categoryCount: cats.length,
    phase2PairwiseJaccardMax: Math.round(phase2Max * 1000) / 1000,
    phase2MeanChars: Math.round(phase2MeanChars),
    teacherPairwiseJaccardMax: Math.round(teacherMax * 1000) / 1000,
    teacherMeanChars: Math.round(teacherMeanChars),
    studioChangeCount: sc,
    notes,
  };
}

export function formatCritiqueSoftSignalsReport(signals: CritiqueSoftSignals): string {
  const lines = [
    'Critique soft signals (advisory):',
    `  categories: ${signals.categoryCount}`,
    `  phase2 pairwise Jaccard max: ${signals.phase2PairwiseJaccardMax} (high → possible repetition across criteria)`,
    `  phase2 mean chars: ${signals.phase2MeanChars}`,
    `  teacherNextSteps pairwise Jaccard max: ${signals.teacherPairwiseJaccardMax}`,
    `  teacher mean chars: ${signals.teacherMeanChars}`,
    `  studioChanges: ${signals.studioChangeCount}`,
  ];
  if (signals.notes.length > 0) {
    lines.push('Notes:');
    for (const n of signals.notes) lines.push(`  - ${n}`);
  }
  return lines.join('\n');
}

/** Sentence-level duplicate count across all phase2 texts (rough repetition index). */
export function duplicateSentenceCountAcrossPhase2(critique: CritiqueResultDTO): number {
  const seen = new Map<string, number>();
  for (const c of critique.categories ?? []) {
    const text = c.phase2?.criticsAnalysis ?? '';
    for (const sent of sentencesFrom(text)) {
      const key = normalizeForCompare(sent);
      if (key.length < 20) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  let dups = 0;
  for (const n of seen.values()) {
    if (n > 1) dups += n - 1;
  }
  return dups;
}
