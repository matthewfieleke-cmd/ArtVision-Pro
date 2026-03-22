import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const pngSource = join(publicDir, 'PWAicon.png');

/** Remove uniform border (e.g. white matting) so only the icon art remains; PWA output uses transparent letterbox. */
async function fromRaster() {
  const trimmed = await sharp(pngSource)
    .trim({
      threshold: 12,
    })
    .toBuffer();

  for (const size of [192, 512]) {
    const out = join(publicDir, `pwa-${size}.png`);
    await sharp(trimmed)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(out);
    console.log('Wrote', out, '(trimmed + transparent pad)');
  }
}

async function fromSvg() {
  const svgPath = join(publicDir, 'app-icon.svg');
  const svg = readFileSync(svgPath);
  for (const size of [192, 512]) {
    const out = join(publicDir, `pwa-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log('Wrote', out, 'from app-icon.svg');
  }
}

if (existsSync(pngSource)) {
  await fromRaster();
} else {
  await fromSvg();
}
