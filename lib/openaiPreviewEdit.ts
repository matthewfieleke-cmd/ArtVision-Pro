import sharp from 'sharp';
import { getCriterionMasterSignals } from '../shared/masterCriteriaRubric.js';
import type { PreviewEditRequestBody, PreviewEditResponseBody } from './previewEditTypes.js';
import {
  bufferToApiInputPng,
  getImageDimensions,
  pickImagesEditSize,
  resizeEditOutputToMatchUpload,
} from './previewImageResize.js';

type ImageStats = {
  contrast: number;
  edgeDensity: number;
  edgeBalance: number;
  valueSpread: number;
  textureScore: number;
  colorHarmony: number;
  saturationMean: number;
  saturationStd: number;
  focalOffset: number;
  centerFocus: number;
  borderActivity: number;
};

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  const mime = m[1]!.toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    throw new Error('Image must be PNG, JPEG, or WebP for editing');
  }
  return { mime, buffer: Buffer.from(m[2]!, 'base64') };
}

function outputMimeFromInput(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mime.includes('png')) return 'image/png';
  if (mime.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

const EDIT_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;
type EditQuality = (typeof EDIT_QUALITIES)[number];

function resolveEditQuality(): EditQuality {
  const raw = (process.env.OPENAI_IMAGE_EDIT_QUALITY ?? 'high').toLowerCase();
  return EDIT_QUALITIES.includes(raw as EditQuality) ? (raw as EditQuality) : 'high';
}

function resolveCandidateCount(): number {
  const raw = Number(process.env.OPENAI_IMAGE_EDIT_CANDIDATES ?? 3);
  if (!Number.isFinite(raw)) return 3;
  return Math.max(1, Math.min(4, Math.round(raw)));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function centeredScore(value: number, target: number, tolerance: number): number {
  return clamp01(1 - Math.abs(value - target) / tolerance);
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

async function computePreviewStats(buffer: Buffer, sampleSize = 256): Promise<ImageStats> {
  const raster = await sharp(buffer)
    .rotate()
    .resize(sampleSize, sampleSize, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const width = sampleSize;
  const height = sampleSize;
  const idx = (x: number, y: number) => (y * width + x) * 3;
  const lumas: number[] = [];
  const sats: number[] = [];
  let sumL = 0;
  for (let i = 0; i < raster.length; i += 3) {
    const r = raster[i]!;
    const g = raster[i + 1]!;
    const b = raster[i + 2]!;
    const L = luminance(r, g, b);
    lumas.push(L);
    sumL += L;
    sats.push(rgbToHsl(r, g, b).s);
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
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const right = idx(x + 1, y);
      const down = idx(x, y + 1);
      const Lc = luminance(raster[i]!, raster[i + 1]!, raster[i + 2]!);
      const Lr = luminance(raster[right]!, raster[right + 1]!, raster[right + 2]!);
      const Ld = luminance(raster[down]!, raster[down + 1]!, raster[down + 2]!);
      const gx = Math.abs(Lc - Lr);
      const gy = Math.abs(Lc - Ld);
      const mag = gx + gy;
      edgeSum += mag;
      if (mag > 28) edgeStrong += 1;
      const patch: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = idx(x + dx, y + dy);
          patch.push(luminance(raster[j]!, raster[j + 1]!, raster[j + 2]!));
        }
      }
      const pm = patch.reduce((a, b) => a + b, 0) / patch.length;
      localVarSum += patch.reduce((a, p) => a + (p - pm) ** 2, 0) / patch.length;
    }
  }
  const cells = (width - 2) * (height - 2);
  const edgeDensity = clamp01((edgeSum / cells) / 45);
  const edgeBalance = cells ? edgeStrong / cells : 0;

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
  let borderSum = 0;
  let borderCount = 0;
  const borderBand = Math.max(4, Math.round(sampleSize * 0.08));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const right = idx(x + 1, y);
      const down = idx(x, y + 1);
      const Lc = luminance(raster[i]!, raster[i + 1]!, raster[i + 2]!);
      const Lr = luminance(raster[right]!, raster[right + 1]!, raster[right + 2]!);
      const Ld = luminance(raster[down]!, raster[down + 1]!, raster[down + 2]!);
      const w = Math.abs(Lc - Lr) + Math.abs(Lc - Ld);
      wx += x * w;
      wy += y * w;
      wsum += w;
      if (
        x < borderBand ||
        y < borderBand ||
        x >= width - borderBand ||
        y >= height - borderBand
      ) {
        borderSum += w;
        borderCount += 1;
      }
    }
  }
  const cx = wsum ? wx / wsum : width / 2;
  const cy = wsum ? wy / wsum : height / 2;
  const dx = (cx - width / 2) / width;
  const dy = (cy - height / 2) / height;
  const focalOffset = clamp01(Math.sqrt(dx * dx + dy * dy) * 2);
  const centerFocus = clamp01(1 - Math.sqrt(dx * dx + dy * dy) * 1.4);
  const borderActivity = borderCount ? clamp01((borderSum / borderCount) / 45) : 0;

  return {
    contrast: clamp01(stdL / 70),
    edgeDensity,
    edgeBalance,
    valueSpread,
    textureScore: clamp01((localVarSum / cells) / 400),
    colorHarmony,
    saturationMean,
    saturationStd,
    focalOffset,
    centerFocus,
    borderActivity,
  };
}

function similarityScore(original: ImageStats, candidate: ImageStats): number {
  const diffs = [
    Math.abs(candidate.focalOffset - original.focalOffset),
    Math.abs(candidate.centerFocus - original.centerFocus),
    Math.abs(candidate.borderActivity - original.borderActivity),
    Math.abs(candidate.colorHarmony - original.colorHarmony),
    Math.abs(candidate.saturationMean - original.saturationMean),
    Math.abs(candidate.valueSpread - original.valueSpread),
  ];
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return clamp01(1 - avgDiff * 2.1);
}

function criterionGainScore(
  criterion: PreviewEditRequestBody['target']['criterion'],
  original: ImageStats,
  candidate: ImageStats
): number {
  switch (criterion) {
    case 'Intent and necessity':
      return clamp01(
        0.38 * (candidate.centerFocus - original.centerFocus) +
          0.22 * (candidate.valueSpread - original.valueSpread) +
          0.2 * (candidate.colorHarmony - original.colorHarmony) +
          0.2 * (centeredScore(candidate.focalOffset, 0.28, 0.28) - centeredScore(original.focalOffset, 0.28, 0.28)) +
          0.5
      );
    case 'Composition and shape structure':
      return clamp01(
        0.4 * (centeredScore(candidate.focalOffset, 0.3, 0.3) - centeredScore(original.focalOffset, 0.3, 0.3)) +
          0.35 * (candidate.centerFocus - original.centerFocus) +
          0.25 * (centeredScore(candidate.borderActivity, 0.14, 0.18) - centeredScore(original.borderActivity, 0.14, 0.18)) +
          0.5
      );
    case 'Value and light structure':
      return clamp01(
        0.45 * (candidate.valueSpread - original.valueSpread) +
          0.35 * (candidate.contrast - original.contrast) +
          0.2 * (centeredScore(candidate.edgeDensity, 0.22, 0.25) - centeredScore(original.edgeDensity, 0.22, 0.25)) +
          0.5
      );
    case 'Color relationships':
      return clamp01(
        0.45 * (candidate.colorHarmony - original.colorHarmony) +
          0.3 * (centeredScore(candidate.saturationStd, 0.12, 0.14) - centeredScore(original.saturationStd, 0.12, 0.14)) +
          0.25 * (centeredScore(candidate.saturationMean, 0.18, 0.16) - centeredScore(original.saturationMean, 0.18, 0.16)) +
          0.5
      );
    case 'Drawing, proportion, and spatial form':
      return clamp01(
        0.45 * (candidate.centerFocus - original.centerFocus) +
          0.3 * (centeredScore(candidate.borderActivity, 0.12, 0.18) - centeredScore(original.borderActivity, 0.12, 0.18)) +
          0.25 * (candidate.contrast - original.contrast) +
          0.5
      );
    case 'Edge and focus control':
      return clamp01(
        0.45 * (centeredScore(candidate.edgeBalance, 0.18, 0.2) - centeredScore(original.edgeBalance, 0.18, 0.2)) +
          0.3 * (centeredScore(candidate.edgeDensity, 0.28, 0.28) - centeredScore(original.edgeDensity, 0.28, 0.28)) +
          0.25 * (candidate.valueSpread - original.valueSpread) +
          0.5
      );
    case 'Surface and medium handling':
      return clamp01(
        0.5 * (candidate.textureScore - original.textureScore) +
          0.25 * (candidate.edgeDensity - original.edgeDensity) +
          0.25 * (centeredScore(candidate.edgeBalance, 0.2, 0.22) - centeredScore(original.edgeBalance, 0.2, 0.22)) +
          0.5
      );
    case 'Presence, point of view, and human force':
      return clamp01(
        0.34 * (candidate.textureScore - original.textureScore) +
          0.24 * (candidate.saturationStd - original.saturationStd) +
          0.18 * (candidate.focalOffset - original.focalOffset) +
          0.24 * (candidate.borderActivity - original.borderActivity) +
          0.5
      );
  }
}

function rankingScore(
  criterion: PreviewEditRequestBody['target']['criterion'],
  original: ImageStats,
  candidate: ImageStats
): number {
  const similarity = similarityScore(original, candidate);
  const criterionGain = criterionGainScore(criterion, original, candidate);
  return 0.58 * similarity + 0.42 * criterionGain;
}

function buildEditPrompt(body: PreviewEditRequestBody): string {
  const { style, medium, target } = body;
  const masterSignals = getCriterionMasterSignals(style, target.criterion)
    .slice(0, 4)
    .map((signal: string) => `- ${signal}`)
    .join('\n');
  return `You are a master painter doing a single careful revision pass on the artist's OWN work for teaching purposes.

Context: ${style}, medium ${medium}.

Focus ONLY on: "${target.criterion}" (rated ${target.level}).

What to address (from their mentor critique):
${target.feedback}

Show this improvement via paint (not caption): ${target.actionPlan}

Master-level signals to honor for this exact criterion in ${style}:
${masterSignals || '- Use the strongest available style-consistent master signals for this criterion.'}

Rules — quality and fidelity:
- Preserve identity: same subject, pose, composition, crop, and viewing angle. Do not invent new objects, figures, or a new scene.
- Preserve the hand of the artist: match existing brush scale, stroke direction, and surface texture (${medium}); edits should look like the same person repainted that passage with more skill, not a different artist or a digital repaint.
- Improvement should feel like a master critique pass inside the artist's existing voice, not a style transfer into another painter's finished work.
- Apply the change mainly where the critique implies (edges, values, color temperature, drawing, etc.)—subtle elsewhere.
- Edge-to-edge: fill the full frame; no inset, no frame-within-frame, no added borders or captions.
- Lighting: keep the same light direction and color of light unless the critique explicitly calls for adjusting light logic for "${target.criterion}".
- Photo artifacts: reduce mild glare or color cast only if needed so the revision reads clearly; do not turn the image into a different photograph.

Output: one photorealistic image of the same artwork after this single focused improvement—museum documentation quality, crisp but natural surface detail, faithful geometry, and revised passages that integrate seamlessly with the untouched paint.`;
}

/**
 * OpenAI Images API — edit with reference image.
 * Uses JSON + `images: [{ image_url }]` (current GPT image models). Legacy multipart `image`/`image[]`
 * differs from this shape and can yield validation errors like "The string did not match the expected pattern."
 *
 * Default model `gpt-image-1`; override with OPENAI_IMAGE_EDIT_MODEL.
 */
export async function runOpenAIPreviewEdit(
  apiKey: string,
  body: PreviewEditRequestBody
): Promise<PreviewEditResponseBody> {
  const model = process.env.OPENAI_IMAGE_EDIT_MODEL ?? 'gpt-image-1';
  const { mime: inputMime, buffer: inputBuffer } = parseDataUrl(body.imageDataUrl.trim());
  const { width: origW, height: origH } = await getImageDimensions(inputBuffer);
  const editSize = pickImagesEditSize(origW, origH);
  const { buffer: apiInputPng, geometry } = await bufferToApiInputPng(inputBuffer, editSize);
  const imageUrl = `data:image/png;base64,${apiInputPng.toString('base64')}`;
  const quality = resolveEditQuality();
  const candidateCount = resolveCandidateCount();
  const originalStats = await computePreviewStats(inputBuffer);

  const payload = {
    model,
    prompt: buildEditPrompt(body),
    images: [{ image_url: imageUrl }],
    size: editSize,
    quality,
    n: candidateCount,
    input_fidelity: 'high' as const,
  };

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI image edit failed (${res.status})`);
  }

  const preferOut = outputMimeFromInput(inputMime);
  const data = json.data as Array<{ b64_json?: string; url?: string }> | undefined;
  if (!data?.length) throw new Error('No image in edit response');

  let bestCandidate:
    | {
        imageDataUrl: string;
        score: number;
      }
    | undefined;

  for (const item of data) {
    let editedBuffer: Buffer;
    if (item.b64_json) {
      editedBuffer = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new Error('Failed to fetch edited image URL');
      editedBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      continue;
    }

    const { buffer: outBuf, mime: outMime } = await resizeEditOutputToMatchUpload(
      editedBuffer,
      origW,
      origH,
      preferOut,
      geometry
    );
    const candidateStats = await computePreviewStats(outBuf);
    const score = rankingScore(body.target.criterion, originalStats, candidateStats);
    const imageDataUrl = `data:${outMime};base64,${outBuf.toString('base64')}`;
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { imageDataUrl, score };
    }
  }

  if (!bestCandidate) throw new Error('Edit response missing image data');

  return {
    imageDataUrl: bestCandidate.imageDataUrl,
    criterion: body.target.criterion,
  };
}
