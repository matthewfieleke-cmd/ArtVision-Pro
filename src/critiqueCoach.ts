import {
  canonicalCriterionLabel,
  criterionLabelMatches,
  CRITERIA_ORDER,
} from '../shared/criteria';
import type {
  CritiqueCategory,
  CritiqueConfidence,
  CritiqueResult,
  CritiqueSimpleFeedback,
  Criterion,
  Medium,
  OverallSummaryCard,
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
  const label = criterion.toLowerCase();
  if (!next) {
    return `Sustain ${label} while taking one measured risk.`;
  }
  return `Push ${label} toward ${next}.`;
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

function fallbackSimpleRead(categories: CritiqueCategory[]): CritiqueSimpleFeedback {
  const levelRank = (level?: RatingLevel): number =>
    level ? LEVEL_ORDER.indexOf(level) : LEVEL_ORDER.indexOf('Intermediate');
  const sorted = [...categories].sort((a, b) => levelRank(a.level) - levelRank(b.level));
  const mainIssue = sorted[0] ?? categories[0];
  const strongest = [...categories].sort((a, b) => levelRank(b.level) - levelRank(a.level));
  const keep = strongest[0] ?? categories[0];
  const planPairs = sorted
    .map((cat) => ({ cat, plan: cat.actionPlan?.trim() }))
    .filter((x): x is { cat: CritiqueCategory; plan: string } => Boolean(x.plan && x.plan.length > 0))
    .slice(0, 5);
  const strengthCats = strongest
    .filter((cat) => levelRank(cat.level) >= LEVEL_ORDER.indexOf('Advanced'))
    .slice(0, 2);
  const whatWorksParts: string[] = [];
  if (strengthCats.length) {
    for (const cat of strengthCats) {
      const p = cat.preserve?.trim();
      if (p) whatWorksParts.push(`${cat.criterion}: ${p}`);
    }
  }
  const whatWorks =
    whatWorksParts.length > 0
      ? whatWorksParts.join(' ')
      : keep?.preserve?.trim() ||
        'The capture already suggests at least one passage worth building around while you address weaker structure elsewhere.';

  const whatCouldImprove =
    mainIssue?.feedback?.trim() ||
    'One structural area still lags the rest; use the detailed categories below to prioritize before smaller fixes.';

  const studioChanges: CritiqueSimpleFeedback['studioChanges'] = planPairs.map(({ cat, plan }) => ({
    text: plan,
    previewCriterion: cat.criterion,
  }));
  while (studioChanges.length < 2) {
    const cat = sorted[studioChanges.length] ?? mainIssue;
    studioChanges.push({
      text:
        'Choose the weakest visible passage, simplify its value groups, then rebuild it against the strongest silhouette already working in the piece.',
      previewCriterion: cat!.criterion,
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

/** Migrate saved critiques that used readOfWork / nextSteps into studioAnalysis + studioChanges. */
export function migrateCritiqueSimpleFeedback(
  simple: CritiqueSimpleFeedback | (Record<string, unknown> & Partial<CritiqueSimpleFeedback>)
): CritiqueSimpleFeedback | undefined {
  if (!simple || typeof simple !== 'object') return undefined;
  const s = simple as Record<string, unknown>;
  if (
    s.studioAnalysis &&
    typeof s.studioAnalysis === 'object' &&
    Array.isArray(s.studioChanges)
  ) {
    const sa = s.studioAnalysis as { whatWorks?: string; whatCouldImprove?: string };
    const changes = (s.studioChanges as CritiqueSimpleFeedback['studioChanges']).map((ch) => ({
      text: ch.text,
      previewCriterion: canonicalCriterionLabel(ch.previewCriterion) ?? ch.previewCriterion,
    }));
    return {
      studioAnalysis: {
        whatWorks: typeof sa.whatWorks === 'string' ? sa.whatWorks : '',
        whatCouldImprove: typeof sa.whatCouldImprove === 'string' ? sa.whatCouldImprove : '',
      },
      studioChanges: changes,
    };
  }
  const readOfWork = typeof s.readOfWork === 'string' ? s.readOfWork : '';
  const working = Array.isArray(s.working) ? (s.working as string[]).filter((x) => typeof x === 'string') : [];
  const mainIssue = typeof s.mainIssue === 'string' ? s.mainIssue : '';
  const nextSteps = Array.isArray(s.nextSteps) ? (s.nextSteps as string[]).filter((x) => typeof x === 'string') : [];
  const preserve = typeof s.preserve === 'string' ? s.preserve : '';

  const whatWorks =
    working.length > 0
      ? [readOfWork, ...working.map((w) => w.trim())].filter(Boolean).join(' ')
      : readOfWork || 'Strengths are summarized in the detailed categories below.';

  const whatCouldImprove =
    mainIssue.trim() ||
    'Areas to develop are detailed in the criterion breakdown below.';

  const studioChanges: CritiqueSimpleFeedback['studioChanges'] = [];
  for (let i = 0; i < nextSteps.length && studioChanges.length < 5; i++) {
    const text = nextSteps[i]!.trim();
    if (text.length < 4) continue;
    studioChanges.push({
      text,
      previewCriterion: CRITERIA_ORDER[Math.min(i, CRITERIA_ORDER.length - 1)]!,
    });
  }
  while (studioChanges.length < 2) {
    studioChanges.push({
      text:
        preserve.trim().length > 0
          ? `Protect the strongest passage while refining one adjacent area: ${preserve.slice(0, 100)}${preserve.length > 100 ? '…' : ''}`
          : 'Choose one weak passage and restate it with simpler value groups before adding detail.',
      previewCriterion: CRITERIA_ORDER[studioChanges.length % CRITERIA_ORDER.length]!,
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

function deriveOverallSummaryFromSimple(simple: CritiqueSimpleFeedback): OverallSummaryCard {
  const analysis = [simple.studioAnalysis.whatWorks, simple.studioAnalysis.whatCouldImprove]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
  return {
    analysis: analysis.length > 0 ? analysis : 'See the criterion cards below for detailed feedback.',
    topPriorities: simple.studioChanges.map((ch) => ch.text.trim()).filter(Boolean),
  };
}

export function finalizeCritiqueResult(
  critique: CritiqueResult,
  options?: {
    analysisSource?: 'api' | 'local';
    photoQuality?: PhotoQualityAssessment;
  }
): CritiqueResult {
  const analysisSource = options?.analysisSource ?? critique.analysisSource;
  const categories = critique.categories.map((cat) => ({
    ...cat,
    criterion:
      typeof cat.criterion === 'string'
        ? canonicalCriterionLabel(cat.criterion) ?? (cat.criterion as Criterion)
        : cat.criterion,
    nextTarget:
      cat.nextTarget ??
      (cat.level
        ? defaultNextTarget(
            typeof cat.criterion === 'string'
              ? canonicalCriterionLabel(cat.criterion) ?? (cat.criterion as Criterion)
              : cat.criterion,
            cat.level
          )
        : undefined),
    ...(analysisSource === 'local'
      ? {
          /** Hide Beginner–Master in UI for heuristic pass; keep sub-skills for snapshot. */
          level: undefined,
        }
      : {}),
  }));
  const photoQuality = options?.photoQuality ?? critique.photoQuality;
  const simple =
    (critique.simple ? migrateCritiqueSimpleFeedback(critique.simple) : undefined) ??
    fallbackSimpleRead(categories);
  const overallSummary =
    critique.overallSummary ?? deriveOverallSummaryFromSimple(simple);
  return {
    ...critique,
    categories,
    simple,
    overallSummary,
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
  const capturePenalty =
    (metrics.highlightClip > 0.04 ? 1 : 0) +
    (metrics.shadowClip > 0.04 ? 1 : 0) +
    (metrics.borderActivity > 0.28 ? 1 : 0) +
    (metrics.centerFocus < 0.42 ? 1 : 0);

  const downgrade = (confidence: CritiqueConfidence): CritiqueConfidence => {
    if (capturePenalty <= 0) return confidence;
    if (capturePenalty >= 2) {
      return confidence === 'high' ? 'low' : 'low';
    }
    return confidence === 'high' ? 'medium' : confidence;
  };

  if (
    criterionLabelMatches(criterion, 'Composition and shape structure') ||
    criterionLabelMatches(criterion, 'Value and light structure') ||
    criterionLabelMatches(criterion, 'Edge and focus control')
  ) {
    return downgrade(metrics.contrast > 0.18 && metrics.edgeDensity > 0.14 ? 'high' : 'medium');
  }
  if (criterionLabelMatches(criterion, 'Color relationships')) {
    return downgrade(
      metrics.saturationMean > 0.06 &&
        metrics.highlightClip < 0.05 &&
        metrics.shadowClip < 0.05
        ? 'medium'
        : 'low'
    );
  }
  if (criterionLabelMatches(criterion, 'Intent and necessity')) {
    return downgrade(metrics.contrast > 0.12 ? 'medium' : 'low');
  }
  if (criterionLabelMatches(criterion, 'Surface and medium handling')) {
    return downgrade(
      metrics.textureScore > 0.09 && metrics.highlightClip < 0.05 ? 'medium' : 'low'
    );
  }
  if (
    criterionLabelMatches(criterion, 'Drawing, proportion, and spatial form') ||
    criterionLabelMatches(criterion, 'Presence, point of view, and human force')
  ) {
    return downgrade(
      metrics.centerFocus > 0.52 && metrics.borderActivity < 0.24 ? 'medium' : 'low'
    );
  }
  switch (criterion) {
    case 'Composition and shape structure':
    case 'Value and light structure':
    case 'Edge and focus control':
      return downgrade(metrics.contrast > 0.18 && metrics.edgeDensity > 0.14 ? 'high' : 'medium');
    case 'Color relationships':
    case 'Intent and necessity':
    case 'Surface and medium handling':
      return downgrade(
        metrics.textureScore > 0.09 && metrics.highlightClip < 0.05 ? 'medium' : 'low'
      );
    case 'Drawing, proportion, and spatial form':
    case 'Presence, point of view, and human force':
      return downgrade(
        metrics.centerFocus > 0.52 && metrics.borderActivity < 0.24 ? 'medium' : 'low'
      );
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
    case 'Intent and necessity':
      return [
        metrics.colorHarmony > 0.62
          ? 'major color families mostly belong to one world'
          : 'different areas compete as separate ideas',
        metrics.contrast > 0.18
          ? 'structure gives the painting one dominant read'
          : 'the read stays more dispersed than decisive',
        metrics.edgeBalance < 0.24
          ? 'emphasis is concentrated rather than spread evenly'
          : 'many passages ask for equal attention',
      ];
    case 'Composition and shape structure':
      return [
        describeFocalOffset(metrics.focalOffset),
        describeEdgeDensity(metrics.edgeDensity),
        metrics.edgeBalance < 0.24
          ? 'hard accents are not scattered everywhere'
          : 'many similar accents compete at once',
      ];
    case 'Value and light structure':
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
    case 'Drawing, proportion, and spatial form':
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
    case 'Edge and focus control':
      return [
        describeEdgeDensity(metrics.edgeDensity),
        metrics.edgeBalance < 0.2
          ? 'sharp edges are concentrated in a few places'
          : metrics.edgeBalance < 0.32
            ? 'sharp edges are moderately spread'
            : 'sharp edges appear in many areas',
        describeValueSpread(metrics.valueSpread),
      ];
    case 'Surface and medium handling':
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
    case 'Presence, point of view, and human force':
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
    case 'Intent and necessity':
      return 'Preserve the strongest overall read already in the piece; build revisions around that instead of starting over everywhere.';
    case 'Composition and shape structure':
      return level === 'Beginner'
        ? 'Keep the clearest anchor you already have; one stable focal area is enough to build the rest around.'
        : 'Protect the existing focal pull while you simplify secondary movement.';
    case 'Value and light structure':
      return metrics.valueSpread > 0.22
        ? 'Preserve the biggest light-dark separation already working in the painting.'
        : 'Preserve whichever passage still reads when you squint; that is your current value anchor.';
    case 'Color relationships':
      return metrics.colorHarmony > 0.6
        ? 'Hold on to the overall color family even as you sharpen accents.'
        : 'Keep the most convincing warm-cool relationship already present and build outward from it.';
    case 'Drawing, proportion, and spatial form':
      return 'Preserve the strongest silhouette or alignment you already trust; use it as the measuring key for weaker passages.';
    case 'Edge and focus control':
      return 'Keep one edge area clearly dominant so the painting still knows where to focus.';
    case 'Surface and medium handling':
      return metrics.textureScore > 0.14
        ? 'Protect the passages where the marks already feel committed and economical.'
        : 'Preserve your broadest, least-fussy shapes while you rework louder passages.';
    case 'Presence, point of view, and human force':
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
    case 'Intent and necessity':
      return 'Before painting, write one sentence about what this piece is trying to do, then make a quick study that removes anything not serving that aim.';
    case 'Composition and shape structure':
      return `Do six 2-minute thumbnails in ${style}, changing only the focal placement and big value masses before touching detail.`;
    case 'Value and light structure':
      return `Make a 3-value study in ${medium.toLowerCase()} from the same reference: light, mid, dark only.`;
    case 'Color relationships':
      return `Paint a limited-palette study with one warm and one cool bias per major area before mixing tertiary accents.`;
    case 'Drawing, proportion, and spatial form':
      return 'Spend one session on envelope/block-in only: compare angles, halves, and plumb lines before rendering.';
    case 'Edge and focus control':
      return 'Do a small edge map study, labeling each major contour hard, soft, or lost before repainting the passage.';
    case 'Surface and medium handling':
      return `Make one small study with only 3-4 mark types in ${medium.toLowerCase()} so every stroke family has a job.`;
    case 'Presence, point of view, and human force':
      return `Make two quick variants of this piece with opposite emotional intents, then note which visual decisions actually changed.`;
    default:
      return 'Do one short focused study on the weakest visible sub-skill before the next full repaint.';
  }
}
