/**
 * Phase 5 — print soft signals for a saved critique JSON (advisory, not a gate).
 * Usage: npx tsx scripts/run-critique-helpfulness-signals.ts <path-to-critique.json>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  computeCritiqueSoftSignals,
  duplicateSentenceCountAcrossPhase2,
  formatCritiqueSoftSignalsReport,
} from '../lib/critiqueHelpfulnessSignals.js';
import type { CritiqueResultDTO } from '../lib/critiqueTypes.js';

function main(): void {
  const pathArg = process.argv[2];
  if (!pathArg) {
    console.error('Usage: npx tsx scripts/run-critique-helpfulness-signals.ts <path-to-critique.json>');
    process.exit(1);
  }
  const raw = readFileSync(resolve(pathArg), 'utf8');
  const critique = JSON.parse(raw) as CritiqueResultDTO;
  const signals = computeCritiqueSoftSignals(critique);
  console.log(formatCritiqueSoftSignalsReport(signals));
  console.log(`  duplicate heavy sentences (phase2, rough index): ${duplicateSentenceCountAcrossPhase2(critique)}`);
}

main();
