import './loadLocalEnv.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCritiqueQuality, studioReadMarkdownLines } from '../lib/critiqueEval.ts';
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
    const evaluation = evaluateCritiqueQuality(critique);

    sections.push(`## ${fixture.title} — ${fixture.artist}`);
    sections.push('');
    sections.push(`- id: \`${fixture.id}\``);
    sections.push(`- style: ${fixture.style}`);
    sections.push(`- medium: ${fixture.medium}`);
    sections.push(`- source: ${fixture.source}`);
    sections.push(`- review goal: ${fixture.reviewGoal}`);
    sections.push(`- overall confidence: ${critique.overallConfidence ?? 'n/a'}`);
    sections.push('');

    sections.push(...studioReadMarkdownLines(critique));

    sections.push('### Summary');
    sections.push('');
    sections.push(critique.summary);
    sections.push('');

    sections.push('### 11-expert assessment');
    sections.push('');
    for (const line of evaluation.notes) {
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
