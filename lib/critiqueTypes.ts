import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria';

export type CritiqueCategoryDTO = {
  criterion: CriterionLabel;
  level: RatingLevelLabel;
  feedback: string;
  actionPlan: string;
};

export type CritiqueResultDTO = {
  categories: CritiqueCategoryDTO[];
  summary: string;
  comparisonNote?: string;
};

export type CritiqueRequestBody = {
  style: string;
  medium: string;
  imageDataUrl: string;
  /** Prior painting photo (resubmit / compare) */
  previousImageDataUrl?: string;
  /** Serialized prior critique JSON */
  previousCritique?: CritiqueResultDTO;
};
