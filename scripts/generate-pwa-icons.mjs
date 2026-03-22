import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'app-icon.svg');
const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  const out = join(root, 'public', `pwa-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log('Wrote', out);
}
