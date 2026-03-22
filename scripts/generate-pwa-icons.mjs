import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const pngSource = join(publicDir, 'PWAicon.png');

if (!existsSync(pngSource)) {
  console.error('Missing public/PWAicon.png — add your master PWA artwork there.');
  process.exit(1);
}

/** Trim uniform border (e.g. white mat); all outputs are the same art at different sizes. */
const trimmed = await sharp(pngSource)
  .trim({ threshold: 12 })
  .toBuffer();

for (const size of [192, 512]) {
  const out = join(publicDir, `pwa-${size}.png`);
  await sharp(trimmed)
    .clone()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(out);
  console.log('Wrote', out);
}
