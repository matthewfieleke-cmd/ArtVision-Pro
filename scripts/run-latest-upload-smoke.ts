import './loadLocalEnv.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle.ts';
import { evaluateCritiqueQuality } from '../lib/critiqueEval.js';
import {
  CritiquePipelineError,
  errorDetails,
  errorMessage,
} from '../lib/critiqueErrors.js';
import { runOpenAICritique } from '../lib/openaiCritique.ts';
import {
  selectLatestUploadFixtures,
  type LatestUploadFixture,
} from './latestUploadFixtures.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const outputPath = path.join(workspaceRoot, 'docs', 'latest-upload-smoke.md');

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

function recordFailure(
  sections: string[],
  fixture: LatestUploadFixture,
  classification: Awaited<ReturnType<typeof runOpenAIClassifyStyle>> | undefined,
  error: unknown
): void {
  sections.push(`## ${fixture.title}`);
  sections.push('');
  sections.push(`- file: \`${fixture.filename}\``);
  sections.push(`- declared medium: ${fixture.medium}`);
  if (classification) {
    sections.push(`- classified style: ${classification.style}`);
    sections.push(`- classification rationale: ${classification.rationale}`);
  } else {
    sections.push('- classified style: _(not reached)_');
  }
  sections.push('- status: FAILED');
  sections.push(`- error: ${errorMessage(error)}`);
  for (const detail of errorDetails(error)) {
    sections.push(`- detail: ${detail}`);
  }
  if (error instanceof CritiquePipelineError && error.debug?.attempts?.length) {
    sections.push('- attempts:');
    for (const attempt of error.debug.attempts) {
      sections.push(`  - attempt ${attempt.attempt}: ${attempt.error}`);
      if (attempt.details[0]) {
        sections.push(`    - first detail: ${attempt.details[0]}`);
      }
      if (attempt.criterionEvidencePreview?.[0]?.anchor) {
        sections.push(`    - sample anchor: ${attempt.criterionEvidencePreview[0].anchor}`);
      }
    }
  }
  sections.push('');
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run latest upload smoke review.');
  }

  const fixtures = selectLatestUploadFixtures(process.argv.slice(2));
  if (fixtures.length === 0) {
    throw new Error('No latest-upload fixtures matched the provided filters.');
  }

  const sections: string[] = [];
  let passed = 0;
  let failed = 0;

  sections.push('# Latest upload smoke review');
  sections.push('');
  sections.push('Runs each latest-upload fixture independently and continues after failures.');
  sections.push('');
  sections.push(`- fixture count: ${fixtures.length}`);
  sections.push(`- filters: ${process.argv.slice(2).join(', ') || '(none)'}`);
  sections.push('');

  for (const fixture of fixtures) {
    const absolutePath = path.join(workspaceRoot, fixture.filename);
    let classification: Awaited<ReturnType<typeof runOpenAIClassifyStyle>> | undefined;

    try {
      const imageDataUrl = await imageFileToDataUrl(absolutePath);
      classification = await runOpenAIClassifyStyle(apiKey, imageDataUrl);
      const critique = await runOpenAICritique(apiKey, {
        style: classification.style,
        medium: fixture.medium,
        imageDataUrl,
        paintingTitle: fixture.title,
      });
      const evaluation = evaluateCritiqueQuality(critique);

      passed += 1;
      sections.push(`## ${fixture.title}`);
      sections.push('');
      sections.push(`- file: \`${fixture.filename}\``);
      sections.push(`- declared medium: ${fixture.medium}`);
      sections.push(`- classified style: ${classification.style}`);
      sections.push(`- classification rationale: ${classification.rationale}`);
      sections.push('- status: PASSED');
      sections.push(`- overall confidence: ${critique.overallConfidence ?? 'n/a'}`);
      sections.push(
        `- blocking issues after quality evaluation: ${evaluation.blockingIssues.length === 0 ? 'none' : evaluation.blockingIssues.join('; ')}`
      );
      sections.push(`- sample summary: ${critique.summary}`);
      sections.push('');
    } catch (error) {
      failed += 1;
      recordFailure(sections, fixture, classification, error);
    }
  }

  sections.splice(4, 0, `- passed: ${passed}`, `- failed: ${failed}`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sections.join('\n'));
  console.log(`Wrote ${path.relative(workspaceRoot, outputPath)} (${passed} passed, ${failed} failed)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
