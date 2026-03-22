/** Single source of truth for critique category labels (app + API + OpenAI schema). */
export const CRITERIA_ORDER = [
  'Composition',
  'Value structure',
  'Color relationships',
  'Drawing and proportion',
  'Edge control',
  'Brushwork / handling',
  'Unity and variety',
  'Originality / expressive force',
] as const;

export type CriterionLabel = (typeof CRITERIA_ORDER)[number];

export const RATING_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Master',
] as const;

export type RatingLevelLabel = (typeof RATING_LEVELS)[number];
