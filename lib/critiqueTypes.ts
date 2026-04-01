import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';

export type CritiqueConfidenceDTO = 'low' | 'medium' | 'high';

/** Whether the work reads as still in progress vs presentation-ready (from vision evidence or local heuristics). */
export type WorkCompletionStateDTO = 'unfinished' | 'likely_finished' | 'uncertain';

export type CompletionReadDTO = {
  state: WorkCompletionStateDTO;
  confidence: CritiqueConfidenceDTO;
  /** Short visible cues supporting the read (areas, substrate, finish variation). */
  cues: string[];
  /** One sentence: why it reads unfinished, finished, or uncertain. */
  rationale: string;
};

export type PhotoQualityAssessmentDTO = {
  level: 'poor' | 'fair' | 'good';
  summary: string;
  issues: string[];
  tips: string[];
};

export type VoiceBStepDTO = {
  area: string;
  currentRead: string;
  move: string;
  expectedRead: string;
  preserve?: string;
  priority: 'primary' | 'secondary';
};

export type VoiceBPlanDTO = {
  currentRead: string;
  mainProblem?: string;
  mainStrength?: string;
  bestNextMove: string;
  optionalSecondMove?: string;
  avoidDoing?: string;
  expectedRead: string;
  storyIfRelevant?: string;
};

export type CritiqueCategoryDTO = {
  criterion: CriterionLabel;
  level?: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
  confidence?: CritiqueConfidenceDTO;
  evidenceSignals?: string[];
  preserve?: string;
  practiceExercise?: string;
  nextTarget?: string;
  anchor?: CriterionAnchor;
  editPlan?: CriterionEditPlan;
  voiceBPlan?: VoiceBPlanDTO;
  actionPlanSteps?: VoiceBStepDTO[];
  subskills?: Array<{
    label: string;
    score: number;
    level: RatingLevelLabel;
  }>;
};

export type StudioAnalysisDTO = {
  whatWorks: string;
  whatCouldImprove: string;
};

export type StudioChangeDTO = {
  text: string;
  previewCriterion: CriterionLabel;
};

export type CritiqueSimpleFeedbackDTO = {
  studioAnalysis: StudioAnalysisDTO;
  studioChanges: StudioChangeDTO[];
};

export type OverallSummaryCardDTO = {
  analysis: string;
  topPriorities: string[];
};

export type SuggestedTitleCategoryDTO = 'formalist' | 'tactile' | 'intent';

export type SuggestedTitleDTO = {
  category: SuggestedTitleCategoryDTO;
  title: string;
  rationale: string;
};

export type CritiqueResultDTO = {
  categories: CritiqueCategoryDTO[];
  summary: string;
  overallSummary?: OverallSummaryCardDTO;
  simpleFeedback?: CritiqueSimpleFeedbackDTO;
  comparisonNote?: string;
  paintingTitle?: string;
  /** Categorized title suggestions with rationales (Formalist / Tactile / Intent). */
  suggestedPaintingTitles?: SuggestedTitleDTO[];
  analysisSource?: 'api' | 'local';
  overallConfidence?: CritiqueConfidenceDTO;
  photoQuality?: PhotoQualityAssessmentDTO;
  completionRead?: CompletionReadDTO;
};

export type CritiqueRequestBody = {
  style: string;
  medium: string;
  imageDataUrl: string;
  /** Optional title the artist uses for this work */
  paintingTitle?: string;
  /** Prior painting photo (resubmit / compare) */
  previousImageDataUrl?: string;
  /** Serialized prior critique JSON */
  previousCritique?: CritiqueResultDTO;
};
