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
 * Map letterbox crop from expected API canvas pixels to actual model output size.
 * When the API returns e.g. 1025×1026 instead of 1024×1024, a fixed extract box misses
 * and leaves a band of letterbox fill (often read as a “white bar”).
 */
export function scaleGeometryToActualCanvas(
  geometry: ApiInputGeometry,
  actualWidth: number,
  actualHeight: number
): { left: number; top: number; width: number; height: number } {
  const cw = geometry.canvasWidth;
  const ch = geometry.canvasHeight;
  if (actualWidth <= 0 || actualHeight <= 0 || cw <= 0 || ch <= 0) {
    return {
      left: 0,
      top: 0,
      width: Math.max(1, actualWidth),
      height: Math.max(1, actualHeight),
    };
  }
  const sx = actualWidth / cw;
  const sy = actualHeight / ch;
  let left = Math.round(geometry.offsetX * sx);
  let top = Math.round(geometry.offsetY * sy);
  let width = Math.round(geometry.innerWidth * sx);
  let height = Math.round(geometry.innerHeight * sy);
  left = Math.max(0, Math.min(left, actualWidth - 1));
  top = Math.max(0, Math.min(top, actualHeight - 1));
  width = Math.max(1, Math.min(width, actualWidth - left));
  height = Math.max(1, Math.min(height, actualHeight - top));
  return { left, top, width, height };
}

/** Match our letterbox fill and typical model “mat” pixels (slightly off-white). */
function isNearUniformLight(r: number, g: number, b: number): boolean {
  return r >= 247 && g >= 247 && b >= 247;
}

/** Cap how much we strip per edge so we never eat into real painting. */
const TRIM_MAX_EDGE_FRAC = 0.14;
const TRIM_ROW_LIGHT_RATIO = 0.992;
const TRIM_ANALYZE_MAX_SIDE = 512;

/**
 * Remove thin uniform near-white bands on outer edges (model margins / leftover letterbox).
 * Conservative: only trims when almost every pixel on an edge row/column is near-white.
 */
async function trimNearUniformLightEdges(
  buffer: Buffer,
  preferMime: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 16 || h < 16) return buffer;

  const scale = Math.min(1, TRIM_ANALYZE_MAX_SIDE / Math.max(w, h));
  const sw = Math.max(8, Math.round(w * scale));
  const sh = Math.max(8, Math.round(h * scale));
  const { data, info } = await sharp(buffer)
    .resize(sw, sh, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  if (ch < 3) return buffer;

  const rowLightCount = (y: number): number => {
    let light = 0;
    const rowStart = y * sw * ch;
    for (let x = 0; x < sw; x++) {
      const i = rowStart + x * ch;
      if (isNearUniformLight(data[i]!, data[i + 1]!, data[i + 2]!)) light++;
    }
    return light;
  };

  const colLightCount = (x: number): number => {
    let light = 0;
    for (let y = 0; y < sh; y++) {
      const i = y * sw * ch + x * ch;
      if (isNearUniformLight(data[i]!, data[i + 1]!, data[i + 2]!)) light++;
    }
    return light;
  };

  const maxRowsBottom = Math.min(sh - 1, Math.floor(sh * TRIM_MAX_EDGE_FRAC));
  let trimBottomSmall = 0;
  for (let y = sh - 1; y >= 0 && trimBottomSmall < maxRowsBottom; y--) {
    if (rowLightCount(y) / sw >= TRIM_ROW_LIGHT_RATIO) trimBottomSmall++;
    else break;
  }

  const maxRowsTop = Math.min(sh - 1 - trimBottomSmall, Math.floor(sh * TRIM_MAX_EDGE_FRAC));
  let trimTopSmall = 0;
  for (let y = 0; y < sh && trimTopSmall < maxRowsTop; y++) {
    if (rowLightCount(y) / sw >= TRIM_ROW_LIGHT_RATIO) trimTopSmall++;
    else break;
  }

  const maxColsRight = Math.min(sw - 1, Math.floor(sw * TRIM_MAX_EDGE_FRAC));
  let trimRightSmall = 0;
  for (let x = sw - 1; x >= 0 && trimRightSmall < maxColsRight; x--) {
    if (colLightCount(x) / sh >= TRIM_ROW_LIGHT_RATIO) trimRightSmall++;
    else break;
  }

  const maxColsLeft = Math.min(sw - 1 - trimRightSmall, Math.floor(sw * TRIM_MAX_EDGE_FRAC));
  let trimLeftSmall = 0;
  for (let x = 0; x < sw && trimLeftSmall < maxColsLeft; x++) {
    if (colLightCount(x) / sh >= TRIM_ROW_LIGHT_RATIO) trimLeftSmall++;
    else break;
  }

  const toFull = (small: number, fullDim: number, smallDim: number) =>
    Math.min(Math.floor(fullDim * TRIM_MAX_EDGE_FRAC), Math.round((small * fullDim) / smallDim));

  const trimTop = toFull(trimTopSmall, h, sh);
  const trimBottom = toFull(trimBottomSmall, h, sh);
  const trimLeft = toFull(trimLeftSmall, w, sw);
  const trimRight = toFull(trimRightSmall, w, sw);

  const innerW = w - trimLeft - trimRight;
  const innerH = h - trimTop - trimBottom;
  if (innerW < Math.floor(w * 0.85) || innerH < Math.floor(h * 0.85)) return buffer;
  if (trimTop === 0 && trimBottom === 0 && trimLeft === 0 && trimRight === 0) return buffer;

  const pipeline = sharp(buffer).extract({
    left: trimLeft,
    top: trimTop,
    width: innerW,
    height: innerH,
  });

  if (preferMime === 'image/png') {
    return pipeline.png().toBuffer();
  }
  if (preferMime === 'image/webp') {
    return pipeline.webp({ quality: 92 }).toBuffer();
  }
  return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
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
  const rotated = sharp(editedBuffer).rotate();
  const meta = await rotated.metadata();
  const outW = meta.width ?? 0;
  const outH = meta.height ?? 0;
  if (!outW || !outH) {
    throw new Error('Could not read edited image dimensions');
  }

  const rect =
    outW === geometry.canvasWidth && outH === geometry.canvasHeight
      ? {
          left: geometry.offsetX,
          top: geometry.offsetY,
          width: geometry.innerWidth,
          height: geometry.innerHeight,
        }
      : scaleGeometryToActualCanvas(geometry, outW, outH);

  const resized = await rotated
    .extract(rect)
    .resize(origWidth, origHeight, { fit: 'fill', position: 'centre' })
    .toBuffer();

  const trimmed = await trimNearUniformLightEdges(resized, preferMime);
  const { width: tw, height: th } = await sharp(trimmed).metadata();
  const needResize =
    tw != null &&
    th != null &&
    (tw !== origWidth || th !== origHeight);
  const pipeline = needResize
    ? sharp(trimmed).resize(origWidth, origHeight, { fit: 'fill', position: 'centre' })
    : sharp(trimmed);

  if (preferMime === 'image/png') {
    return { buffer: await pipeline.png().toBuffer(), mime: 'image/png' };
  }
  if (preferMime === 'image/webp') {
    return { buffer: await pipeline.webp({ quality: 92 }).toBuffer(), mime: 'image/webp' };
  }
  return { buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mime: 'image/jpeg' };
}
