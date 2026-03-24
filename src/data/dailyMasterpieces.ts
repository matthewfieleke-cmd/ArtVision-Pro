import { artImage } from '../artPublicUrl';
import type { Style } from '../types';

/**
 * Thumbnails are served from `public/art/` (same origin) so Wikimedia hotlink blocks do not break Home.
 */
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
    imageUrl: artImage('millet-gleaners.jpg'),
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
    imageUrl: artImage('monet-impression-sunrise.jpg'),
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
    imageUrl: artImage('munch-scream.jpg'),
    imageAlt: 'Edvard Munch, The Scream',
    imageCredit: 'National Gallery of Norway (public domain in many jurisdictions)',
  },
  {
    artist: 'Piet Mondrian',
    work: 'Composition II in Red, Blue, and Yellow',
    style: 'Abstract Art',
    blurb:
      'In this 1930 canvas Mondrian pares painting to verticals, horizontals, and a handful of hues to test “dynamic equilibrium”—how slight shifts in bar thickness and rectangle size reset the whole rhythm. It is a master class in edge control and interval when nothing “depictive” is left to hide behind.',
    paintingUrl:
      'https://commons.wikimedia.org/wiki/File:Piet_Mondriaan,_1930_-_Mondrian_Composition_II_in_Red,_Blue,_and_Yellow.jpg',
    paintingLinkLabel: 'High-resolution file (Wikimedia Commons)',
    imageUrl: artImage('mondrian-composition-ii.jpg'),
    imageAlt: 'Piet Mondrian, Composition II in Red, Blue, and Yellow',
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
    imageUrl: artImage('repin-barge-haulers.jpg'),
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
    imageUrl: artImage('morisot-cradle.jpg'),
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
    imageUrl: artImage('homer-gulf-stream.jpg'),
    imageAlt: 'Winslow Homer, The Gulf Stream',
    imageCredit: 'The Metropolitan Museum of Art (public domain)',
  },
  {
    artist: 'Johannes Vermeer',
    work: 'Girl with a Pearl Earring',
    style: 'Realism',
    blurb:
      'A single face fills the canvas: the turban and pearl read as abstract shapes until the gaze locks you in. Vermeer shows how controlled light, soft edges, and a restrained palette can make intimacy monumental.',
    paintingUrl: 'https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring/',
    paintingLinkLabel: 'View at Mauritshuis',
    imageUrl: artImage('daily-vermeer-pearl.jpg'),
    imageAlt: 'Johannes Vermeer, Girl with a Pearl Earring',
    imageCredit: 'Wikimedia Commons (public domain)',
  },
  {
    artist: 'Georges Seurat',
    work: 'A Sunday on La Grande Jatte',
    style: 'Impressionism',
    blurb:
      'Pointillist dots of complementary color fuse at a distance into grass, water, and shadow—Seurat turns Impressionist light into a systematic experiment. The lesson: optical mixing can replace blended mud on the palette.',
    paintingUrl: 'https://www.artic.edu/artworks/27995/a-sunday-on-la-grande-jatte-1884',
    paintingLinkLabel: 'Art Institute of Chicago',
    imageUrl: artImage('daily-seurat-grande-jatte.jpg'),
    imageAlt: 'Georges Seurat, A Sunday on La Grande Jatte',
    imageCredit: 'Google Art Project / Wikimedia Commons',
  },
  {
    artist: 'Diego Velázquez',
    work: 'Las Meninas',
    style: 'Realism',
    blurb:
      'Mirrors, doorways, and the painter at his canvas collapse inside and outside the picture—Velázquez makes composition a philosophical puzzle. Brushwork stays loose while drawing and space stay razor-clear.',
    paintingUrl: 'https://www.museodelprado.es/en/the-collection/art-work/las-meninas/9fdc7440-e3c9-48da-9a3b-d10e7eab9d23',
    paintingLinkLabel: 'Museo del Prado',
    imageUrl: artImage('daily-velazquez-las-meninas.jpg'),
    imageAlt: 'Diego Velázquez, Las Meninas',
    imageCredit: 'Prado / Google Earth export on Wikimedia (check reuse)',
  },
  {
    artist: 'Francisco Goya',
    work: 'The Third of May 1808',
    style: 'Realism',
    blurb:
      'A lantern throws brutal light on the condemned man’s shirt—white becomes a target and a moral spotlight. Goya proves Realism can carry political terror without losing pictorial clarity.',
    paintingUrl: 'https://www.museodelprado.es/en/the-collection/art-work/the-3rd-of-may-1808-in-madrid-or-the-executions/f7bbf793-9528-4b9b-9e9d-6b097d3f6b9a',
    paintingLinkLabel: 'Museo del Prado',
    imageUrl: artImage('daily-goya-third-may.jpg'),
    imageAlt: 'Francisco Goya, The Third of May 1808',
    imageCredit: 'Prado / Google Earth export on Wikimedia (check reuse)',
  },
  {
    artist: 'Paul Cézanne',
    work: 'Mont Sainte-Victoire and Château Noir',
    style: 'Impressionism',
    blurb:
      'Patches of green and violet build the mountain as a geometric presence, not a postcard silhouette. Cézanne hands Impressionism forward to modern structure—every plane is negotiated, not guessed.',
    paintingUrl: 'https://en.wikipedia.org/wiki/Mont_Sainte-Victoire_with_Ch%C3%A2teau_Noir',
    paintingLinkLabel: 'About this series (Wikipedia)',
    imageUrl: artImage('daily-cezanne-mont-sainte-victoire.jpg'),
    imageAlt: 'Paul Cézanne, Mont Sainte-Victoire and Château Noir',
    imageCredit: 'Google Art Project / Wikimedia Commons',
  },
  {
    artist: 'Vincent van Gogh',
    work: 'The Starry Night',
    style: 'Expressionism',
    blurb:
      'The sky writhes with rhythmic strokes; the village below stays still—inner turbulence projected onto nature. Van Gogh shows how directional mark and saturated color can serve feeling without abandoning design.',
    paintingUrl: 'https://www.moma.org/collection/works/79802',
    paintingLinkLabel: 'MoMA collection',
    imageUrl: artImage('daily-van-gogh-starry-night.jpg'),
    imageAlt: 'Vincent van Gogh, The Starry Night',
    imageCredit: 'Google Art Project / Wikimedia (check MoMA rights for commercial use)',
  },
  {
    artist: 'J. M. W. Turner',
    work: 'The Fighting Temeraire',
    style: 'Realism',
    blurb:
      'A ghostly ship towed by a dark tug into sunset—Turner dissolves rigging into light but keeps the narrative legible. Mastery here is atmosphere with intent: loss, industry, and time in one glow.',
    paintingUrl: 'https://www.nationalgallery.org.uk/paintings/joseph-mallord-william-turner-the-fighting-temeraire',
    paintingLinkLabel: 'The National Gallery, London',
    imageUrl: artImage('daily-turner-temeraire.jpg'),
    imageAlt: 'J. M. W. Turner, The Fighting Temeraire',
    imageCredit: 'National Gallery / Wikimedia Commons',
  },
  {
    artist: 'John Singer Sargent',
    work: 'Madame X (Madame Pierre Gautreau)',
    style: 'Realism',
    blurb:
      'Black satin and powdered skin read as a few ruthless value shapes; one strap scandalized Paris. Sargent proves society portraiture can be as structurally demanding as history painting.',
    paintingUrl: 'https://www.metmuseum.org/art/collection/search/12127',
    paintingLinkLabel: 'The Met',
    imageUrl: artImage('daily-sargent-madame-x.jpg'),
    imageAlt: 'John Singer Sargent, Madame X',
    imageCredit: 'The Metropolitan Museum of Art / Wikimedia',
  },
  {
    artist: 'Gustav Klimt',
    work: 'The Kiss',
    style: 'Abstract Art',
    blurb:
      'Gold leaf and patterned robes flatten into a decorative icon; bodies dissolve into ornament without losing embrace. Klimt tests where figure ends and abstract surface begins.',
    paintingUrl: 'https://www.belvedere.at/en/belvedere/collections/graphic-art/klimt-kiss',
    paintingLinkLabel: 'Belvedere, Vienna',
    imageUrl: artImage('daily-klimt-kiss.jpg'),
    imageAlt: 'Gustav Klimt, The Kiss',
    imageCredit: 'Google Cultural Institute / Wikimedia (check jurisdiction)',
  },
  {
    artist: 'Claude Monet',
    work: 'Water Lilies (pond)',
    style: 'Impressionism',
    blurb:
      'Reflection replaces horizon: lily pads and sky share one liquid plane. Late Monet pushes Impressionist dissolution toward abstraction while keeping temperature and depth cues for the eye.',
    paintingUrl: 'https://www.musee-orangerie.fr/en',
    paintingLinkLabel: 'Musée de l’Orangerie (Water Lilies)',
    imageUrl: artImage('daily-monet-water-lilies.jpg'),
    imageAlt: 'Claude Monet, Water Lilies',
    imageCredit: 'Google Art Project / Wikimedia Commons',
  },
  {
    artist: 'Robert Delaunay',
    work: 'La ville de Paris',
    style: 'Abstract Art',
    blurb:
      'The Eiffel Tower fractures into disks and wedges of color—Orphism treats the city as rhythm and light. Delaunay links early modern Paris to a fully abstract vocabulary.',
    paintingUrl: 'https://en.wikipedia.org/wiki/La_ville_de_Paris',
    paintingLinkLabel: 'Wikipedia (work context)',
    imageUrl: artImage('daily-delaunay-ville-paris.jpg'),
    imageAlt: 'Robert Delaunay, La ville de Paris',
    imageCredit: 'Google Art Project / Wikimedia Commons',
  },
  {
    artist: 'Gustave Courbet',
    work: 'A Burial at Ornans',
    style: 'Realism',
    blurb:
      'A whole town becomes a frieze of faces and black cloth—ordinary grief given the scale of history painting. Courbet’s Realism insists on weight, earth, and democratic presence.',
    paintingUrl: 'https://www.musee-orsay.fr/en/artworks/burial-ornans-44',
    paintingLinkLabel: 'Musée d’Orsay',
    imageUrl: artImage('courbet-burial-ornans.jpg'),
    imageAlt: 'Gustave Courbet, A Burial at Ornans',
    imageCredit: 'Google Art Project / Musée d’Orsay (public domain)',
  },
  {
    artist: 'Edgar Degas',
    work: 'The Ballet Class',
    style: 'Impressionism',
    blurb:
      'Off-center cuts and shallow space mimic a rehearsal seen in passing. Degas ties Impressionist light to graphic structure—every limb stays accountable under rapid notation.',
    paintingUrl: 'https://www.musee-orsay.fr/en/artworks/the-ballet-class-333',
    paintingLinkLabel: 'Musée d’Orsay',
    imageUrl: artImage('degas-ballet-class.jpg'),
    imageAlt: 'Edgar Degas, The Ballet Class',
    imageCredit: 'Google Art Project / Musée d’Orsay (public domain)',
  },
  {
    artist: 'Pierre-Auguste Renoir',
    work: 'Bal du moulin de la Galette',
    style: 'Impressionism',
    blurb:
      'Dappled shade turns hats and shoulders into a rhythm of warm and cool patches. Renoir shows how Impressionist pleasure still needs compositional discipline to avoid sweet chaos.',
    paintingUrl: 'https://www.musee-orsay.fr/en/artworks/dance-le-moulin-de-la-galette-90',
    paintingLinkLabel: 'Musée d’Orsay',
    imageUrl: artImage('renoir-moulin-galette.jpg'),
    imageAlt: 'Pierre-Auguste Renoir, Bal du moulin de la Galette',
    imageCredit: 'Public domain (Wikimedia Commons)',
  },
  {
    artist: 'Camille Pissarro',
    work: 'Boulevard Montmartre, Spring',
    style: 'Impressionism',
    blurb:
      'Wet pavement mirrors façades in broken verticals; carriages pin depth. Pissarro turns a busy Paris view into a lesson in repeated intervals and weather as a single color cast.',
    paintingUrl: 'https://www.courtauld.ac.uk/',
    paintingLinkLabel: 'The Courtauld Gallery',
    imageUrl: artImage('pissarro-boulevard-montmartre.jpg'),
    imageAlt: 'Camille Pissarro, Boulevard Montmartre, Spring',
    imageCredit: 'Google Art Project (public domain)',
  },
  {
    artist: 'Mary Cassatt',
    work: 'The Child’s Bath',
    style: 'Impressionism',
    blurb:
      'A tilted domestic plane and patterned surfaces echo Japanese prints. Cassatt’s Impressionism is intimate scale with the same high-key discipline as outdoor painters.',
    paintingUrl: 'https://www.artic.edu/artworks/111155/the-childs-bath',
    paintingLinkLabel: 'Art Institute of Chicago',
    imageUrl: artImage('cassatt-childs-bath.jpg'),
    imageAlt: 'Mary Cassatt, The Child’s Bath',
    imageCredit: 'Google Art Project (public domain)',
  },
  {
    artist: 'Wassily Kandinsky',
    work: 'Composition VII',
    style: 'Expressionism',
    blurb:
      'Angular shards and arabesques barely tether to apocalyptic hints—color and line conduct pure energy. Munich-era Kandinsky bridges recognizable tumult and emerging abstraction.',
    paintingUrl: 'https://www.tretyakovgallery.ru/en/collection/abstract-composition/',
    paintingLinkLabel: 'State Tretyakov Gallery',
    imageUrl: artImage('kandinsky-composition-vii.jpg'),
    imageAlt: 'Wassily Kandinsky, Composition VII',
    imageCredit: 'Wikimedia Commons (GAC scan; check copyright term)',
  },
  {
    artist: 'Egon Schiele',
    work: 'Self-Portrait with Physalis',
    style: 'Expressionism',
    blurb:
      'Sickly greens and pinks refuse cosmetic flesh; the stare is off-balance on purpose. Schiele’s line and color make psychological exposure the subject.',
    paintingUrl: 'https://www.leopoldmuseum.org/en',
    paintingLinkLabel: 'Leopold Museum, Vienna',
    imageUrl: artImage('schiele-self-portrait-physalis.jpg'),
    imageAlt: 'Egon Schiele, Self-Portrait with Physalis',
    imageCredit: 'Google Art Project (verify rights in your region)',
  },
  {
    artist: 'Ernst Ludwig Kirchner',
    work: 'Berlin Street Scene',
    style: 'Expressionism',
    blurb:
      'Mask-like faces and slashing diagonals turn the boulevard into nervous theater. Brücke color is chosen for alienation, not local description.',
    paintingUrl: 'https://www.moma.org/collection/works/80505',
    paintingLinkLabel: 'MoMA collection',
    imageUrl: artImage('kirchner-street-berlin.jpg'),
    imageAlt: 'Ernst Ludwig Kirchner, Berlin Street Scene',
    imageCredit: 'Google Art Project / MoMA (verify rights)',
  },
  {
    artist: 'Paula Modersohn-Becker',
    work: 'Self-Portrait with Hat and Veil',
    style: 'Expressionism',
    blurb:
      'The face fills the frame like a monument carved from earth tones. Early German Expressionism meets stillness—empathy through reduction, not anecdote.',
    paintingUrl: 'https://en.wikipedia.org/wiki/Paula_Modersohn-Becker',
    paintingLinkLabel: 'Wikipedia / further reading',
    imageUrl: artImage('modersohn-becker-self-portrait-veil.jpg'),
    imageAlt: 'Paula Modersohn-Becker, Self-Portrait with Hat and Veil',
    imageCredit: 'Google Art Project (verify rights)',
  },
];
