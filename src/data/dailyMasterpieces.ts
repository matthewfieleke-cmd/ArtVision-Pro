import type { Style } from '../types';

const c = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/${path}`;

export type DailyMasterpieceEntry = {
  artist: string;
  work: string;
  style: Style;
  /** Two short sentences on why the work matters pedagogically / historically */
  blurb: string;
  /** Authoritative page to view the work (museum, collection, or Commons file) */
  paintingUrl: string;
  paintingLinkLabel: string;
  /** Optional thumbnail when reproduction is clearly embeddable (e.g. PD on Commons) */
  imageUrl?: string;
  imageAlt: string;
  imageCredit?: string;
};

export const DAILY_MASTERPIECES: DailyMasterpieceEntry[] = [
  {
    artist: 'Jean-François Millet',
    work: 'The Gleaners',
    style: 'Realism',
    blurb:
      'Millet monumentalizes rural women’s labor with a stable pyramid of backs and a low horizon that keeps the field and sky in tense balance. The painting became a touchstone for how Realist value structure and social meaning can merge without sentimental prettiness.',
    paintingUrl: 'https://www.musee-orsay.fr/en/artworks/the-gleaners-252',
    paintingLinkLabel: 'View at Musée d’Orsay',
    imageUrl: c('thumb/1/1f/Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg/800px-Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg'),
    imageAlt: 'Jean-François Millet, The Gleaners',
    imageCredit: 'Google Art Project / Musée d’Orsay (public domain)',
  },
  {
    artist: 'Claude Monet',
    work: 'Impression, Sunrise',
    style: 'Impressionism',
    blurb:
      'This harbor view gave the Impressionists their name: a few value keys and broken color suggest mist, water, and sun without illustrational detail. It demonstrates how optical truth—light as the true subject—can replace tight contour.',
    paintingUrl: 'https://www.marmottan.fr/en/private_collections/impressionism-et-apres-guerre-137-255/impression-sunrise-24-97.html',
    paintingLinkLabel: 'View at Musée Marmottan Monet',
    imageUrl: c('thumb/5/59/Monet_-_Impression,_Sunrise.jpg/800px-Monet_-_Impression,_Sunrise.jpg'),
    imageAlt: 'Claude Monet, Impression, Sunrise',
    imageCredit: 'Public domain (Wikimedia Commons)',
  },
  {
    artist: 'Edvard Munch',
    work: 'The Scream',
    style: 'Expressionism',
    blurb:
      'Munch compresses panic into a diagram-like figure against a throbbing sky, using non-naturalistic color and wavy perspective as psychological fact. The work helped define Expressionism’s priority: inner feeling over external accuracy.',
    paintingUrl: 'https://www.nasjonalmuseet.no/en/visit/museums/the-national-museum/exhibitions-2022/the-scream/',
    paintingLinkLabel: 'National Museum of Norway (The Scream)',
    imageUrl: c('thumb/c/c5/Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg/640px-Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg'),
    imageAlt: 'Edvard Munch, The Scream',
    imageCredit: 'National Gallery of Norway (public domain in many jurisdictions)',
  },
  {
    artist: 'Piet Mondrian',
    work: 'Composition with Red, Blue, and Yellow',
    style: 'Abstract Art',
    blurb:
      'Mondrian pares painting to verticals, horizontals, and a handful of hues to test “dynamic equilibrium”—how slight shifts in bar thickness and rectangle size reset the whole rhythm. It is a master class in edge control and interval when nothing “depictive” is left to hide behind.',
    paintingUrl: 'https://commons.wikimedia.org/wiki/File:Piet_Mondrian_-_Composition_with_Red,_Blue_and_Yellow.jpg',
    paintingLinkLabel: 'High-resolution file (Wikimedia Commons)',
    imageUrl: c('thumb/7/7d/Piet_Mondrian_-_Composition_with_Red,_Blue_and_Yellow.jpg/800px-Piet_Mondrian_-_Composition_with_Red,_Blue_and_Yellow.jpg'),
    imageAlt: 'Piet Mondrian, Composition with Red, Blue and Yellow',
    imageCredit: 'Wikimedia Commons (check jurisdiction for reuse)',
  },
  {
    artist: 'Ilya Repin',
    work: 'Barge Haulers on the Volga',
    style: 'Realism',
    blurb:
      'Repin aligns exhausted bodies along a diagonal pull so narrative, class, and landscape read in one glance. The picture shows how Russian Realism fused reportorial observation with history-painting scale.',
    paintingUrl: 'https://www.russianmuseum.ru/en/mikhailovsky-palace/exhibitions/ilya-repin/',
    paintingLinkLabel: 'State Russian Museum (Repin)',
    imageUrl: c('thumb/1/1c/Repin_barge_haulers_on_the_volga.jpg/800px-Repin_barge_haulers_on_the_volga.jpg'),
    imageAlt: 'Ilya Repin, Barge Haulers on the Volga',
    imageCredit: 'Yorck Project / Wikimedia Commons',
  },
  {
    artist: 'Berthe Morisot',
    work: 'The Cradle',
    style: 'Impressionism',
    blurb:
      'A veil of gauze mediates our view of mother and infant, turning white paint into atmosphere as much as object. Morisot’s touch keeps high-key Impressionism tender without sugary pastel cliché.',
    paintingUrl: 'https://www.musee-orsay.fr/en/artworks/the-cradle-3145',
    paintingLinkLabel: 'View at Musée d’Orsay',
    imageUrl: c('thumb/1/1e/Berthe_Morisot_-_The_Cradle_-_Google_Art_Project.jpg/800px-Berthe_Morisot_-_The_Cradle_-_Google_Art_Project.jpg'),
    imageAlt: 'Berthe Morisot, The Cradle',
    imageCredit: 'Google Art Project / Musée d’Orsay (public domain)',
  },
  {
    artist: 'Mark Rothko',
    work: 'No. 61 (Rust and Blue)',
    style: 'Abstract Art',
    blurb:
      'Stacked color clouds hover with feathered edges so the painting seems to breathe; Rothko sized canvases for bodily confrontation, not decoration. Copyright restricts casual reproduction—visit the museum record to see how thin films of pigment create luminous depth.',
    paintingUrl: 'https://www.moca.org/collection/work/no-61-rust-and-blue-brown-blue-brown-on-blue',
    paintingLinkLabel: 'View at MOCA Los Angeles',
    imageUrl: undefined,
    imageAlt: 'Mark Rothko color field (see collection link)',
    imageCredit: undefined,
  },
  {
    artist: 'Winslow Homer',
    work: 'The Gulf Stream',
    style: 'Realism',
    blurb:
      'Homer strands a small boat amid sharks and a waterspout, using warm-cool water and stark figure-ground contrast to fuse American marine painting with moral tension. The scene is “realist” in observation of sea craft yet symbolic in its refusal of rescue.',
    paintingUrl: 'https://www.metmuseum.org/art/collection/search/16636',
    paintingLinkLabel: 'View at The Met',
    imageUrl: c('thumb/8/8e/Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg/800px-Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg'),
    imageAlt: 'Winslow Homer, The Gulf Stream',
    imageCredit: 'The Metropolitan Museum of Art (public domain)',
  },
];
