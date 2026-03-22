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

export const DAILY_MASTERPIECES: { artist: string; work: string; style: Style }[] = [
  { artist: 'Jean-François Millet', work: 'The Gleaners', style: 'Realism' },
  { artist: 'Claude Monet', work: 'Impression, Sunrise', style: 'Impressionism' },
  { artist: 'Edvard Munch', work: 'The Scream', style: 'Expressionism' },
  { artist: 'Piet Mondrian', work: 'Composition with Red, Blue, and Yellow', style: 'Abstract Art' },
  { artist: 'Ilya Repin', work: 'Barge Haulers on the Volga', style: 'Realism' },
  { artist: 'Berthe Morisot', work: 'The Cradle', style: 'Impressionism' },
  { artist: 'Mark Rothko', work: 'No. 61 (Rust and Blue)', style: 'Abstract Art' },
  { artist: 'Winslow Homer', work: 'The Gulf Stream', style: 'Realism' },
];
