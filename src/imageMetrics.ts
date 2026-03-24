/** Normalized 0–1 stats from a downsampled painting image (browser canvas). */

export type ImageMetrics = {
  contrast: number;
  edgeBalance: number;
  edgeDensity: number;
  colorHarmony: number;
  saturationMean: number;
  saturationStd: number;
  focalOffset: number;
  valueSpread: number;
  textureScore: number;
  highlightClip: number;
  shadowClip: number;
  borderActivity: number;
  centerFocus: number;
};

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h, s, l };
}

export async function computeImageMetrics(dataUrl: string, sampleSize = 256): Promise<ImageMetrics> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Image load failed'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2d context');
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const { data, width, height } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  const lumas: number[] = [];
  const sats: number[] = [];
  let sumL = 0;
  let highlightClipCount = 0;
  let shadowClipCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const L = luminance(r, g, b);
    lumas.push(L);
    sumL += L;
    if (L >= 245) highlightClipCount += 1;
    if (L <= 12) shadowClipCount += 1;
    const { s } = rgbToHsl(r, g, b);
    sats.push(s);
  }
  const n = lumas.length;
  const meanL = sumL / n;
  let varL = 0;
  for (const L of lumas) varL += (L - meanL) ** 2;
  const stdL = Math.sqrt(varL / n);
  const valueSpread = clamp01(stdL / 80);

  let edgeSum = 0;
  let edgeStrong = 0;
  let localVarSum = 0;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const Lc = luminance(data[i], data[i + 1], data[i + 2]);
      const Lr = luminance(data[i + 4], data[i + 5], data[i + 6]);
      const Ld = luminance(
        data[idx(x, y + 1)],
        data[idx(x, y + 1) + 1],
        data[idx(x, y + 1) + 2]
      );
      const gx = Math.abs(Lc - Lr);
      const gy = Math.abs(Lc - Ld);
      const mag = gx + gy;
      edgeSum += mag;
      if (mag > 28) edgeStrong += 1;
      const patch: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = idx(x + dx, y + dy);
          patch.push(luminance(data[j], data[j + 1], data[j + 2]));
        }
      }
      const pm = patch.reduce((a, b) => a + b, 0) / patch.length;
      localVarSum += patch.reduce((a, p) => a + (p - pm) ** 2, 0) / patch.length;
    }
  }
  const cells = (width - 2) * (height - 2);
  const edgeDensity = clamp01((edgeSum / cells) / 45);
  const edgeBalance = cells ? edgeStrong / cells : 0;
  const highlightClip = n ? highlightClipCount / n : 0;
  const shadowClip = n ? shadowClipCount / n : 0;

  const meanS = sats.reduce((a, b) => a + b, 0) / sats.length;
  let varS = 0;
  for (const s of sats) varS += (s - meanS) ** 2;
  const stdS = Math.sqrt(varS / sats.length);
  const colorHarmony = clamp01(1 - Math.min(1, stdS * 1.8));
  const saturationMean = meanS;
  const saturationStd = stdS;

  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const Lc = luminance(data[i], data[i + 1], data[i + 2]);
      const Lr = luminance(data[i + 4], data[i + 5], data[i + 6]);
      const Ld = luminance(
        data[idx(x, y + 1)],
        data[idx(x, y + 1) + 1],
        data[idx(x, y + 1) + 2]
      );
      const w = Math.abs(Lc - Lr) + Math.abs(Lc - Ld);
      wx += x * w;
      wy += y * w;
      wsum += w;
    }
  }
  const cx = wsum ? wx / wsum : width / 2;
  const cy = wsum ? wy / wsum : height / 2;
  const dx = (cx - width / 2) / width;
  const dy = (cy - height / 2) / height;
  const focalOffset = clamp01(Math.sqrt(dx * dx + dy * dy) * 2);
  const centerFocus = clamp01(1 - Math.sqrt(dx * dx + dy * dy) * 1.4);

  let borderSum = 0;
  let borderCount = 0;
  const borderBand = Math.max(4, Math.round(sampleSize * 0.08));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (
        x < borderBand ||
        y < borderBand ||
        x >= width - borderBand ||
        y >= height - borderBand
      ) {
        const i = idx(x, y);
        const Lc = luminance(data[i], data[i + 1], data[i + 2]);
        const Lr = luminance(data[i + 4], data[i + 5], data[i + 6]);
        const Ld = luminance(
          data[idx(x, y + 1)],
          data[idx(x, y + 1) + 1],
          data[idx(x, y + 1) + 2]
        );
        borderSum += Math.abs(Lc - Lr) + Math.abs(Lc - Ld);
        borderCount += 1;
      }
    }
  }
  const borderActivity = borderCount ? clamp01((borderSum / borderCount) / 45) : 0;

  const textureScore = clamp01((localVarSum / cells) / 400);
  const contrast = clamp01(stdL / 70);

  return {
    contrast,
    edgeBalance,
    edgeDensity,
    colorHarmony,
    saturationMean,
    saturationStd,
    focalOffset,
    valueSpread,
    textureScore,
    highlightClip,
    shadowClip,
    borderActivity,
    centerFocus,
  };
}
