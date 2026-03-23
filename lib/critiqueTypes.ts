import type { CriterionLabel, RatingLevelLabel } from '../shared/criteria.js';

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
  paintingTitle?: string;
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
