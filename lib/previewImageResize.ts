import sharp from 'sharp';

const API_SIZES = [
  { w: 1024, h: 1024, param: '1024x1024' as const },
  { w: 1536, h: 1024, param: '1536x1024' as const },
  { w: 1024, h: 1536, param: '1024x1536' as const },
];

export type ImagesEditSizeParam = (typeof API_SIZES)[number]['param'];

/** Pick the GPT image edit `size` whose aspect ratio is closest to the upload. */
export function pickImagesEditSize(origW: number, origH: number): ImagesEditSizeParam {
  if (origW <= 0 || origH <= 0) return '1024x1024';
  const r = origW / origH;
  let best = API_SIZES[0]!;
  let bestScore = Infinity;
  for (const s of API_SIZES) {
    const sr = s.w / s.h;
    const score = Math.abs(Math.log(r) - Math.log(sr));
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best.param;
}

function dimsForParam(p: ImagesEditSizeParam): { w: number; h: number } {
  const s = API_SIZES.find((x) => x.param === p)!;
  return { w: s.w, h: s.h };
}

/**
 * Read pixel size from image buffer (JPEG/PNG/WebP).
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('Could not read image dimensions');
  return { width, height };
}

/**
 * Fit upload inside exact API dimensions (letterbox) so the full painting is visible to the model.
 */
export async function bufferToApiInputPng(buffer: Buffer, editSize: ImagesEditSizeParam): Promise<Buffer> {
  const { w, h } = dimsForParam(editSize);
  return sharp(buffer)
    .rotate()
    .resize(w, h, {
      fit: 'contain',
      position: 'centre',
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    })
    .png()
    .toBuffer();
}

/**
 * Resize API output to exactly the upload's width × height (fill) so the client slider aligns pixel-perfect.
 */
export async function resizeEditOutputToMatchUpload(
  editedBuffer: Buffer,
  origWidth: number,
  origHeight: number,
  preferMime: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<{ buffer: Buffer; mime: string }> {
  const pipeline = sharp(editedBuffer)
    .rotate()
    .resize(origWidth, origHeight, { fit: 'fill', position: 'centre' });

  if (preferMime === 'image/png') {
    return { buffer: await pipeline.png().toBuffer(), mime: 'image/png' };
  }
  if (preferMime === 'image/webp') {
    return { buffer: await pipeline.webp({ quality: 92 }).toBuffer(), mime: 'image/webp' };
  }
  return { buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mime: 'image/jpeg' };
}
