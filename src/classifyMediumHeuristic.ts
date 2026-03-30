import type { ImageMetrics } from './imageMetrics';
import { clamp01 } from './imageMetrics';
import { MEDIUMS, type Medium } from './types';

/**
 * Rough medium guess from image statistics (fallback when vision API is unavailable
 * or does not return a medium read).
 */
export function classifyMediumFromMetrics(m: ImageMetrics): { medium: Medium; rationale: string } {
  const softEdges = clamp01(1 - m.edgeBalance * 1.2);
  const colorRich = clamp01(m.saturationMean * 1.4 + m.saturationStd * 1.1);
  const markActivity = m.textureScore;
  const graphicRead = clamp01(m.edgeDensity * 0.95 + m.contrast * 0.25);
  const washed = clamp01(m.valueSpread * 0.7 + softEdges * 0.3);

  const scores: Record<Medium, number> = {
    Drawing:
      0.38 * graphicRead +
      0.28 * clamp01(1 - colorRich) +
      0.18 * clamp01(1 - markActivity * 0.8) +
      0.16 * m.contrast,
    Watercolor:
      0.34 * washed +
      0.28 * clamp01(1 - markActivity * 0.6) +
      0.22 * m.valueSpread +
      0.16 * softEdges,
    Pastel:
      0.32 * markActivity +
      0.26 * softEdges +
      0.22 * colorRich +
      0.2 * clamp01(m.textureScore * 1.1),
    'Oil on Canvas':
      0.3 * markActivity +
      0.26 * colorRich +
      0.22 * m.contrast +
      0.22 * m.valueSpread,
    Acrylic:
      0.32 * markActivity +
      0.28 * colorRich +
      0.22 * m.contrast +
      0.18 * m.saturationStd,
  };

  let best: Medium = MEDIUMS[0];
  let bestScore = -1;
  for (const med of MEDIUMS) {
    if (scores[med] > bestScore) {
      bestScore = scores[med];
      best = med;
    }
  }

  const rationale =
    best === 'Drawing'
      ? 'Strong linear structure and relatively restrained color saturation suggest a drawing-like read.'
      : best === 'Watercolor'
        ? 'Soft edge balance and wash-forward value behavior suggest watercolor.'
        : best === 'Pastel'
          ? 'Grainy, stroke-forward texture with soft color blending suggests pastel.'
          : best === 'Oil on Canvas'
            ? 'Richer value range and heavier surface activity suggest oil on canvas.'
            : 'Bright, even color with active handling reads closest to acrylic among the options.';

  return { medium: best, rationale };
}
