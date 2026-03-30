import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';

export type PreviewEditTarget = {
  criterion: CriterionLabel;
  level?: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
  anchor?: CriterionAnchor;
  editPlan?: CriterionEditPlan;
  /** When set, the image edit is driven primarily by this Voice B line from Studio read. */
  studioChangeRecommendation?: string;
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
