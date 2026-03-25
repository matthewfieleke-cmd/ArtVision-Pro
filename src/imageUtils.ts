/** Downscale and JPEG-compress for localStorage-friendly thumbnails. */
export function compressDataUrl(
  dataUrl: string,
  maxWidth = 720,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropPreset = 'portrait' | 'landscape';

export type AutoCropSuggestion = {
  crop: PixelCrop;
  rotation: number;
  corners: PerspectiveCorners;
  confidence: 'low' | 'medium' | 'high';
};

export type Point = {
  x: number;
  y: number;
};

export type PerspectiveCorners = [Point, Point, Point, Point];

type ImplicitLine = {
  a: number;
  b: number;
  c: number;
};
export type CornerQuad = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

export function cornersToQuad(corners: PerspectiveCorners): CornerQuad {
  return {
    topLeft: corners[0],
    topRight: corners[1],
    bottomRight: corners[2],
    bottomLeft: corners[3],
  };
}

export function quadToCorners(quad: CornerQuad): PerspectiveCorners {
  return [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export async function cropDataUrl(dataUrl: string, crop: PixelCrop, quality = 0.92): Promise<string> {
  const img = await loadImage(dataUrl);
  const safeWidth = Math.max(1, Math.round(crop.width));
  const safeHeight = Math.max(1, Math.round(crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(
    img,
    Math.max(0, Math.round(crop.x)),
    Math.max(0, Math.round(crop.y)),
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );
  return canvas.toDataURL('image/jpeg', quality);
}

function rotateBounds(width: number, height: number, radians: number): { width: number; height: number } {
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width: Math.ceil(width * cos + height * sin),
    height: Math.ceil(width * sin + height * cos),
  };
}

export async function cropDataUrlWithRotation(
  dataUrl: string,
  crop: PixelCrop,
  rotation = 0,
  quality = 0.92
): Promise<string> {
  const img = await loadImage(dataUrl);
  const radians = (rotation * Math.PI) / 180;
  const safeWidth = Math.max(1, Math.round(crop.width));
  const safeHeight = Math.max(1, Math.round(crop.height));
  const rotated = rotateBounds(img.naturalWidth, img.naturalHeight, radians);

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.save();
  ctx.translate(-Math.round(crop.x), -Math.round(crop.y));
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', quality);
}

function orderCorners(points: Point[]): PerspectiveCorners {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
  return [top[0]!, top[1]!, bottom[1]!, bottom[0]!];
}

function lineFromPoints(p1: Point, p2: Point): ImplicitLine {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  const c = p1.x * p2.y - p2.x * p1.y;
  return { a, b, c };
}

function intersectLines(l1: ImplicitLine, l2: ImplicitLine): Point | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-6) return null;
  const x = (l1.b * l2.c - l2.b * l1.c) / det;
  const y = (l2.a * l1.c - l1.a * l2.c) / det;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.min(width, Math.max(0, point.x)),
    y: Math.min(height, Math.max(0, point.y)),
  };
}

function fitHorizontalEdge(points: Point[], fallbackY: number, width: number): ImplicitLine {
  if (points.length < 2) {
    return lineFromPoints({ x: 0, y: fallbackY }, { x: width, y: fallbackY });
  }
  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-6) {
    return lineFromPoints({ x: 0, y: fallbackY }, { x: width, y: fallbackY });
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return lineFromPoints({ x: 0, y: intercept }, { x: width, y: slope * width + intercept });
}

function fitVerticalEdge(points: Point[], fallbackX: number, height: number): ImplicitLine {
  if (points.length < 2) {
    return lineFromPoints({ x: fallbackX, y: 0 }, { x: fallbackX, y: height });
  }
  const n = points.length;
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumYY = points.reduce((acc, p) => acc + p.y * p.y, 0);
  const sumYX = points.reduce((acc, p) => acc + p.y * p.x, 0);
  const denom = n * sumYY - sumY * sumY;
  if (Math.abs(denom) < 1e-6) {
    return lineFromPoints({ x: fallbackX, y: 0 }, { x: fallbackX, y: height });
  }
  const slope = (n * sumYX - sumY * sumX) / denom;
  const intercept = (sumX - slope * sumY) / n;
  return lineFromPoints({ x: intercept, y: 0 }, { x: slope * height + intercept, y: height });
}

function buildRectCorners(crop: PixelCrop): PerspectiveCorners {
  return [
    { x: crop.x, y: crop.y },
    { x: crop.x + crop.width, y: crop.y },
    { x: crop.x + crop.width, y: crop.y + crop.height },
    { x: crop.x, y: crop.y + crop.height },
  ];
}

export async function perspectiveCropDataUrl(
  dataUrl: string,
  corners: PerspectiveCorners,
  quality = 0.92
): Promise<string> {
  const [{ default: PerspectiveTransform }] = await Promise.all([
    import('perspective-transform'),
  ]);
  const img = await loadImage(dataUrl);
  const ordered = orderCorners(corners);
  const topWidth = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
  const bottomWidth = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
  const leftHeight = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
  const rightHeight = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
  const outWidth = Math.max(1, Math.round(Math.max(topWidth, bottomWidth)));
  const outHeight = Math.max(1, Math.round(Math.max(leftHeight, rightHeight)));

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.naturalWidth;
  sourceCanvas.height = img.naturalHeight;
  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Canvas not supported');
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outCtx = outputCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas not supported');
  const outData = outCtx.createImageData(outWidth, outHeight);

  const transform = PerspectiveTransform(
    [
      ordered[0].x,
      ordered[0].y,
      ordered[1].x,
      ordered[1].y,
      ordered[2].x,
      ordered[2].y,
      ordered[3].x,
      ordered[3].y,
    ],
    [0, 0, outWidth, 0, outWidth, outHeight, 0, outHeight]
  );
  const inverse = transform.inverse();

  const sample = (x: number, y: number, channel: number): number => {
    const sx = Math.min(img.naturalWidth - 1, Math.max(0, x));
    const sy = Math.min(img.naturalHeight - 1, Math.max(0, y));
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const x1 = Math.min(img.naturalWidth - 1, x0 + 1);
    const y1 = Math.min(img.naturalHeight - 1, y0 + 1);
    const dx = sx - x0;
    const dy = sy - y0;
    const idx = (px: number, py: number) => (py * img.naturalWidth + px) * 4 + channel;
    const v00 = srcData.data[idx(x0, y0)]!;
    const v10 = srcData.data[idx(x1, y0)]!;
    const v01 = srcData.data[idx(x0, y1)]!;
    const v11 = srcData.data[idx(x1, y1)]!;
    const top = v00 * (1 - dx) + v10 * dx;
    const bottom = v01 * (1 - dx) + v11 * dx;
    return top * (1 - dy) + bottom * dy;
  };

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const [sx, sy] = inverse.transform(x, y) as [number, number];
      const idx = (y * outWidth + x) * 4;
      outData.data[idx] = Math.round(sample(sx, sy, 0));
      outData.data[idx + 1] = Math.round(sample(sx, sy, 1));
      outData.data[idx + 2] = Math.round(sample(sx, sy, 2));
      outData.data[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outputCanvas.toDataURL('image/jpeg', quality);
}

export async function suggestPaintingCrop(dataUrl: string): Promise<AutoCropSuggestion> {
  const img = await loadImage(dataUrl);
  const sampleMax = 300;
  const scale = Math.min(1, sampleMax / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const lum = (idx: number) => 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  let total = 0;
  let borderTotal = 0;
  let borderCount = 0;
  const borderBand = Math.max(4, Math.round(Math.min(width, height) * 0.08));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const L = lum(idx);
      total += L;
      if (x < borderBand || y < borderBand || x >= width - borderBand || y >= height - borderBand) {
        borderTotal += L;
        borderCount += 1;
      }
    }
  }
  const globalMean = total / (width * height);
  const borderMean = borderCount ? borderTotal / borderCount : globalMean;
  const threshold = Math.max(12, Math.abs(borderMean - globalMean) * 0.45 + 12);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const L = lum(idx);
      const right = lum((y * width + (x + 1)) * 4);
      const down = lum(((y + 1) * width + x) * 4);
      const edge = Math.abs(L - right) + Math.abs(L - down);
      const borderDelta = Math.abs(L - borderMean);
      if (edge > threshold || borderDelta > threshold * 0.9) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hits += 1;
      }
    }
  }

  if (!hits || maxX <= minX || maxY <= minY) {
    const fullCorners: PerspectiveCorners = [
      { x: 0, y: 0 },
      { x: img.naturalWidth, y: 0 },
      { x: img.naturalWidth, y: img.naturalHeight },
      { x: 0, y: img.naturalHeight },
    ];
    return {
      crop: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
      rotation: 0,
      corners: fullCorners,
      confidence: 'low',
    };
  }

  const padX = Math.round((maxX - minX) * 0.06);
  const padY = Math.round((maxY - minY) * 0.06);
  const sx = img.naturalWidth / width;
  const sy = img.naturalHeight / height;

  const crop = {
    x: Math.max(0, Math.round((minX - padX) * sx)),
    y: Math.max(0, Math.round((minY - padY) * sy)),
    width: Math.min(img.naturalWidth, Math.round((maxX - minX + padX * 2) * sx)),
    height: Math.min(img.naturalHeight, Math.round((maxY - minY + padY * 2) * sy)),
  };

  const sampleBand = Math.max(4, Math.round(Math.min(width, height) * 0.08));
  const xStep = Math.max(2, Math.round((maxX - minX) / 20));
  const yStep = Math.max(2, Math.round((maxY - minY) / 20));
  const isEdgePixel = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const L = lum(idx);
    const right = lum((y * width + Math.min(width - 1, x + 1)) * 4);
    const down = lum((Math.min(height - 1, y + 1) * width + x) * 4);
    const edge = Math.abs(L - right) + Math.abs(L - down);
    const borderDelta = Math.abs(L - borderMean);
    return edge > threshold || borderDelta > threshold * 0.9;
  };

  const topPoints: Point[] = [];
  const bottomPoints: Point[] = [];
  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];

  for (let x = minX; x <= maxX; x += xStep) {
    for (let y = Math.max(1, minY - sampleBand); y <= Math.min(height - 2, minY + sampleBand); y++) {
      if (isEdgePixel(x, y)) {
        topPoints.push({ x, y });
        break;
      }
    }
    for (let y = Math.min(height - 2, maxY + sampleBand); y >= Math.max(1, maxY - sampleBand); y--) {
      if (isEdgePixel(x, y)) {
        bottomPoints.push({ x, y });
        break;
      }
    }
  }

  for (let y = minY; y <= maxY; y += yStep) {
    for (let x = Math.max(1, minX - sampleBand); x <= Math.min(width - 2, minX + sampleBand); x++) {
      if (isEdgePixel(x, y)) {
        leftPoints.push({ x, y });
        break;
      }
    }
    for (let x = Math.min(width - 2, maxX + sampleBand); x >= Math.max(1, maxX - sampleBand); x--) {
      if (isEdgePixel(x, y)) {
        rightPoints.push({ x, y });
        break;
      }
    }
  }

  const topLine = fitHorizontalEdge(topPoints, minY, width);
  const bottomLine = fitHorizontalEdge(bottomPoints, maxY, width);
  const leftLine = fitVerticalEdge(leftPoints, minX, height);
  const rightLine = fitVerticalEdge(rightPoints, maxX, height);

  const rectCorners = buildRectCorners(crop);
  const corners = [
    intersectLines(topLine, leftLine) ?? rectCorners[0],
    intersectLines(topLine, rightLine) ?? rectCorners[1],
    intersectLines(bottomLine, rightLine) ?? rectCorners[2],
    intersectLines(bottomLine, leftLine) ?? rectCorners[3],
  ].map((point) => clampPoint(point, img.naturalWidth, img.naturalHeight)) as PerspectiveCorners;

  const areaCoverage = ((maxX - minX) * (maxY - minY)) / Math.max(1, width * height);
  const confidence =
    hits > (width * height) / 18 && areaCoverage > 0.2
      ? 'high'
      : hits > (width * height) / 35 && areaCoverage > 0.12
        ? 'medium'
        : 'low';

  return { crop, rotation: 0, corners, confidence };
}
