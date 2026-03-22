import type { ImageMetrics } from './imageMetrics';
import { clamp01 } from './imageMetrics';
import type { Style } from './types';
import { STYLES } from './types';

/**
 * Rough style guess from image statistics (fallback when the vision API is unavailable).
 * Tuned to the user-provided style characteristics.
 */
export function classifyStyleFromMetrics(m: ImageMetrics): { style: Style; rationale: string } {
  const softEdges = clamp01(1 - m.edgeBalance * 1.2);
  const colorIntensity = clamp01(m.saturationStd * 2.2 + m.saturationMean * 0.4);
  const markActivity = m.textureScore;
  const structuralRead = clamp01(m.edgeDensity * 0.9 + m.valueSpread * 0.35);
  const calmColor = clamp01(1 - m.saturationStd * 1.8);

  const scores: Record<Style, number> = {
    Realism:
      0.28 * structuralRead +
      0.24 * calmColor +
      0.22 * clamp01(1 - markActivity * 0.9) +
      0.16 * m.contrast +
      0.1 * clamp01(1 - softEdges * 0.5),
    Impressionism:
      0.32 * markActivity +
      0.28 * softEdges +
      0.22 * m.valueSpread +
      0.12 * clamp01(m.saturationStd * 1.4) +
      0.06 * m.colorHarmony,
    Expressionism:
      0.34 * colorIntensity +
      0.26 * markActivity +
      0.22 * m.contrast +
      0.18 * clamp01(m.saturationStd * 2),
    'Abstract Art':
      0.3 * colorIntensity +
      0.24 * markActivity +
      0.2 * m.edgeDensity +
      0.14 * clamp01(1 - structuralRead * 0.4) +
      0.12 * clamp01(Math.abs(m.focalOffset - 0.35)),
  };

  let best: Style = STYLES[0];
  let bestScore = -1;
  for (const s of STYLES) {
    if (scores[s] > bestScore) {
      bestScore = scores[s];
      best = s;
    }
  }

  const rationale =
    best === 'Realism'
      ? 'Structured values, calmer color relationships, and a clearer edge read suggest a realist lean.'
      : best === 'Impressionism'
        ? 'Active surface variation, softer edge balance, and light-driven value shifts suggest impressionism.'
        : best === 'Expressionism'
          ? 'Strong color contrast and energetic handling suggest expressionist priorities.'
          : 'Non-literal emphasis on color, texture, and design reads closest to abstract modes.';

  return { style: best, rationale };
}
