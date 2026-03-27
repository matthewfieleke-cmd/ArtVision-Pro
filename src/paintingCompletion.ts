import type {
  CompletionRead,
  CritiqueConfidence,
  PhotoQualityAssessment,
  WorkCompletionState,
} from './types';
import type { ImageMetrics } from './imageMetrics';

function capConfidence(c: CritiqueConfidence, max: CritiqueConfidence): CritiqueConfidence {
  const order: CritiqueConfidence[] = ['low', 'medium', 'high'];
  return order[Math.min(order.indexOf(c), order.indexOf(max))] ?? 'low';
}

/**
 * Heuristic read of whether a capture looks like a study in progress vs a more resolved piece.
 * Vision API critiques use model-derived completionRead instead when available.
 */
export function deriveLocalCompletionRead(
  metrics: ImageMetrics,
  avgCategoryScore: number,
  photoQuality: PhotoQualityAssessment
): CompletionRead {
  const cues: string[] = [];
  let state: WorkCompletionState = 'uncertain';
  let confidence: CritiqueConfidence = 'medium';

  if (photoQuality.level === 'poor') {
    cues.push('Photo quality limits how reliably finish can be judged.');
    confidence = 'low';
  }

  if (metrics.textureScore > 0.2) {
    cues.push('Surface shows strong local variation, like active reworking or open passages.');
  }
  if (metrics.edgeBalance > 0.34) {
    cues.push('Many small hard edges are spread across the image.');
  }
  if (metrics.borderActivity > 0.3) {
    cues.push('The outer band of the image stays visually busy.');
  }
  if (avgCategoryScore < 0.45) {
    cues.push('Structural reads from this capture skew early-stage overall.');
  }
  if (avgCategoryScore >= 0.68 && metrics.textureScore < 0.18 && metrics.borderActivity < 0.28) {
    cues.push('Broad areas read more consistently resolved in this capture.');
  }

  const rough =
    avgCategoryScore < 0.42 ||
    (metrics.textureScore > 0.22 && metrics.edgeBalance > 0.33) ||
    (metrics.borderActivity > 0.32 && avgCategoryScore < 0.55);

  const polished =
    avgCategoryScore >= 0.62 &&
    metrics.textureScore < 0.2 &&
    metrics.borderActivity < 0.3 &&
    !(metrics.edgeBalance > 0.38 && avgCategoryScore < 0.72);

  if (rough && !polished) {
    state = 'unfinished';
    confidence = photoQuality.level === 'poor' ? 'low' : avgCategoryScore < 0.35 ? 'high' : 'medium';
  } else if (polished && !rough) {
    state = 'likely_finished';
    confidence = photoQuality.level === 'good' && avgCategoryScore >= 0.7 ? 'high' : 'medium';
  } else {
    state = 'uncertain';
    confidence = capConfidence(confidence, photoQuality.level === 'poor' ? 'low' : 'medium');
  }

  const rationale =
    state === 'unfinished'
      ? 'From this photo, the image still reads like a work in progress: structure and surface suggest ongoing passes rather than a fully resolved presentation.'
      : state === 'likely_finished'
        ? 'From this capture, the piece reads closer to presentation-ready: broader resolution and calmer edge and border activity relative to the structural read.'
        : 'Finish is ambiguous from pixels alone—treat pacing and “done-ness” as your call while using the criterion notes below.';

  return {
    state,
    confidence,
    cues: cues.length ? cues.slice(0, 4) : ['Not enough strong cues from this capture; completion is treated as uncertain.'],
    rationale,
  };
}
