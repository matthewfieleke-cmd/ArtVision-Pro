export const ARTISTS_BY_STYLE = {
  Realism: [
    'Gustave Courbet',
    'Jean-François Millet',
    'Ilya Repin',
    'Honoré Daumier',
    'Winslow Homer',
    'Thomas Eakins',
  ],
  Impressionism: [
    'Claude Monet',
    'Pierre-Auguste Renoir',
    'Edgar Degas',
    'Camille Pissarro',
    'Berthe Morisot',
    'Mary Cassatt',
  ],
  Expressionism: [
    'Edvard Munch',
    'Wassily Kandinsky',
    'Egon Schiele',
    'Ernst Ludwig Kirchner',
    'Emil Nolde',
    'Paula Modersohn-Becker',
  ],
  'Abstract Art': [
    'Wassily Kandinsky',
    'Piet Mondrian',
    'Mark Rothko',
    'Kazimir Malevich',
    'Jackson Pollock',
    'Joan Miró',
  ],
} as const;

export type StyleKey = keyof typeof ARTISTS_BY_STYLE;
