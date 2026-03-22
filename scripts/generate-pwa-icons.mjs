import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const pngSource = join(publicDir, 'PWAicon.png');

/** Remove uniform border (e.g. white matting); PWA outputs use transparent letterbox where needed. */
async function getTrimmedBuffer() {
  return sharp(pngSource)
    .trim({
      threshold: 12,
    })
    .toBuffer();
}

async function fromRaster() {
  const trimmed = await getTrimmedBuffer();

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
    console.log('Wrote', out, '(trimmed + transparent pad)');
  }

  // iOS Safari "Add to Home Screen" / share sheet preview (prefers 180×180)
  const appleOut = join(publicDir, 'apple-touch-icon.png');
  await sharp(trimmed)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(appleOut);
  console.log('Wrote', appleOut);

  // Tab / share UI favicon (replaces old SVG so preview matches installed icon)
  const fav32 = join(publicDir, 'favicon-32.png');
  await sharp(trimmed)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(fav32);
  console.log('Wrote', fav32);
}

async function fromSvg() {
  const svgPath = join(publicDir, 'app-icon.svg');
  const svg = readFileSync(svgPath);
  for (const size of [192, 512]) {
    const out = join(publicDir, `pwa-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log('Wrote', out, 'from app-icon.svg');
  }
  await sharp(svg).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'));
  await sharp(svg).resize(32, 32).png().toFile(join(publicDir, 'favicon-32.png'));
}

if (existsSync(pngSource)) {
  await fromRaster();
} else {
  await fromSvg();
}
