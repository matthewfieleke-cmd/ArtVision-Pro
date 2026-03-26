import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';

export type PreviewEditTarget = {
  criterion: CriterionLabel;
  level: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
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
