import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';

export type PreviewEditTarget = {
  criterion: CriterionLabel;
  level: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
  /** When set, the image edit is driven primarily by this Voice B line from Studio read. */
  studioChangeRecommendation?: string;
  /** Numbered Voice B lines to apply in one pass (all suggested changes). */
  combinedVoiceBChanges?: string;
  /** When applying Voice B lines sequentially, which pass this request is (1-based). */
  chainPassIndex?: number;
  chainPassTotal?: number;
  /** Plain-text list of Voice B lines already applied in earlier chain passes. */
  completedChainInstructions?: string;
};

export type PreviewEditRequestBody = {
  imageDataUrl: string;
  style: string;
  medium: string;
  target: PreviewEditTarget;
  /** Optional client request key so resumed mobile requests can reuse the same work. */
  requestId?: string;
};

export type PreviewEditResponseBody = {
  imageDataUrl: string;
  criterion: CriterionLabel;
};
