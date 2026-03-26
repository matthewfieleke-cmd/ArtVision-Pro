import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCritiqueQuality } from '../lib/critiqueEval.ts';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { runOpenAICritique } from '../lib/openaiCritique.ts';

type Fixture = {
  filename: string;
  title: string;
  medium: 'Watercolor' | 'Pastel';
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const outputPath = path.join(workspaceRoot, 'docs', 'additional-painting-review.md');

const FIXTURES: Fixture[] = [
  { filename: 'Watercolor1.png', title: 'Watercolor 1', medium: 'Watercolor' },
  { filename: 'Watercolor2.png', title: 'Watercolor 2', medium: 'Watercolor' },
  { filename: 'Pastel1.png', title: 'Pastel 1', medium: 'Pastel' },
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
    throw new Error('OPENAI_API_KEY is required to run additional painting review.');
  }

  const sections: string[] = [];
  sections.push('# Additional painting review');
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
    sections.push(`- declared medium: ${fixture.medium}`);
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
