import { ARTISTS_BY_STYLE } from '../shared/artists';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria';

export const STYLES = [
  'Realism',
  'Impressionism',
  'Expressionism',
  'Abstract Art',
] as const satisfies readonly (keyof typeof ARTISTS_BY_STYLE)[];

export const MEDIUMS = [
  'Oil on Canvas',
  'Acrylic',
  'Pastel',
  'Drawing',
  'Watercolor',
] as const;

export type Style = (typeof STYLES)[number];
export type Medium = (typeof MEDIUMS)[number];

export const CRITERIA = CRITERIA_ORDER;

export type Criterion = (typeof CRITERIA_ORDER)[number];

export { RATING_LEVELS };

export type RatingLevel = (typeof RATING_LEVELS)[number];

export type CritiqueCategory = {
  criterion: Criterion;
  level: RatingLevel;
  feedback: string;
  actionPlan: string;
};

export type CritiqueResult = {
  categories: CritiqueCategory[];
  summary: string;
  /** When comparing to a prior version */
  comparisonNote?: string;
  /** Optional title the artist gave this work for this critique */
  paintingTitle?: string;
};

export type PaintingVersion = {
  id: string;
  imageDataUrl: string;
  createdAt: string;
  critique: CritiqueResult;
};

export type SavedPainting = {
  id: string;
  title: string;
  style: Style;
  medium: Medium;
  versions: PaintingVersion[];
};

export type TabId = 'home' | 'studio' | 'benchmarks' | 'profile';

export type WizardStep = 'setup' | 'capture' | 'analyzing' | 'results';

export { ARTISTS_BY_STYLE };
