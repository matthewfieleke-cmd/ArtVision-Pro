import sharp from 'sharp';

const API_SIZES = [
  { w: 1024, h: 1024, param: '1024x1024' as const },
  { w: 1536, h: 1024, param: '1536x1024' as const },
  { w: 1024, h: 1536, param: '1024x1536' as const },
];

export type ImagesEditSizeParam = (typeof API_SIZES)[number]['param'];
export type ApiInputGeometry = {
  canvasWidth: number;
  canvasHeight: number;
  innerWidth: number;
  innerHeight: number;
  offsetX: number;
  offsetY: number;
};

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

function geometryForContain(
  origWidth: number,
  origHeight: number,
  canvasWidth: number,
  canvasHeight: number
): ApiInputGeometry {
  const scale = Math.min(canvasWidth / origWidth, canvasHeight / origHeight);
  const innerWidth = Math.max(1, Math.round(origWidth * scale));
  const innerHeight = Math.max(1, Math.round(origHeight * scale));
  const offsetX = Math.max(0, Math.round((canvasWidth - innerWidth) / 2));
  const offsetY = Math.max(0, Math.round((canvasHeight - innerHeight) / 2));
  return {
    canvasWidth,
    canvasHeight,
    innerWidth,
    innerHeight,
    offsetX,
    offsetY,
  };
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
export async function bufferToApiInputPng(
  buffer: Buffer,
  editSize: ImagesEditSizeParam
): Promise<{ buffer: Buffer; geometry: ApiInputGeometry }> {
  const { w, h } = dimsForParam(editSize);
  const { width: origWidth, height: origHeight } = await getImageDimensions(buffer);
  const geometry = geometryForContain(origWidth, origHeight, w, h);
  const pngBuffer = await sharp(buffer)
    .rotate()
    .resize(w, h, {
      fit: 'contain',
      position: 'centre',
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    })
    .png()
    .toBuffer();
  return { buffer: pngBuffer, geometry };
}

/**
 * Crop the edited output back to the non-letterboxed painting area, then resize to the
 * original upload dimensions so the compare slider aligns without stretch distortion.
 */
export async function resizeEditOutputToMatchUpload(
  editedBuffer: Buffer,
  origWidth: number,
  origHeight: number,
  preferMime: 'image/jpeg' | 'image/png' | 'image/webp',
  geometry: ApiInputGeometry
): Promise<{ buffer: Buffer; mime: string }> {
  const pipeline = sharp(editedBuffer)
    .rotate()
    .extract({
      left: geometry.offsetX,
      top: geometry.offsetY,
      width: geometry.innerWidth,
      height: geometry.innerHeight,
    })
    .resize(origWidth, origHeight, { fit: 'fill', position: 'centre' });

  if (preferMime === 'image/png') {
    return { buffer: await pipeline.png().toBuffer(), mime: 'image/png' };
  }
  if (preferMime === 'image/webp') {
    return { buffer: await pipeline.webp({ quality: 92 }).toBuffer(), mime: 'image/webp' };
  }
  return { buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mime: 'image/jpeg' };
}
