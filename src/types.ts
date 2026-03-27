import { ARTISTS_BY_STYLE } from '../shared/artists';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria';

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

export type CritiqueConfidence = 'low' | 'medium' | 'high';

/** Whether the work reads as still in progress vs presentation-ready. */
export type WorkCompletionState = 'unfinished' | 'likely_finished' | 'uncertain';

export type CompletionRead = {
  state: WorkCompletionState;
  confidence: CritiqueConfidence;
  cues: string[];
  rationale: string;
};

export type PhotoQualityAssessment = {
  level: 'poor' | 'fair' | 'good';
  summary: string;
  issues: string[];
  tips: string[];
};

export type CritiqueSubskill = {
  label: string;
  /** Normalized 0-1 local estimate or API-provided sub-score. */
  score: number;
  level: RatingLevel;
};

export type CritiqueCategory = {
  criterion: Criterion;
  level: RatingLevel;
  feedback: string;
  actionPlan: string;
  confidence?: CritiqueConfidence;
  /** Short observable reasons behind the grade; useful for quick review. */
  evidenceSignals?: string[];
  /** What is already working and should survive the next round of edits. */
  preserve?: string;
  /** Deliberate exercise to practice the weak sub-skill outside the main piece. */
  practiceExercise?: string;
  /** Friendly "move toward X" label for the next revision. */
  nextTarget?: string;
  /** Optional sub-skill breakdown; especially useful for local heuristic grading. */
  subskills?: CritiqueSubskill[];
};

/** Voice A: critical analysis (composite critic voice). */
export type StudioAnalysis = {
  whatWorks: string;
  whatCouldImprove: string;
};

/** One concrete studio change (Voice B); previewCriterion drives Generate preview. */
export type StudioChange = {
  text: string;
  previewCriterion: Criterion;
};

export type CritiqueSimpleFeedback = {
  studioAnalysis: StudioAnalysis;
  /** Voice B: 2–5 specific changes for this painting only. */
  studioChanges: StudioChange[];
};

export type CritiqueResult = {
  categories: CritiqueCategory[];
  summary: string;
  /** Simple top-level studio feedback shown before the detailed criterion breakdown. */
  simple?: CritiqueSimpleFeedback;
  /** When comparing to a prior version */
  comparisonNote?: string;
  /** Optional title the artist gave this work for this critique */
  paintingTitle?: string;
  /** Whether this critique came from the API vision model or local heuristics. */
  analysisSource?: 'api' | 'local';
  overallConfidence?: CritiqueConfidence;
  photoQuality?: PhotoQualityAssessment;
  /** Read of whether the piece looks in progress vs finished; steers tone of feedback. */
  completionRead?: CompletionRead;
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

export type TabId = 'home' | 'studio' | 'benchmarks' | 'profile';

export type WizardStep = 'setup' | 'capture' | 'analyzing' | 'results';

export { ARTISTS_BY_STYLE };
