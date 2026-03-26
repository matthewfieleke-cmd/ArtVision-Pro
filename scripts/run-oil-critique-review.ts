import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { evaluateCritiqueQuality } from '../lib/critiqueEval.ts';
import { runOpenAICritique } from '../lib/openaiCritique.ts';

type OilFixture = {
  filename: string;
  title: string;
  medium: 'Oil on Canvas';
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const outputPath = path.join(workspaceRoot, 'docs', 'oil-critique-review.md');

const FIXTURES: OilFixture[] = [
  { filename: 'Oil1.JPEG', title: 'Oil 1', medium: 'Oil on Canvas' },
  { filename: 'Oil2.JPEG', title: 'Oil 2', medium: 'Oil on Canvas' },
  { filename: 'Oil3.JPEG', title: 'Oil 3', medium: 'Oil on Canvas' },
  { filename: 'Oil4.JPEG', title: 'Oil 4', medium: 'Oil on Canvas' },
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
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run oil critique review.');
  }

  const sections: string[] = [];
  sections.push('# Oil critique review');
  sections.push('');
  sections.push('Generated with the API classify + critique path.');
  sections.push('');

  for (const fixture of FIXTURES) {
    const absolutePath = path.join(workspaceRoot, fixture.filename);
    const imageDataUrl = await imageFileToDataUrl(absolutePath);
    const classification = await runOpenAIClassifyStyle(apiKey, imageDataUrl);
    const critique = await runOpenAICritique(apiKey, {
      style: classification.style,
      medium: fixture.medium,
      imageDataUrl,
      paintingTitle: fixture.title,
    });

    sections.push(`## ${fixture.title}`);
    sections.push('');
    sections.push(`- file: \`${fixture.filename}\``);
    sections.push(`- classified style: ${classification.style}`);
    sections.push(`- classification rationale: ${classification.rationale}`);
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

    sections.push('### Full summary');
    sections.push('');
    sections.push(critique.summary);
    sections.push('');

    sections.push('### 11-expert assessment');
    sections.push('');
    for (const line of evaluateCritiqueQuality(critique).notes) {
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
