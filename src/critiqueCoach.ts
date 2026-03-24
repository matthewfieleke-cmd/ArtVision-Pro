import type {
  CritiqueCategory,
  CritiqueConfidence,
  CritiqueResult,
  Criterion,
  Medium,
  PhotoQualityAssessment,
  RatingLevel,
  Style,
} from './types';
import type { ImageMetrics } from './imageMetrics';

const LEVEL_ORDER: RatingLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Master'];
const CONFIDENCE_ORDER: CritiqueConfidence[] = ['low', 'medium', 'high'];

function capConfidence(
  confidence: CritiqueConfidence,
  maxConfidence: CritiqueConfidence
): CritiqueConfidence {
  const idx = Math.min(
    CONFIDENCE_ORDER.indexOf(confidence),
    CONFIDENCE_ORDER.indexOf(maxConfidence)
  );
  return CONFIDENCE_ORDER[Math.max(0, idx)] ?? 'low';
}

export function levelWidth(level: RatingLevel): string {
  const pct = ((LEVEL_ORDER.indexOf(level) + 1) / LEVEL_ORDER.length) * 100;
  return `${Math.max(25, pct)}%`;
}

export function nextRatingLevel(level: RatingLevel): RatingLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1]! : null;
}

export function defaultNextTarget(criterion: Criterion, level: RatingLevel): string {
  const next = nextRatingLevel(level);
  if (!next) {
    return `Sustain ${criterion.toLowerCase()} while taking one measured risk.`;
  }
  return `Push ${criterion.toLowerCase()} toward ${next}.`;
}

export function confidenceLabel(confidence: CritiqueConfidence): string {
  switch (confidence) {
    case 'high':
      return 'strong read';
    case 'medium':
      return 'usable read';
    default:
      return 'provisional';
  }
}

export function deriveOverallConfidence(
  categories: CritiqueCategory[],
  photoQuality?: PhotoQualityAssessment,
  analysisSource?: 'api' | 'local'
): CritiqueConfidence {
  const numeric: number[] = categories.map((cat) => {
    switch (cat.confidence) {
      case 'high':
        return 2;
      case 'medium':
        return 1;
      default:
        return 0;
    }
  });
  const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 1;
  let confidence: CritiqueConfidence = avg >= 1.55 ? 'high' : avg >= 0.8 ? 'medium' : 'low';

  if (photoQuality?.level === 'fair') confidence = capConfidence(confidence, 'medium');
  if (photoQuality?.level === 'poor') confidence = 'low';
  if (analysisSource === 'local') confidence = capConfidence(confidence, 'medium');
  return confidence;
}

export function finalizeCritiqueResult(
  critique: CritiqueResult,
  options?: {
    analysisSource?: 'api' | 'local';
    photoQuality?: PhotoQualityAssessment;
  }
): CritiqueResult {
  const categories = critique.categories.map((cat) => ({
    ...cat,
    nextTarget: cat.nextTarget ?? defaultNextTarget(cat.criterion, cat.level),
  }));
  const analysisSource = options?.analysisSource ?? critique.analysisSource;
  const photoQuality = options?.photoQuality ?? critique.photoQuality;
  return {
    ...critique,
    categories,
    ...(analysisSource ? { analysisSource } : {}),
    ...(photoQuality ? { photoQuality } : {}),
    overallConfidence:
      critique.overallConfidence ??
      deriveOverallConfidence(categories, photoQuality, analysisSource),
  };
}

export function deriveLocalCategoryConfidence(
  criterion: Criterion,
  metrics: ImageMetrics
): CritiqueConfidence {
  switch (criterion) {
    case 'Composition':
    case 'Value structure':
    case 'Edge control':
      return metrics.contrast > 0.18 && metrics.edgeDensity > 0.14 ? 'high' : 'medium';
    case 'Color relationships':
      return metrics.saturationMean > 0.06 ? 'medium' : 'low';
    case 'Unity and variety':
      return metrics.contrast > 0.12 ? 'medium' : 'low';
    case 'Brushwork / handling':
      return metrics.textureScore > 0.09 ? 'medium' : 'low';
    case 'Drawing and proportion':
    case 'Originality / expressive force':
      return 'low';
    default:
      return 'medium';
  }
}

function describeFocalOffset(focalOffset: number): string {
  if (focalOffset < 0.22) return 'the focal pull stays close to center';
  if (focalOffset < 0.5) return 'the focal pull sits slightly off-center';
  return 'the strongest pull drifts far from center';
}

function describeEdgeDensity(edgeDensity: number): string {
  if (edgeDensity < 0.14) return 'edge activity is fairly soft';
  if (edgeDensity < 0.34) return 'edge activity is controlled';
  return 'edge activity is busy';
}

function describeValueSpread(valueSpread: number): string {
  if (valueSpread < 0.16) return 'light and dark masses read close together';
  if (valueSpread < 0.34) return 'there is a usable value separation';
  return 'light and dark masses separate clearly';
}

export function deriveLocalEvidenceSignals(
  criterion: Criterion,
  metrics: ImageMetrics
): string[] {
  switch (criterion) {
    case 'Composition':
      return [
        describeFocalOffset(metrics.focalOffset),
        describeEdgeDensity(metrics.edgeDensity),
        metrics.edgeBalance < 0.24
          ? 'hard accents are not scattered everywhere'
          : 'many similar accents compete at once',
      ];
    case 'Value structure':
      return [
        describeValueSpread(metrics.valueSpread),
        metrics.contrast < 0.18 ? 'contrast stays compressed' : 'contrast gives the image a readable hierarchy',
        metrics.saturationStd < 0.14
          ? 'color variation is restrained enough to support value reads'
          : 'color shifts may be distracting from the value pattern',
      ];
    case 'Color relationships':
      return [
        metrics.colorHarmony > 0.62
          ? 'the palette stays in one color family'
          : 'color families feel varied and harder to unify',
        metrics.saturationMean > 0.18
          ? 'there is enough chroma to create color accents'
          : 'the palette reads muted overall',
        metrics.saturationStd < 0.16
          ? 'saturation changes are fairly controlled'
          : 'saturation jumps between areas',
      ];
    case 'Drawing and proportion':
      return [
        metrics.edgeDensity > 0.2
          ? 'major contours are visible enough to judge big shape placement'
          : 'major contours stay soft and harder to compare',
        metrics.textureScore < 0.12
          ? 'surface noise is low enough to read shape relationships'
          : 'surface activity makes structural reads less certain',
        metrics.contrast > 0.18
          ? 'value breaks help reveal planes'
          : 'low contrast makes proportional reads less reliable',
      ];
    case 'Edge control':
      return [
        describeEdgeDensity(metrics.edgeDensity),
        metrics.edgeBalance < 0.2
          ? 'sharp edges are concentrated in a few places'
          : metrics.edgeBalance < 0.32
            ? 'sharp edges are moderately spread'
            : 'sharp edges appear in many areas',
        describeValueSpread(metrics.valueSpread),
      ];
    case 'Brushwork / handling':
      return [
        metrics.textureScore > 0.18
          ? 'surface variation is active'
          : 'surface variation reads subdued',
        metrics.edgeDensity > 0.22
          ? 'marks create visible directional breaks'
          : 'marks merge into broad shapes',
        metrics.contrast > 0.18
          ? 'light-dark changes help separate mark families'
          : 'mark families are closer in value',
      ];
    case 'Unity and variety':
      return [
        metrics.colorHarmony > 0.62
          ? 'color families hold together well'
          : 'the palette splits into several competing families',
        metrics.saturationStd < 0.14
          ? 'accent intensity is fairly disciplined'
          : 'accent intensity changes quickly across the image',
        metrics.contrast > 0.18
          ? 'contrast gives the painting some variety'
          : 'contrast stays compressed and risks monotony',
      ];
    case 'Originality / expressive force':
      return [
        metrics.textureScore > 0.16
          ? 'surface energy is visibly active'
          : 'surface energy reads comparatively restrained',
        metrics.saturationStd > 0.14
          ? 'color variation adds some expressive pressure'
          : 'color variation stays controlled and quieter',
        describeFocalOffset(metrics.focalOffset),
      ];
    default:
      return [];
  }
}

export function deriveLocalPreserveText(
  criterion: Criterion,
  level: RatingLevel,
  metrics: ImageMetrics
): string {
  switch (criterion) {
    case 'Composition':
      return level === 'Beginner'
        ? 'Keep the clearest anchor you already have; one stable focal area is enough to build the rest around.'
        : 'Protect the existing focal pull while you simplify secondary movement.';
    case 'Value structure':
      return metrics.valueSpread > 0.22
        ? 'Preserve the biggest light-dark separation already working in the painting.'
        : 'Preserve whichever passage still reads when you squint; that is your current value anchor.';
    case 'Color relationships':
      return metrics.colorHarmony > 0.6
        ? 'Hold on to the overall color family even as you sharpen accents.'
        : 'Keep the most convincing warm-cool relationship already present and build outward from it.';
    case 'Drawing and proportion':
      return 'Preserve the strongest silhouette or alignment you already trust; use it as the measuring key for weaker passages.';
    case 'Edge control':
      return 'Keep one edge area clearly dominant so the painting still knows where to focus.';
    case 'Brushwork / handling':
      return metrics.textureScore > 0.14
        ? 'Protect the passages where the marks already feel committed and economical.'
        : 'Preserve your broadest, least-fussy shapes while you rework louder passages.';
    case 'Unity and variety':
      return 'Preserve the repeating motif that already ties distant areas together.';
    case 'Originality / expressive force':
      return 'Preserve the clearest mood cue already in the piece before you add more complexity.';
    default:
      return 'Preserve the clearest strength already visible in the piece.';
  }
}

export function deriveLocalPracticeExercise(
  criterion: Criterion,
  style: Style,
  medium: Medium
): string {
  switch (criterion) {
    case 'Composition':
      return `Do six 2-minute thumbnails in ${style}, changing only the focal placement and big value masses before touching detail.`;
    case 'Value structure':
      return `Make a 3-value study in ${medium.toLowerCase()} from the same reference: light, mid, dark only.`;
    case 'Color relationships':
      return `Paint a limited-palette study with one warm and one cool bias per major area before mixing tertiary accents.`;
    case 'Drawing and proportion':
      return 'Spend one session on envelope/block-in only: compare angles, halves, and plumb lines before rendering.';
    case 'Edge control':
      return 'Do a small edge map study, labeling each major contour hard, soft, or lost before repainting the passage.';
    case 'Brushwork / handling':
      return `Make one small study with only 3-4 mark types in ${medium.toLowerCase()} so every stroke family has a job.`;
    case 'Unity and variety':
      return 'Choose one motif to repeat three times at different scales, then add only one contrasting accent family.';
    case 'Originality / expressive force':
      return `Make two quick variants of this piece with opposite emotional intents, then note which visual decisions actually changed.`;
    default:
      return 'Do one short focused study on the weakest visible sub-skill before the next full repaint.';
  }
}
