import { ARTISTS_BY_STYLE } from '../shared/artists';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria';
import type { CritiqueResult as SharedCritiqueResult } from '../shared/critiqueContract';
export type {
  CompletionRead,
  CritiqueCategory,
  CritiqueConfidence,
  CritiqueSimpleFeedback,
  CritiqueSubskill,
  OverallSummaryCard,
  PhotoQualityAssessment,
  SuggestedTitle,
  VoiceBCanonicalPlan,
  VoiceBPlan,
  WorkCompletionState,
} from '../shared/critiqueContract';

export const STYLES = [
  'Realism',
  'Impressionism',
  'Expressionism',
  'Abstract Art',
] as const satisfies readonly (keyof typeof ARTISTS_BY_STYLE)[];

export const MEDIUMS = [
  'Oil on Canvas',
  'Acrylic',
  'Pastel',
  'Drawing',
  'Watercolor',
] as const;

export type Style = (typeof STYLES)[number];
export type Medium = (typeof MEDIUMS)[number];

export const CRITERIA = CRITERIA_ORDER;

export type Criterion = (typeof CRITERIA_ORDER)[number];

export { RATING_LEVELS };

export type RatingLevel = (typeof RATING_LEVELS)[number];

export type VoiceBPlanStep = import('../shared/critiqueContract').VoiceBStep;

/** Voice A: critical analysis (composite critic voice). */
export type StudioAnalysis = {
  whatWorks: string;
  whatCouldImprove: string;
};

/** One concrete studio change (Voice B); previewCriterion drives Perform single change. */
export type StudioChange = {
  text: string;
  previewCriterion: Criterion;
};

export type SuggestedTitleCategory = import('../shared/critiqueContract').SuggestedTitle['category'];

export type CritiqueResult = Omit<SharedCritiqueResult, 'simpleFeedback'> & {
  /** Simple top-level studio feedback shown before the detailed criterion breakdown. */
  simple?: import('../shared/critiqueContract').CritiqueSimpleFeedback;
};

/** AI illustrative edit; pairs with the critique photo for blend compare. */
export type SavedPreviewEdit = {
  id: string;
  imageDataUrl: string;
  criterion: Criterion;
  /** Voice B line for a single change, or omitted for combined pass. */
  studioChangeRecommendation?: string;
  mode: 'single' | 'combined';
};

/** @deprecated Use previewEdits; kept for migration from older saves. */
export type VersionPreviewEdit = {
  imageDataUrl: string;
  criterion: Criterion;
  studioChangeRecommendation?: string;
};

export type PaintingVersion = {
  id: string;
  imageDataUrl: string;
  createdAt: string;
  critique: CritiqueResult;
  /** All AI previews generated for this version (single changes + optional combined). */
  previewEdits?: SavedPreviewEdit[];
  /** @deprecated Migrated into previewEdits[0] when loading. */
  previewEdit?: VersionPreviewEdit;
};

export type SavedPainting = {
  id: string;
  title: string;
  style: Style;
  medium: Medium;
  versions: PaintingVersion[];
};

export type TabId = 'home' | 'studio' | 'benchmarks' | 'glossary' | 'profile';

export type WizardStep = 'setup' | 'capture' | 'analyzing' | 'results';

export { ARTISTS_BY_STYLE };
