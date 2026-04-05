import './loadLocalEnv.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { runOpenAICritique } from '../lib/openaiCritique.ts';
import { LATEST_UPLOAD_FIXTURES } from './latestUploadFixtures.ts';

type ReviewFixture = {
  filename: string;
  title: string;
  medium: 'Oil on Canvas' | 'Drawing' | 'Watercolor' | 'Pastel';
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

const EXTRA_FIXTURES: ReviewFixture[] = [
  { filename: 'Oil1.JPEG', title: 'Oil 1', medium: 'Oil on Canvas' },
  { filename: 'Oil2.JPEG', title: 'Oil 2', medium: 'Oil on Canvas' },
  { filename: 'Oil3.JPEG', title: 'Oil 3', medium: 'Oil on Canvas' },
  { filename: 'Oil4.JPEG', title: 'Oil 4', medium: 'Oil on Canvas' },
  { filename: 'Watercolor1.png', title: 'Watercolor 1', medium: 'Watercolor' },
  { filename: 'Watercolor2.png', title: 'Watercolor 2', medium: 'Watercolor' },
  { filename: 'Pastel1.png', title: 'Pastel 1', medium: 'Pastel' },
];

const REVIEW_FIXTURES: ReviewFixture[] = [...LATEST_UPLOAD_FIXTURES, ...EXTRA_FIXTURES];

function selectReviewFixtures(filters: string[]): ReviewFixture[] {
  if (filters.length === 0) return REVIEW_FIXTURES;
  const normalizedFilters = filters.map((filter) => filter.trim().toLowerCase()).filter(Boolean);
  return REVIEW_FIXTURES.filter((fixture) => {
    const haystacks = [fixture.filename, fixture.title, fixture.medium].map((value) => value.toLowerCase());
    return normalizedFilters.some((filter) => haystacks.some((haystack) => haystack.includes(filter)));
  });
}

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
    throw new Error('OPENAI_API_KEY is required to run pipeline stage review.');
  }

  const filters = process.argv.slice(2);
  const fixtures = selectReviewFixtures(filters);
  if (fixtures.length === 0) {
    throw new Error('No review fixtures matched the provided filters.');
  }

  const results: Array<Record<string, unknown>> = [];

  for (const fixture of fixtures) {
    const absolutePath = path.join(workspaceRoot, fixture.filename);
    const imageDataUrl = await imageFileToDataUrl(absolutePath);
    const classification = await runOpenAIClassifyStyle(apiKey, imageDataUrl);
    const critique = await runOpenAICritique(apiKey, {
      style: classification.style,
      medium: fixture.medium,
      imageDataUrl,
      paintingTitle: fixture.title,
    });

    results.push({
      file: fixture.filename,
      declaredMedium: fixture.medium,
      classifiedStyle: classification.style,
      analysisSource: critique.analysisSource ?? 'api',
      resultTier: critique.pipeline?.resultTier ?? null,
      completedWithFallback: critique.pipeline?.completedWithFallback ?? false,
      stages: Object.fromEntries(
        Object.entries(critique.pipeline?.stages ?? {}).map(([stageId, snapshot]) => [
          stageId,
          {
            status: snapshot?.status ?? null,
            model: snapshot?.model ?? null,
            attempts:
              snapshot?.attempts?.map((attempt) => ({
                attempt: attempt.attempt,
                status: attempt.status,
                error: attempt.error ?? null,
                firstDetail: attempt.details?.[0] ?? null,
                sampleAnchor: attempt.criterionEvidencePreview?.[0]?.anchor ?? null,
              })) ?? [],
          },
        ])
      ),
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
