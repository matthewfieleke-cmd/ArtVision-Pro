export const STYLES = [
  'Realism',
  'Impressionism',
  'Expressionism',
  'Abstract Art',
] as const;

export const MEDIUMS = [
  'Oil on Canvas',
  'Pastel',
  'Drawing',
  'Watercolor',
] as const;

export type Style = (typeof STYLES)[number];
export type Medium = (typeof MEDIUMS)[number];

export const CRITERIA = [
  'Composition',
  'Value structure',
  'Color relationships',
  'Drawing and proportion',
  'Edge control',
  'Brushwork / handling',
  'Unity and variety',
  'Originality / expressive force',
] as const;

export type Criterion = (typeof CRITERIA)[number];

export const RATING_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Master',
] as const;

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

export const ARTISTS_BY_STYLE: Record<Style, string[]> = {
  Realism: [
    'Gustave Courbet',
    'Jean-François Millet',
    'Ilya Repin',
    'Honoré Daumier',
    'Winslow Homer',
  ],
  Impressionism: [
    'Claude Monet',
    'Pierre-Auguste Renoir',
    'Edgar Degas',
    'Camille Pissarro',
    'Berthe Morisot',
  ],
  Expressionism: [
    'Edvard Munch',
    'Wassily Kandinsky',
    'Egon Schiele',
    'Ernst Ludwig Kirchner',
    'Emil Nolde',
  ],
  'Abstract Art': [
    'Wassily Kandinsky',
    'Piet Mondrian',
    'Mark Rothko',
    'Kazimir Malevich',
    'Jackson Pollock',
  ],
};

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
