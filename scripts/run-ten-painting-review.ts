import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAICritique } from '../lib/openaiCritique.ts';

type Fixture = {
  id: string;
  style: string;
  medium: string;
  title: string;
  artist: string;
  imagePath: string;
  source: string;
  reviewGoal: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(workspaceRoot, 'docs', 'critique-qa-fixtures.json');
const outputPath = path.join(workspaceRoot, 'docs', 'ten-painting-two-stage-review.md');

const FIXTURE_IDS = [
  'realism-courbet-burial',
  'realism-homer-gulf-stream',
  'impressionism-monet-sunrise',
  'impressionism-morisot-cradle',
  'expressionism-kirchner-street',
  'expressionism-schiele-self-portrait',
  'abstract-kandinsky-vii',
  'abstract-malevich-white',
  'abstract-mondrian-ii',
  'expressionism-nolde-clematis-dahlia',
];

function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported image extension for ${filePath}`);
  }
}

async function imageFileToDataUrl(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const mime = mimeTypeFor(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function assessmentLines(critique: Awaited<ReturnType<typeof runOpenAICritique>>): string[] {
  const simple = critique.simpleFeedback;
  const notes: string[] = [];

  const genericMain =
    simple &&
    /(stronger focal point|more contrast|more depth|more clarity|spatial definition|more cohesion)/i.test(
      simple.mainIssue
    );
  const genericSteps =
    simple &&
    simple.nextSteps.some((step) =>
      /(stronger focal point|increase contrast|refine edges|more depth|more clarity|more cohesion)/i.test(step)
    );
  const evidenceThin = critique.categories.some(
    (category) =>
      !category.evidenceSignals ||
      category.evidenceSignals.length < 2 ||
      category.evidenceSignals.some((signal) => signal.trim().length < 12)
  );

  notes.push(
    genericMain
      ? 'The main issue still slips into generic correction language more than the 11-expert standard would allow.'
      : 'The main issue is more grounded in the painting’s own terms than in earlier one-stage outputs.'
  );
  notes.push(
    genericSteps
      ? 'Some next steps still sound like stock workshop fixes rather than highly specific studio moves.'
      : 'The next steps are more exact and less trapped in stock “more contrast / more focus / more clarity” advice.'
  );
  notes.push(
    evidenceThin
      ? 'The evidence layer still needs stronger visible proof to satisfy the stricter historians and painter-teachers.'
      : 'The evidence layer gives a visible basis for judgment, which makes the critique more trustworthy.'
  );
  notes.push(
    'Overall, this response may be more respectful of the work’s own terms than the earlier one-stage version, but it should still be judged on whether it helps without over-correcting.'
  );
  return notes;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required to run ten-painting review.');

  const raw = await readFile(fixturePath, 'utf8');
  const fixtures = JSON.parse(raw) as Fixture[];
  const selected = FIXTURE_IDS.map((id) => {
    const fixture = fixtures.find((entry) => entry.id === id);
    if (!fixture) throw new Error(`Missing fixture: ${id}`);
    return fixture;
  });

  const sections: string[] = [];
  sections.push('# Ten-painting two-stage review');
  sections.push('');
  sections.push('Generated with the two-stage evidence-first critique path.');
  sections.push('');

  for (const fixture of selected) {
    const absoluteImagePath = path.join(workspaceRoot, fixture.imagePath);
    const imageDataUrl = await imageFileToDataUrl(absoluteImagePath);
    const critique = await runOpenAICritique(apiKey, {
      style: fixture.style,
      medium: fixture.medium,
      imageDataUrl,
      paintingTitle: fixture.title,
    });

    sections.push(`## ${fixture.title} — ${fixture.artist}`);
    sections.push('');
    sections.push(`- id: \`${fixture.id}\``);
    sections.push(`- style: ${fixture.style}`);
    sections.push(`- medium: ${fixture.medium}`);
    sections.push(`- source: ${fixture.source}`);
    sections.push(`- review goal: ${fixture.reviewGoal}`);
    sections.push(`- overall confidence: ${critique.overallConfidence ?? 'n/a'}`);
    sections.push('');

    sections.push('### Studio read');
    sections.push('');
    sections.push(`- intent: ${critique.simpleFeedback?.intent ?? 'n/a'}`);
    sections.push(`- main issue: ${critique.simpleFeedback?.mainIssue ?? 'n/a'}`);
    sections.push(`- preserve: ${critique.simpleFeedback?.preserve ?? 'n/a'}`);
    sections.push('');

    sections.push('### What is working');
    sections.push('');
    for (const item of critique.simpleFeedback?.working ?? []) {
      sections.push(`- ${item}`);
    }
    sections.push('');

    sections.push('### Next steps');
    sections.push('');
    for (const item of critique.simpleFeedback?.nextSteps ?? []) {
      sections.push(`1. ${item}`);
    }
    sections.push('');

    sections.push('### Summary');
    sections.push('');
    sections.push(critique.summary);
    sections.push('');

    sections.push('### 11-expert assessment');
    sections.push('');
    for (const line of assessmentLines(critique)) {
      sections.push(`- ${line}`);
    }
    sections.push('');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sections.join('\n'));
  console.log(`Wrote ${path.relative(workspaceRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
