import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = '/workspace';
const fixturePath = path.join(workspaceRoot, 'docs', 'critique-qa-fixtures.json');

async function main() {
  const raw = await readFile(fixturePath, 'utf8');
  const fixtures = JSON.parse(raw);

  if (!Array.isArray(fixtures)) {
    throw new Error('Fixture file must contain an array.');
  }

  console.log('Critique QA fixtures\n');
  for (const fixture of fixtures) {
    if (typeof fixture !== 'object' || fixture === null) {
      throw new Error('Each fixture must be an object.');
    }
    const imagePathField =
      typeof fixture.imagePath === 'string'
        ? fixture.imagePath
        : typeof fixture.image === 'string'
          ? fixture.image
          : null;
    if (!imagePathField) {
      throw new Error(`Fixture ${fixture.id ?? '<unknown>'} is missing imagePath.`);
    }
    const imagePath = path.isAbsolute(imagePathField)
      ? imagePathField
      : path.join(workspaceRoot, imagePathField);
    console.log(`- ${fixture.id}`);
    console.log(`  title: ${fixture.title}`);
    console.log(`  artist: ${fixture.artist}`);
    console.log(`  style: ${fixture.style}`);
    console.log(`  medium: ${fixture.medium}`);
    console.log(`  source: ${fixture.source ?? 'unknown'}`);
    console.log(`  image: ${imagePath}`);
    console.log(`  review_goal: ${fixture.reviewGoal ?? fixture.useCase ?? 'n/a'}`);
    console.log('');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
