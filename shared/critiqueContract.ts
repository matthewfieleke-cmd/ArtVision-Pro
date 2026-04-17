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

export type CritiqueResultTier = 'full' | 'validated_reduced' | 'minimal_safe';

export type CritiquePipelineStageId =
  | 'classification'
  | 'evidence'
  | 'voice_a'
  | 'voice_b'
  | 'validation'
  | 'fallback';

export type CritiquePipelineStageStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'fallback_succeeded';

export type CritiquePipelineAttempt = {
  attempt: number;
  status: CritiquePipelineStageStatus;
  model?: string;
  error?: string;
  details?: string[];
  repairNotePreview?: string;
  rawPreview?: string;
  criterionEvidencePreview?: CritiquePipelineCriterionEvidencePreview[];
  startedAt?: string;
  completedAt?: string;
};

export type CritiquePipelineCriterionEvidencePreview = {
  criterion: string;
  anchor?: string;
  visibleEvidencePreview?: string[];
};

export type CritiquePipelineSalvagedCriterion = {
  stage: 'evidence' | 'voice_a' | 'voice_b' | 'validation';
  criterion: CriterionLabel;
  reason: string;
};

export type CritiquePipelineStageSnapshot = {
  stage: CritiquePipelineStageId;
  status: CritiquePipelineStageStatus;
  model?: string;
  promptVersion?: string;
  attempts?: CritiquePipelineAttempt[];
};

export type CritiquePipelineMetadata = {
  schemaVersion: number;
  pipelineVersion: string;
  resultTier: CritiqueResultTier;
  completedWithFallback: boolean;
  stages?: Partial<Record<CritiquePipelineStageId, CritiquePipelineStageSnapshot>>;
  salvagedCriteria?: CritiquePipelineSalvagedCriterion[];
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

export type VoiceBCanonicalPlan = {
  currentRead: string;
  move: string;
  expectedRead: string;
  preserve?: string;
  editability: 'yes' | 'no';
};

export type CritiqueSubskill = {
  label: string;
  /** Normalized 0-1 local estimate or API-provided sub-score. */
  score: number;
  level: RatingLevelLabel;
};

export type CritiquePhase1 = {
  /** Objective visual extraction anchored to named passages or canvas regions. */
  visualInventory: string;
};

export type CritiquePhase2 = {
  criticsAnalysis: string;
};

export type CritiquePhase3 = {
  teacherNextSteps: string;
};

export type CritiqueCategory = {
  criterion: CriterionLabel;
  level?: RatingLevelLabel;
  phase1: CritiquePhase1;
  phase2: CritiquePhase2;
  phase3: CritiquePhase3;
  confidence?: CritiqueConfidence;
  evidenceSignals?: string[];
  preserve?: string;
  nextTarget?: string;
  anchor?: CriterionAnchor;
  /** Canonical Voice B plan; legacy fields below can be derived from this. */
  plan?: VoiceBCanonicalPlan;
  /** @deprecated Derived from plan + anchor for preview/edit compatibility. */
  editPlan?: CriterionEditPlan;
  /** @deprecated Derived from plan for legacy compatibility. */
  voiceBPlan?: VoiceBPlan;
  /** @deprecated Derived from plan + anchor for legacy compatibility. */
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
  comparisonNote?: string | null;
  paintingTitle?: string;
  suggestedPaintingTitles?: SuggestedTitle[];
  analysisSource?: 'api' | 'fallback';
  overallConfidence?: CritiqueConfidence;
  photoQuality?: PhotoQualityAssessment;
  completionRead?: CompletionRead;
  pipeline?: CritiquePipelineMetadata;
};
