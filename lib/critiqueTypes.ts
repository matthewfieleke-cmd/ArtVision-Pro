import type { CriterionLabel } from '../shared/criteria.js';
import type {
  CompletionRead,
  CritiqueCategory,
  CritiqueConfidence,
  CritiquePipelineSalvagedCriterion,
  CritiqueResult,
  CritiqueSimpleFeedback,
  OverallSummaryCard,
  PhotoQualityAssessment,
  StudioAnalysis,
  StudioChange,
  SuggestedTitle,
  SuggestedTitleCategory,
  VoiceBCanonicalPlan,
  VoiceBPlan,
  VoiceBStep,
  WorkCompletionState,
} from '../shared/critiqueContract.js';
import type { EvidenceStageResult } from './critiqueZodSchemas.js';

export type CritiqueConfidenceDTO = CritiqueConfidence;
export type WorkCompletionStateDTO = WorkCompletionState;
export type CompletionReadDTO = CompletionRead;
export type PhotoQualityAssessmentDTO = PhotoQualityAssessment;
export type VoiceBStepDTO = VoiceBStep;
export type VoiceBPlanDTO = VoiceBPlan;
export type VoiceBCanonicalPlanDTO = VoiceBCanonicalPlan;
export type CritiqueCategoryDTO = CritiqueCategory;
export type StudioAnalysisDTO = StudioAnalysis;
export type StudioChangeDTO = StudioChange;
export type CritiqueSimpleFeedbackDTO = CritiqueSimpleFeedback;
export type OverallSummaryCardDTO = OverallSummaryCard;
export type SuggestedTitleCategoryDTO = SuggestedTitleCategory;
export type SuggestedTitleDTO = SuggestedTitle;
export type CritiqueResultDTO = CritiqueResult;

/**
 * Shape of the vision-stage evidence payload the rest of the critique
 * pipeline consumes. Built on top of the Zod schema in
 * `critiqueZodSchemas.ts` (single source of truth for the OpenAI Structured
 * Output), with two narrowings the inferred Zod type cannot express on its
 * own:
 *
 *   1. `criterionEvidence[].criterion` is narrowed to `CriterionLabel`.
 *      The Zod schema casts `CRITERIA_ORDER as unknown as [string, ...]`
 *      for OpenAI compatibility, so `z.infer` widens this field to `string`;
 *      every consumer downstream needs the literal union back.
 *   2. An optional `salvagedCriteria` entry that the pipeline attaches when
 *      a single criterion degrades gracefully — not part of the wire shape
 *      from OpenAI, so it lives outside the Zod schema.
 */
type RawEvidenceStageResult = Omit<EvidenceStageResult, 'criterionEvidence'>;
export type CritiqueEvidenceDTO = RawEvidenceStageResult & {
  criterionEvidence: Array<
    Omit<EvidenceStageResult['criterionEvidence'][number], 'criterion'> & {
      criterion: CriterionLabel;
    }
  >;
  salvagedCriteria?: CritiquePipelineSalvagedCriterion[];
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
  /** Stripe Checkout JWT from `/api/stripe/checkout-return` (required when paywall env is set). */
  stripeCheckoutJwt?: string;
};
