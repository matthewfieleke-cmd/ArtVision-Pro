import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { runOpenAICritique } from '../lib/openaiCritique.ts';

type Fixture = {
  filename: string;
  title: string;
  medium: 'Oil on Canvas' | 'Drawing' | 'Watercolor' | 'Pastel';
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const outputPath = path.join(workspaceRoot, 'docs', 'latest-upload-review.md');

const FIXTURES: Fixture[] = [
  { filename: 'Oil5 Small.png', title: 'Oil 5', medium: 'Oil on Canvas' },
  { filename: 'Drawing1 Small.png', title: 'Drawing 1', medium: 'Drawing' },
  { filename: 'Drawing2 Small.png', title: 'Drawing 2', medium: 'Drawing' },
  { filename: 'Watercolor3 Small.png', title: 'Watercolor 3', medium: 'Watercolor' },
  { filename: 'Abstract1 Small.png', title: 'Abstract 1', medium: 'Oil on Canvas' },
  { filename: 'Pastel1 Small.png', title: 'Pastel 1 Small', medium: 'Pastel' },
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

function expertAssessment(critique: Awaited<ReturnType<typeof runOpenAICritique>>): string[] {
  const notes: string[] = [];
  const simple = critique.simpleFeedback;
  const genericMainIssue = simple
    ? /(clearer focal|stronger focal|enhance depth|more depth|more contrast|spatial definition|guide the viewer|more cohesion)/i.test(
        simple.mainIssue
      )
    : false;
  const genericNextSteps = simple
    ? simple.nextSteps.some((step) =>
        /(increase contrast|enhance definition|refine edges|create a stronger focal point|improve spatial clarity|more cohesive)/i.test(
          step
        )
      )
    : false;
  const weakEvidence = critique.categories.some(
    (category) =>
      !category.evidenceSignals ||
      category.evidenceSignals.length < 2 ||
      category.evidenceSignals.some((signal) => signal.trim().length < 12)
  );

  notes.push(
    genericMainIssue
      ? 'The top-level main issue still leans on generic correction language, which several of the 11 experts would find too default.'
      : 'The top-level main issue feels more specific and less like a default workshop note.'
  );
  notes.push(
    genericNextSteps
      ? 'Some next steps still fall back on stock advice such as more contrast, stronger focal point, or sharper definition.'
      : 'The next steps are more exact and less trapped in stock “clarify / contrast / focus” moves.'
  );
  notes.push(
    weakEvidence
      ? 'The evidence layer is still thinner than the 11-expert standard would want.'
      : 'The evidence layer gives a visible basis for the judgment and increases trust.'
  );
  notes.push(
    simple
      ? 'Overall, this response would probably help the artist improve, but the key question is whether it respects the work’s own terms or pushes generic correction.'
      : 'Without a clear simple feedback layer, the response would be less immediately usable for the painter.'
  );

  return notes;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run latest upload review.');
  }

  const sections: string[] = [];
  sections.push('# Latest upload review');
  sections.push('');
  sections.push('Generated with the API classify + critique path after post-processing guardrails were added.');
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
    for (const line of expertAssessment(critique)) {
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
