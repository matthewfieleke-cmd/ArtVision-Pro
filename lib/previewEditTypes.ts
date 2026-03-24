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
};

export type PreviewEditResponseBody = {
  imageDataUrl: string;
  criterion: CriterionLabel;
};
