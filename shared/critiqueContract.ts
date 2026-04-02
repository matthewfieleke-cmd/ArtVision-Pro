import type { CriterionLabel, RatingLevelLabel } from './criteria.js';
import type { CriterionAnchor, CriterionEditPlan } from './critiqueAnchors.js';

export type CritiqueConfidence = 'low' | 'medium' | 'high';

/** Whether the work reads as still in progress vs presentation-ready. */
export type WorkCompletionState = 'unfinished' | 'likely_finished' | 'uncertain';

export type CompletionRead = {
  state: WorkCompletionState;
  confidence: CritiqueConfidence;
  /** Short visible cues supporting the read (areas, substrate, finish variation). */
  cues: string[];
  /** One sentence: why it reads unfinished, finished, or uncertain. */
  rationale: string;
};

export type PhotoQualityAssessment = {
  level: 'poor' | 'fair' | 'good';
  summary: string;
  issues: string[];
  tips: string[];
};

export type VoiceBStep = {
  area: string;
  currentRead: string;
  move: string;
  expectedRead: string;
  preserve?: string;
  priority?: 'primary' | 'secondary';
};

export type VoiceBPlan = {
  currentRead: string;
  mainProblem?: string;
  mainStrength?: string;
  bestNextMove: string;
  optionalSecondMove?: string;
  avoidDoing?: string;
  expectedRead: string;
  storyIfRelevant?: string;
};

export type CritiqueSubskill = {
  label: string;
  /** Normalized 0-1 local estimate or API-provided sub-score. */
  score: number;
  level: RatingLevelLabel;
};

export type CritiqueCategory = {
  criterion: CriterionLabel;
  level?: RatingLevelLabel;
  /** Phase 1: objective visual extraction anchored to named passages or canvas regions. */
  visualInventory: string;
  feedback: string;
  actionPlan: string;
  confidence?: CritiqueConfidence;
  evidenceSignals?: string[];
  preserve?: string;
  nextTarget?: string;
  anchor?: CriterionAnchor;
  editPlan?: CriterionEditPlan;
  voiceBPlan?: VoiceBPlan;
  actionPlanSteps?: VoiceBStep[];
  subskills?: CritiqueSubskill[];
};

export type StudioAnalysis = {
  whatWorks: string;
  whatCouldImprove: string;
};

export type StudioChange = {
  text: string;
  previewCriterion: CriterionLabel;
};

export type CritiqueSimpleFeedback = {
  studioAnalysis: StudioAnalysis;
  studioChanges: StudioChange[];
};

export type OverallSummaryCard = {
  analysis: string;
  topPriorities: string[];
};

export type SuggestedTitleCategory = 'formalist' | 'tactile' | 'intent';

export type SuggestedTitle = {
  category: SuggestedTitleCategory;
  title: string;
  rationale: string;
};

export type CritiqueResult = {
  categories: CritiqueCategory[];
  summary: string;
  overallSummary?: OverallSummaryCard;
  simpleFeedback?: CritiqueSimpleFeedback;
  comparisonNote?: string;
  paintingTitle?: string;
  suggestedPaintingTitles?: SuggestedTitle[];
  analysisSource?: 'api';
  overallConfidence?: CritiqueConfidence;
  photoQuality?: PhotoQualityAssessment;
  completionRead?: CompletionRead;
};
