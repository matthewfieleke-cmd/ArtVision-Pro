import './loadLocalEnv.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { studioReadMarkdownLines } from '../lib/critiqueEval.ts';
import { runOpenAICritique } from '../lib/openaiCritique.ts';

type Fixture = {
  filename: string;
  title: string;
  medium: 'Oil on Canvas' | 'Watercolor' | 'Pastel';
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const outputPath = path.join(workspaceRoot, 'docs', 'focused-exemplar-rerun.md');

const FIXTURES: Fixture[] = [
  { filename: 'Oil3.JPEG', title: 'Oil 3', medium: 'Oil on Canvas' },
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

function assessment(critique: Awaited<ReturnType<typeof runOpenAICritique>>): string[] {
  const simple = critique.simpleFeedback;
  const lines: string[] = [];
  const genericMainIssue = simple
    ? /(stronger focal|more contrast|more clarity|more depth|more cohesive|spatial definition)/i.test(
        simple.studioAnalysis.whatCouldImprove
      )
    : false;
  const genericNextSteps = simple
    ? simple.studioChanges.some((ch) =>
        /(increase contrast|refine edges|stronger focal point|improve spatial clarity|more cohesive|more depth)/i.test(
          ch.text
        )
      )
    : false;

  lines.push(
    genericMainIssue
      ? '“What could improve” still leans generic.'
      : '“What could improve” is less generic and more tied to this painting’s actual terms.'
  );
  lines.push(
    genericNextSteps
      ? 'Studio change lines still include stock correction language.'
      : 'Studio change lines avoid the most obvious stock correction patterns.'
  );
  lines.push(
    'Question to judge: does this response now better preserve ambiguity, distributed attention, or atmospheric compression when those are part of the work?'
  );
  return lines;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run the focused exemplar rerun.');
  }

  const sections: string[] = [];
  sections.push('# Focused exemplar rerun');
  sections.push('');
  sections.push('Generated after adding explicit bad-vs-better prompt exemplars.');
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
    sections.push('');
    sections.push(...studioReadMarkdownLines(critique));
    sections.push('### Assessment');
    sections.push('');
    for (const line of assessment(critique)) {
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
