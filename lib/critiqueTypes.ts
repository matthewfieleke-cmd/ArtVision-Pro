import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';

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

export type CritiqueCategoryDTO = {
  criterion: CriterionLabel;
  level: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
  confidence?: CritiqueConfidenceDTO;
  evidenceSignals?: string[];
  preserve?: string;
  practiceExercise?: string;
  nextTarget?: string;
  subskills?: Array<{
    label: string;
    score: number;
    level: RatingLevelLabel;
  }>;
};

export type CritiqueSimpleFeedbackDTO = {
  intent: string;
  working: string[];
  mainIssue: string;
  nextSteps: string[];
  preserve: string;
};

export type CritiqueResultDTO = {
  categories: CritiqueCategoryDTO[];
  summary: string;
  simpleFeedback?: CritiqueSimpleFeedbackDTO;
  comparisonNote?: string;
  paintingTitle?: string;
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
