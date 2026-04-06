import './loadLocalEnv.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { CritiquePipelineError, type CritiqueDebugInfo } from '../lib/critiqueErrors.js';
import { sameAdvice } from '../lib/critiqueGrounding.js';
import { runOpenAICritique } from '../lib/openaiCritique.ts';
import type { CritiqueResultDTO } from '../lib/critiqueTypes.js';

type CatalogFixture = {
  id: string;
  style: string;
  medium: string;
  title: string;
  artist: string;
  imagePath: string;
  source: string;
  reviewGoal: string;
};

type BenchmarkFixture = {
  id: string;
  title: string;
  medium: 'Oil on Canvas' | 'Drawing' | 'Watercolor' | 'Pastel' | 'Acrylic';
  source: 'catalog' | 'upload';
  imagePath: string;
  style?: string;
  artist?: string;
  reviewGoal: string;
  tags: string[];
};

type BenchmarkRecord = {
  id: string;
  title: string;
  style: string;
  medium: string;
  source: 'catalog' | 'upload';
  tags: string[];
  outcome: 'success' | 'error';
  critique?: CritiqueResultDTO;
  resultTier?: string | null;
  completedWithFallback: boolean;
  evidenceSuccess: boolean;
  evidenceSalvaged: boolean;
  voiceASalvaged: boolean;
  salvagedCriterionCount: number;
  conceptualGenericFailure: boolean;
  genericLanguageFailure: boolean;
  downstreamDrift: boolean;
  duplicateCoaching: boolean;
  errorStage?: string;
  errorDetails?: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(workspaceRoot, 'docs', 'critique-qa-fixtures.json');
const jsonOutputPath = path.join(workspaceRoot, 'docs', 'critique-benchmark-report.json');
const markdownOutputPath = path.join(workspaceRoot, 'docs', 'critique-benchmark-report.md');

const BENCHMARK_CATALOG_IDS = [
  'realism-courbet-burial',
  'realism-homer-gulf-stream',
  'impressionism-monet-sunrise',
  'impressionism-morisot-cradle',
  'expressionism-nolde-clematis-dahlia',
  'expressionism-kirchner-street',
  'abstract-kandinsky-vii',
] as const;

const BENCHMARK_UPLOAD_FIXTURES: BenchmarkFixture[] = [
  {
    id: 'upload-oil3',
    title: 'Oil 3',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'Oil3.JPEG',
    reviewGoal: 'Known developing oil regression fixture.',
    tags: ['developing', 'oil', 'regression'],
  },
  {
    id: 'upload-watercolor2',
    title: 'Watercolor 2',
    medium: 'Watercolor',
    source: 'upload',
    imagePath: 'Watercolor2.png',
    reviewGoal: 'Known watercolor regression fixture.',
    tags: ['developing', 'watercolor', 'regression'],
  },
  {
    id: 'upload-drawing1',
    title: 'Drawing 1',
    medium: 'Drawing',
    source: 'upload',
    imagePath: 'Drawing1 Small.png',
    reviewGoal: 'Drawing coverage in the fixed benchmark.',
    tags: ['drawing', 'different-medium'],
  },
  {
    id: 'upload-pastel1-small',
    title: 'Pastel 1 Small',
    medium: 'Pastel',
    source: 'upload',
    imagePath: 'Pastel1 Small.png',
    reviewGoal: 'Pastel coverage in the fixed benchmark.',
    tags: ['pastel', 'different-medium'],
  },
  {
    id: 'upload-abstract1',
    title: 'Abstract 1',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'Abstract1 Small.png',
    reviewGoal: 'Student-like abstract coverage in the fixed benchmark.',
    tags: ['abstract', 'developing', 'upload'],
  },
  {
    id: 'upload-acrylic-strong-01',
    title: 'Acrylic Strong 01',
    medium: 'Acrylic',
    source: 'upload',
    imagePath: 'Acrylic_Strong_01.png',
    reviewGoal: 'Strong acrylic medium benchmark with unmistakable handling.',
    tags: ['acrylic', 'strong', 'medium-benchmark'],
  },
  {
    id: 'upload-acrylic-developing-01',
    title: 'Acrylic Developing 01',
    medium: 'Acrylic',
    source: 'upload',
    imagePath: 'Acrylic_Developing_01.png',
    reviewGoal: 'Developing acrylic benchmark for medium-aware failure modes.',
    tags: ['acrylic', 'developing', 'medium-benchmark'],
  },
  {
    id: 'upload-stilllife-strong-01',
    title: 'Still Life Strong 01',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'StillLife_Strong_01.png',
    reviewGoal: 'Strong still-life benchmark for subject-agnostic object-study critique.',
    tags: ['still-life', 'strong', 'object-study'],
  },
  {
    id: 'upload-stilllife-developing-01',
    title: 'Still Life Developing 01',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'StillLife_Developing_01.png',
    reviewGoal: 'Developing still-life benchmark for object-study grounding and generic-language stress.',
    tags: ['still-life', 'developing', 'object-study'],
  },
  {
    id: 'upload-representational-novice-01',
    title: 'Representational Novice 01',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'Representational_Novice_01.png',
    reviewGoal: 'Novice representational benchmark for broad structural failure modes.',
    tags: ['representational', 'novice-like', 'benchmark-gap'],
  },
  {
    id: 'upload-abstract-novice-01',
    title: 'Abstract Novice 01',
    medium: 'Oil on Canvas',
    source: 'upload',
    imagePath: 'Abstract_Novice_01.png',
    reviewGoal: 'Novice abstract benchmark for weak non-objective structure and intent.',
    tags: ['abstract', 'novice-like', 'benchmark-gap'],
  },
];

const CONCEPTUAL_GENERIC_FAILURE_PATTERN =
  /(?:Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for|Conceptual evidence anchor is too soft for) (Intent and necessity|Presence, point of view, and human force)/;
const GENERIC_LANGUAGE_FAILURE_PATTERN =
  /Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for/;
const DOWNSTREAM_DRIFT_PATTERN =
  /\bdrift(?:ed|ing)?\b|not traceable to|anchored passage|aligned to the anchored evidence/i;

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

function catalogFixtureToBenchmark(fixture: CatalogFixture): BenchmarkFixture {
  const tagsById: Record<string, string[]> = {
    'realism-courbet-burial': ['masterwork', 'figure-led', 'oil'],
    'realism-homer-gulf-stream': ['masterwork', 'landscape', 'oil'],
    'impressionism-monet-sunrise': ['masterwork', 'landscape', 'oil'],
    'impressionism-morisot-cradle': ['masterwork', 'figure-led', 'oil'],
    'expressionism-nolde-clematis-dahlia': ['masterwork', 'still-life', 'oil'],
    'expressionism-kirchner-street': ['masterwork', 'figure-led', 'oil'],
    'abstract-kandinsky-vii': ['masterwork', 'abstract', 'oil'],
  };
  return {
    id: fixture.id,
    title: fixture.title,
    medium: fixture.medium as BenchmarkFixture['medium'],
    source: 'catalog',
    imagePath: fixture.imagePath,
    style: fixture.style,
    artist: fixture.artist,
    reviewGoal: fixture.reviewGoal,
    tags: tagsById[fixture.id] ?? [fixture.style.toLowerCase()],
  };
}

function selectBenchmarkFixtures(fixtures: BenchmarkFixture[], filters: string[]): BenchmarkFixture[] {
  if (filters.length === 0) return fixtures;
  const normalizedFilters = filters.map((filter) => filter.trim().toLowerCase()).filter(Boolean);
  return fixtures.filter((fixture) => {
    const haystacks = [
      fixture.id,
      fixture.title,
      fixture.medium,
      fixture.style ?? 'auto-style',
      fixture.reviewGoal,
      ...fixture.tags,
    ].map((value) => value.toLowerCase());
    return normalizedFilters.some((filter) => haystacks.some((haystack) => haystack.includes(filter)));
  });
}

function stageAttemptDetails(critique: CritiqueResultDTO, stageId: 'evidence' | 'voice_a' | 'voice_b' | 'validation'): string[] {
  const attempts = critique.pipeline?.stages?.[stageId]?.attempts ?? [];
  return attempts.flatMap((attempt) => attempt.details ?? []);
}

function debugAttemptDetails(attempts: CritiqueDebugInfo[] | undefined): string[] {
  return (attempts ?? []).flatMap((attempt) => attempt.details);
}

function hasDuplicateCoaching(critique: CritiqueResultDTO): boolean {
  const teaching = critique.categories
    .map((category) => category.phase3.teacherNextSteps.trim())
    .filter(Boolean);
  for (let index = 0; index < teaching.length; index++) {
    for (let other = index + 1; other < teaching.length; other++) {
      if (sameAdvice(teaching[index]!, teaching[other]!)) {
        return true;
      }
    }
  }

  const studioChanges = critique.simpleFeedback?.studioChanges.map((change) => change.text.trim()).filter(Boolean) ?? [];
  for (let index = 0; index < studioChanges.length; index++) {
    for (let other = index + 1; other < studioChanges.length; other++) {
      if (sameAdvice(studioChanges[index]!, studioChanges[other]!)) {
        return true;
      }
    }
  }
  return false;
}

function formatRate(count: number, total: number): string {
  if (total === 0) return '0/0 (0.0%)';
  return `${count}/${total} (${((count / total) * 100).toFixed(1)}%)`;
}

function metricSummary(records: BenchmarkRecord[]) {
  const producedCritiques = records.filter((record) => record.outcome === 'success').length;
  const evidenceSuccessCount = records.filter((record) => record.evidenceSuccess).length;
  const evidenceSalvagedCount = records.filter((record) => record.evidenceSalvaged).length;
  const voiceASalvagedCount = records.filter((record) => record.voiceASalvaged).length;
  const salvagedCriterionCount = records.reduce((sum, record) => sum + record.salvagedCriterionCount, 0);
  const fallbackCount = records.filter((record) => record.completedWithFallback).length;
  const conceptualGenericCount = records.filter((record) => record.conceptualGenericFailure).length;
  const genericLanguageCount = records.filter((record) => record.genericLanguageFailure).length;
  const driftCount = records.filter((record) => record.downstreamDrift).length;
  const duplicateCoachingCount = records.filter((record) => record.duplicateCoaching).length;

  return {
    totalFixtures: records.length,
    producedCritiques,
    evidenceSuccessRate: formatRate(evidenceSuccessCount, records.length),
    evidenceSalvageRate: formatRate(evidenceSalvagedCount, records.length),
    voiceASalvageRate: formatRate(voiceASalvagedCount, records.length),
    salvagedCriterionCount,
    fallbackRate: formatRate(fallbackCount, records.length),
    conceptualGenericFailureRate: formatRate(conceptualGenericCount, records.length),
    genericLanguageFailureRate: formatRate(genericLanguageCount, records.length),
    downstreamDriftRate: formatRate(driftCount, records.length),
    duplicateCoachingRate: formatRate(duplicateCoachingCount, producedCritiques),
  };
}

function groupSummaries(records: BenchmarkRecord[], key: 'style' | 'medium') {
  const groups = new Map<string, BenchmarkRecord[]>();
  for (const record of records) {
    const bucket = groups.get(record[key]) ?? [];
    bucket.push(record);
    groups.set(record[key], bucket);
  }

  return Object.fromEntries(
    Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, groupedRecords]) => [label, metricSummary(groupedRecords)])
  );
}

function markdownReport(fixtures: BenchmarkFixture[], records: BenchmarkRecord[]): string {
  const overall = metricSummary(records);
  const byStyle = groupSummaries(records, 'style');
  const byMedium = groupSummaries(records, 'medium');
  const lines: string[] = [];

  lines.push('# Critique benchmark report');
  lines.push('');
  lines.push('Generated from the fixed benchmark set for critique-pipeline reliability and grounding review.');
  lines.push('');
  lines.push('## Benchmark set');
  lines.push('');
  for (const fixture of fixtures) {
    lines.push(
      `- \`${fixture.id}\` — ${fixture.title} (${fixture.medium}; ${fixture.source}; ${fixture.tags.join(', ')})`
    );
  }
  lines.push('');
  lines.push('## Overall metrics');
  lines.push('');
  lines.push(`- total fixtures: ${overall.totalFixtures}`);
  lines.push(`- produced critiques: ${overall.producedCritiques}`);
  lines.push(`- evidence success rate: ${overall.evidenceSuccessRate}`);
  lines.push(`- evidence salvage rate: ${overall.evidenceSalvageRate}`);
  lines.push(`- Voice A salvage rate: ${overall.voiceASalvageRate}`);
  lines.push(`- salvaged criteria: ${overall.salvagedCriterionCount}`);
  lines.push(`- fallback rate: ${overall.fallbackRate}`);
  lines.push(`- conceptual generic failure rate: ${overall.conceptualGenericFailureRate}`);
  lines.push(`- generic language failure rate: ${overall.genericLanguageFailureRate}`);
  lines.push(`- downstream drift rate: ${overall.downstreamDriftRate}`);
  lines.push(`- duplicate-coaching rate: ${overall.duplicateCoachingRate}`);
  lines.push('');
  lines.push('## By style');
  lines.push('');
  for (const [style, summary] of Object.entries(byStyle)) {
    lines.push(`### ${style}`);
    lines.push('');
    lines.push(`- evidence success rate: ${summary.evidenceSuccessRate}`);
    lines.push(`- evidence salvage rate: ${summary.evidenceSalvageRate}`);
    lines.push(`- Voice A salvage rate: ${summary.voiceASalvageRate}`);
    lines.push(`- salvaged criteria: ${summary.salvagedCriterionCount}`);
    lines.push(`- fallback rate: ${summary.fallbackRate}`);
    lines.push(`- conceptual generic failure rate: ${summary.conceptualGenericFailureRate}`);
    lines.push(`- generic language failure rate: ${summary.genericLanguageFailureRate}`);
    lines.push(`- downstream drift rate: ${summary.downstreamDriftRate}`);
    lines.push(`- duplicate-coaching rate: ${summary.duplicateCoachingRate}`);
    lines.push('');
  }
  lines.push('## By medium');
  lines.push('');
  for (const [medium, summary] of Object.entries(byMedium)) {
    lines.push(`### ${medium}`);
    lines.push('');
    lines.push(`- evidence success rate: ${summary.evidenceSuccessRate}`);
    lines.push(`- evidence salvage rate: ${summary.evidenceSalvageRate}`);
    lines.push(`- Voice A salvage rate: ${summary.voiceASalvageRate}`);
    lines.push(`- salvaged criteria: ${summary.salvagedCriterionCount}`);
    lines.push(`- fallback rate: ${summary.fallbackRate}`);
    lines.push(`- conceptual generic failure rate: ${summary.conceptualGenericFailureRate}`);
    lines.push(`- generic language failure rate: ${summary.genericLanguageFailureRate}`);
    lines.push(`- downstream drift rate: ${summary.downstreamDriftRate}`);
    lines.push(`- duplicate-coaching rate: ${summary.duplicateCoachingRate}`);
    lines.push('');
  }
  lines.push('## Fixture results');
  lines.push('');
  for (const record of records) {
    lines.push(`### ${record.title}`);
    lines.push('');
    lines.push(`- id: \`${record.id}\``);
    lines.push(`- style: ${record.style}`);
    lines.push(`- medium: ${record.medium}`);
    lines.push(`- source: ${record.source}`);
    lines.push(`- outcome: ${record.outcome}`);
    lines.push(`- result tier: ${record.resultTier ?? 'n/a'}`);
    lines.push(`- completed with fallback: ${record.completedWithFallback ? 'yes' : 'no'}`);
    lines.push(`- evidence success: ${record.evidenceSuccess ? 'yes' : 'no'}`);
    lines.push(`- evidence salvaged: ${record.evidenceSalvaged ? 'yes' : 'no'}`);
    lines.push(`- Voice A salvaged: ${record.voiceASalvaged ? 'yes' : 'no'}`);
    lines.push(`- salvaged criterion count: ${record.salvagedCriterionCount}`);
    lines.push(`- conceptual generic failure seen: ${record.conceptualGenericFailure ? 'yes' : 'no'}`);
    lines.push(`- generic language failure seen: ${record.genericLanguageFailure ? 'yes' : 'no'}`);
    lines.push(`- downstream drift seen: ${record.downstreamDrift ? 'yes' : 'no'}`);
    lines.push(`- duplicate coaching seen: ${record.duplicateCoaching ? 'yes' : 'no'}`);
    if (record.errorStage) {
      lines.push(`- error stage: ${record.errorStage}`);
    }
    if (record.errorDetails && record.errorDetails.length > 0) {
      lines.push(`- first error detail: ${record.errorDetails[0]}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run pipeline stage review.');
  }

  const raw = await readFile(fixturePath, 'utf8');
  const catalogFixtures = JSON.parse(raw) as CatalogFixture[];
  const catalogBenchmarks = BENCHMARK_CATALOG_IDS.map((id) => {
    const fixture = catalogFixtures.find((entry) => entry.id === id);
    if (!fixture) throw new Error(`Missing catalog fixture: ${id}`);
    return catalogFixtureToBenchmark(fixture);
  });
  const benchmarkFixtures = [...catalogBenchmarks, ...BENCHMARK_UPLOAD_FIXTURES];
  const filters = process.argv.slice(2);
  const fixtures = selectBenchmarkFixtures(benchmarkFixtures, filters);
  if (fixtures.length === 0) {
    throw new Error('No benchmark fixtures matched the provided filters.');
  }

  const records: BenchmarkRecord[] = [];

  for (const fixture of fixtures) {
    const absolutePath =
      fixture.source === 'catalog'
        ? path.join(workspaceRoot, fixture.imagePath)
        : path.join(workspaceRoot, fixture.imagePath);
    const imageDataUrl = await imageFileToDataUrl(absolutePath);
    const style =
      fixture.style ??
      (await runOpenAIClassifyStyle(apiKey, imageDataUrl)).style;

    try {
      const critique = await runOpenAICritique(apiKey, {
        style,
        medium: fixture.medium,
        imageDataUrl,
        paintingTitle: fixture.title,
      });
      const evidenceDetails = stageAttemptDetails(critique, 'evidence');
      const downstreamDetails = [
        ...stageAttemptDetails(critique, 'voice_a'),
        ...stageAttemptDetails(critique, 'voice_b'),
        ...stageAttemptDetails(critique, 'validation'),
      ];

      records.push({
        id: fixture.id,
        title: fixture.title,
        style,
        medium: fixture.medium,
        source: fixture.source,
        tags: fixture.tags,
        outcome: 'success',
        critique,
        resultTier: critique.pipeline?.resultTier ?? null,
        completedWithFallback: critique.pipeline?.completedWithFallback ?? false,
        evidenceSuccess: critique.pipeline?.stages?.evidence?.status === 'succeeded',
        evidenceSalvaged: (critique.pipeline?.salvagedCriteria ?? []).some((item) => item.stage === 'evidence'),
        voiceASalvaged: (critique.pipeline?.salvagedCriteria ?? []).some((item) => item.stage === 'voice_a'),
        salvagedCriterionCount: critique.pipeline?.salvagedCriteria?.length ?? 0,
        conceptualGenericFailure: evidenceDetails.some((detail) =>
          CONCEPTUAL_GENERIC_FAILURE_PATTERN.test(detail)
        ),
        genericLanguageFailure: evidenceDetails.some((detail) =>
          GENERIC_LANGUAGE_FAILURE_PATTERN.test(detail)
        ),
        downstreamDrift: downstreamDetails.some((detail) => DOWNSTREAM_DRIFT_PATTERN.test(detail)),
        duplicateCoaching: hasDuplicateCoaching(critique),
      });
    } catch (error) {
      const pipelineError = error instanceof CritiquePipelineError ? error : undefined;
      const evidenceDetails = debugAttemptDetails(pipelineError?.debug?.attempts);
      records.push({
        id: fixture.id,
        title: fixture.title,
        style,
        medium: fixture.medium,
        source: fixture.source,
        tags: fixture.tags,
        outcome: 'error',
        resultTier: null,
        completedWithFallback: false,
        evidenceSuccess: pipelineError?.stage !== 'evidence',
        evidenceSalvaged: false,
        voiceASalvaged: false,
        salvagedCriterionCount: 0,
        conceptualGenericFailure: evidenceDetails.some((detail) =>
          CONCEPTUAL_GENERIC_FAILURE_PATTERN.test(detail)
        ),
        genericLanguageFailure: evidenceDetails.some((detail) =>
          GENERIC_LANGUAGE_FAILURE_PATTERN.test(detail)
        ),
        downstreamDrift: (pipelineError?.details ?? []).some((detail) => DOWNSTREAM_DRIFT_PATTERN.test(detail)),
        duplicateCoaching: false,
        errorStage: pipelineError?.stage ?? 'unknown',
        errorDetails: pipelineError?.details ?? [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    fixtures: records.map((record) => ({
      id: record.id,
      title: record.title,
      style: record.style,
      medium: record.medium,
      source: record.source,
      tags: record.tags,
      outcome: record.outcome,
      resultTier: record.resultTier ?? null,
      completedWithFallback: record.completedWithFallback,
      evidenceSuccess: record.evidenceSuccess,
      conceptualGenericFailure: record.conceptualGenericFailure,
      genericLanguageFailure: record.genericLanguageFailure,
      downstreamDrift: record.downstreamDrift,
      duplicateCoaching: record.duplicateCoaching,
      errorStage: record.errorStage ?? null,
      errorDetails: record.errorDetails ?? [],
    })),
    overall: metricSummary(records),
    byStyle: groupSummaries(records, 'style'),
    byMedium: groupSummaries(records, 'medium'),
  };

  await mkdir(path.dirname(jsonOutputPath), { recursive: true });
  await writeFile(jsonOutputPath, JSON.stringify(report, null, 2));
  await writeFile(markdownOutputPath, markdownReport(fixtures, records));
  console.log(`Wrote ${path.relative(workspaceRoot, jsonOutputPath)}`);
  console.log(`Wrote ${path.relative(workspaceRoot, markdownOutputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
