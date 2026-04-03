/**
 * End-to-end critique pipeline test.
 *
 * Runs a painting through the full evidence → calibration → Voice A → Voice B
 * pipeline and prints the raw output at each stage for inspection.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/test-critique-pipeline.ts <image-path> [style-override] [medium-override]
 *
 * By default this mirrors the app's auto-classify flow:
 *   1. classify style
 *   2. classify medium
 *   3. run critique with those detected values
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';
import { runOpenAIClassifyMedium } from '../lib/openaiClassifyMedium.js';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.js';
import { runOpenAICritique } from '../lib/openaiCritique.js';
import type { CritiqueResultDTO } from '../lib/critiqueTypes.js';

const PRESERVATION_LEAD = /^\s*(maintain|preserve|keep|continue|protect)\b/i;
const VAGUE_AREA = /^(arrangement of elements|spatial arrangement|areas where|background elements|foreground figures|some (edges|areas|transitions|elements)|the (composition|overall|painting))\b/i;
const CHANGE_VERBS =
  /\b(soften|darken|lighten|cool|warm|group|separate|sharpen|widen|narrow|compress|vary|quiet|lose|restate|simplify|refine|reduce|shift|bridge|thin|thicken|brighten|deepen|pull|push|clean|trim|lower|raise|spread|tighten|carve|blend|glaze|scumble|drag|feather)\b/i;

function gradeStep(step: string, level: string | undefined): { grade: string; issues: string[] } {
  const issues: string[] = [];
  const trimmed = step.trim();

  if (!trimmed || trimmed.length < 20) {
    issues.push('Too short to be actionable');
    return { grade: 'F', issues };
  }

  if (PRESERVATION_LEAD.test(trimmed) && level !== 'Master') {
    issues.push('Preservation verb leading a non-Master improvement step');
  }

  if (VAGUE_AREA.test(trimmed)) {
    issues.push('Vague area reference (no specific passage named)');
  }

  if (!/\b(the |a |an )\w+/.test(trimmed.toLowerCase())) {
    issues.push('No identifiable object/passage named');
  }

  const sentences = trimmed.split(/[.!?]+/).filter(Boolean);
  const hasChangeVerb = sentences.some((s) => CHANGE_VERBS.test(s.trim()));
  if (!hasChangeVerb && level !== 'Master') {
    issues.push('No concrete change verb found');
  }

  if (issues.length === 0) return { grade: 'A', issues };
  if (issues.length === 1) return { grade: 'B', issues };
  if (issues.length === 2) return { grade: 'C', issues };
  return { grade: 'F', issues };
}

function gradeEvidence(entry: { visibleEvidence: string[] }): { grade: string; issues: string[] } {
  const issues: string[] = [];
  for (const obs of entry.visibleEvidence) {
    if (obs.length < 30) issues.push(`Short observation: "${obs.slice(0, 50)}"`);
    const hasJunction = /\b(against|meets?|where .+ meets?|between|overlap|alongside|next to|adjacent)\b/i.test(obs);
    if (!hasJunction) issues.push(`No junction language: "${obs.slice(0, 60)}..."`);
  }
  if (issues.length === 0) return { grade: 'A', issues };
  if (issues.length <= 2) return { grade: 'B', issues };
  if (issues.length <= 4) return { grade: 'C', issues };
  return { grade: 'F', issues };
}

function imageToDataUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('data:')) return pathOrUrl;
  if (pathOrUrl.startsWith('http')) {
    throw new Error('HTTP URLs not supported yet — provide a local file path');
  }
  const abs = resolve(pathOrUrl);
  const buf = readFileSync(abs);
  const ext = abs.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: npx tsx scripts/test-critique-pipeline.ts <image-path> [style-override] [medium-override]');
    console.error('  e.g. npx tsx scripts/test-critique-pipeline.ts ~/painting.jpg');
    process.exit(1);
  }

  const imageDataUrl = imageToDataUrl(imagePath);
  console.log(`Image loaded (${(imageDataUrl.length / 1024).toFixed(0)} KB base64)\n`);

  const styleOverride = process.argv[3];
  const mediumOverride = process.argv[4];

  console.log('Classifying style and medium...\n');

  const [styleRead, mediumRead] = await Promise.all([
    styleOverride
      ? Promise.resolve({ style: styleOverride, rationale: 'Manual override supplied via CLI.' })
      : runOpenAIClassifyStyle(apiKey, imageDataUrl),
    mediumOverride
      ? Promise.resolve({
          medium: mediumOverride,
          confidence: 'high' as const,
          rationale: 'Manual override supplied via CLI.',
        })
      : runOpenAIClassifyMedium(apiKey, imageDataUrl),
  ]);

  const style = styleRead.style;
  const medium = mediumRead.medium;

  console.log(`Style: ${style}`);
  console.log(`  Rationale: ${styleRead.rationale}`);
  console.log(`Medium: ${medium}`);
  console.log(`  Confidence: ${mediumRead.confidence}`);
  console.log(`  Rationale: ${mediumRead.rationale}\n`);
  console.log('Running full critique pipeline...\n');

  const start = Date.now();
  let result: CritiqueResultDTO;
  try {
    result = await runOpenAICritique(apiKey, {
      style,
      medium,
      imageDataUrl,
    });
  } catch (e) {
    console.error('Pipeline failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Pipeline completed in ${elapsed}s\n`);

  console.log('='.repeat(80));
  console.log('SUGGESTED TITLES');
  console.log('='.repeat(80));
  if (result.suggestedPaintingTitles) {
    for (const t of result.suggestedPaintingTitles) {
      if (typeof t === 'string') {
        console.log(`  ${t}`);
      } else {
        console.log(`  [${t.category}] ${t.title}`);
        console.log(`    Rationale: ${t.rationale}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('PER-CRITERION RESULTS');
  console.log('='.repeat(80));

  for (const cat of result.categories) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${cat.criterion} — Level: ${cat.level ?? '?'} | Confidence: ${cat.confidence ?? '?'}`);
    console.log('─'.repeat(70));

    if (cat.evidenceSignals?.length) {
      console.log('\n  EVIDENCE SIGNALS:');
      for (const sig of cat.evidenceSignals) {
        console.log(`    • ${sig}`);
      }
      const evGrade = gradeEvidence({ visibleEvidence: cat.evidenceSignals });
      console.log(`    Evidence grade: ${evGrade.grade}`);
      if (evGrade.issues.length) {
        for (const issue of evGrade.issues) console.log(`      ⚠ ${issue}`);
      }
    }

    console.log(
      `\n  FEEDBACK: ${cat.phase2.criticsAnalysis.slice(0, 200)}${cat.phase2.criticsAnalysis.length > 200 ? '...' : ''}`
    );

    console.log(`\n  ACTION PLAN (How to Improve):`);
    console.log(`    ${cat.phase3.teacherNextSteps}`);
    const planGrade = gradeStep(cat.phase3.teacherNextSteps, cat.level);
    console.log(`    Grade: ${planGrade.grade}`);
    if (planGrade.issues.length) {
      for (const issue of planGrade.issues) console.log(`      ⚠ ${issue}`);
    }

    if (cat.anchor) {
      console.log(`\n  ANCHOR: ${cat.anchor.areaSummary}`);
      console.log(`    Evidence: ${cat.anchor.evidencePointer}`);
    }

    if (cat.editPlan) {
      console.log(`\n  EDIT PLAN:`);
      console.log(`    Target: ${cat.editPlan.targetArea}`);
      console.log(`    Issue: ${cat.editPlan.issue}`);
      console.log(`    Change: ${cat.editPlan.intendedChange}`);
      console.log(`    Expected: ${cat.editPlan.expectedOutcome}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('GRADE SUMMARY');
  console.log('='.repeat(80));
  const grades = result.categories.map((cat) => {
    const g = gradeStep(cat.phase3.teacherNextSteps, cat.level);
    return { criterion: cat.criterion, grade: g.grade, issues: g.issues };
  });
  for (const g of grades) {
    const flag = g.grade === 'A' ? '✓' : g.grade === 'B' ? '~' : '✗';
    console.log(`  ${flag} ${g.grade} — ${g.criterion}${g.issues.length ? ` (${g.issues.join('; ')})` : ''}`);
  }
  const aCount = grades.filter((g) => g.grade === 'A').length;
  const fCount = grades.filter((g) => g.grade === 'F').length;
  console.log(`\n  ${aCount}/8 A grades, ${fCount}/8 F grades`);
}

void main();
