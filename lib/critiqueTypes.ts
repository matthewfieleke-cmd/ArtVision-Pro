import type {
  CompletionRead,
  CritiqueCategory,
  CritiqueConfidence,
  CritiqueResult,
  CritiqueSimpleFeedback,
  OverallSummaryCard,
  PhotoQualityAssessment,
  StudioAnalysis,
  StudioChange,
  SuggestedTitle,
  SuggestedTitleCategory,
  VoiceBPlan,
  VoiceBStep,
  WorkCompletionState,
} from '../shared/critiqueContract.js';

export type CritiqueConfidenceDTO = CritiqueConfidence;
export type WorkCompletionStateDTO = WorkCompletionState;
export type CompletionReadDTO = CompletionRead;
export type PhotoQualityAssessmentDTO = PhotoQualityAssessment;
export type VoiceBStepDTO = VoiceBStep;
export type VoiceBPlanDTO = VoiceBPlan;
export type CritiqueCategoryDTO = CritiqueCategory;
export type StudioAnalysisDTO = StudioAnalysis;
export type StudioChangeDTO = StudioChange;
export type CritiqueSimpleFeedbackDTO = CritiqueSimpleFeedback;
export type OverallSummaryCardDTO = OverallSummaryCard;
export type SuggestedTitleCategoryDTO = SuggestedTitleCategory;
export type SuggestedTitleDTO = SuggestedTitle;
export type CritiqueResultDTO = CritiqueResult;

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
