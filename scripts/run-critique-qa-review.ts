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
const outputPath = path.join(workspaceRoot, 'docs', 'critique-qa-first-pass.md');

const FIRST_PASS_FIXTURE_IDS = [
  'realism-courbet-burial',
  'impressionism-monet-sunrise',
  'expressionism-kirchner-street',
  'abstract-kandinsky-vii',
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

function checklistBlock(): string {
  return [
    '- Intent: yes / partly / no',
    '- Own terms: yes / partly / no',
    '- Living strength: yes / partly / no',
    '- Main issue: yes / partly / no',
    '- Studio usefulness: yes / partly / no',
    '- Clarity: yes / partly / no',
    '- Specific evidence: yes / partly / no',
    '- Voice quality: yes / partly / no',
  ].join('\n');
}

async function main() {
  const raw = await readFile(fixturePath, 'utf8');
  const fixtures = JSON.parse(raw) as Fixture[];
  const selected = FIRST_PASS_FIXTURE_IDS.map((id) => {
    const fixture = fixtures.find((entry) => entry.id === id);
    if (!fixture) throw new Error(`Missing fixture: ${id}`);
    return fixture;
  });

  const apiKey = process.env.OPENAI_API_KEY;
  const sections: string[] = [];

  sections.push('# Critique QA first pass');
  sections.push('');
  sections.push(apiKey ? 'Generated with the API critique path.' : 'Scaffold generated without API output because `OPENAI_API_KEY` is not set on this machine.');
  sections.push('');
  sections.push('## Fixtures');
  sections.push('');

  for (const fixture of selected) {
    sections.push(`### ${fixture.title} — ${fixture.artist}`);
    sections.push('');
    sections.push(`- id: \`${fixture.id}\``);
    sections.push(`- style: ${fixture.style}`);
    sections.push(`- medium: ${fixture.medium}`);
    sections.push(`- image: \`${fixture.imagePath}\``);
    sections.push(`- review goal: ${fixture.reviewGoal}`);
    sections.push('');

    if (apiKey) {
      const absoluteImagePath = path.join(workspaceRoot, fixture.imagePath);
      const imageDataUrl = await imageFileToDataUrl(absoluteImagePath);
      const critique = await runOpenAICritique(apiKey, {
        style: fixture.style,
        medium: fixture.medium,
        imageDataUrl,
        paintingTitle: fixture.title,
      });

      sections.push(
        ...studioReadMarkdownLines(critique, {
          title: '#### Studio read',
          analysisSectionTitle: '##### Analysis',
          changesSectionTitle: '##### Changes to make',
        })
      );
      sections.push('#### Full summary');
      sections.push('');
      sections.push(critique.summary);
      sections.push('');
      sections.push('#### Review checklist');
      sections.push('');
      sections.push(checklistBlock());
      sections.push('');
      sections.push('#### 11-expert assessment');
      sections.push('');
      for (const line of evaluateCritiqueQuality(critique).notes) {
        sections.push(`- ${line}`);
      }
      sections.push('');
      sections.push('#### Notes');
      sections.push('');
      sections.push('- What worked:');
      sections.push('- What felt generic or weak:');
      sections.push('- What to tighten in prompt/template logic:');
      sections.push('');
    } else {
      sections.push('#### Studio read');
      sections.push('');
      sections.push('- API critique not generated in this environment.');
      sections.push('');
      sections.push('#### Review checklist');
      sections.push('');
      sections.push(checklistBlock());
      sections.push('');
      sections.push('#### Notes');
      sections.push('');
      sections.push('- What worked:');
      sections.push('- What felt generic or weak:');
      sections.push('- What to tighten in prompt/template logic:');
      sections.push('');
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sections.join('\n'));
  console.log(`Wrote ${path.relative(workspaceRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
