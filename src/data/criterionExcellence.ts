import { CRITERIA_ORDER } from '../../shared/criteria';
import { artImage } from '../artPublicUrl';
import type { Criterion } from '../types';

export type CriterionExcellenceExample = {
  workTitle: string;
  artist: string;
  year?: string;
  medium?: string;
  collection?: string;
  /** Why this work exemplifies the criterion (for teaching). */
  whyExcellence: string;
  imageUrl: string;
  imageAlt: string;
  credit: string;
  moreInfoUrl: string;
};

export type CriterionExcellenceEntry = {
  criterion: Criterion;
  slug: string;
  /** One line — what this criterion measures */
  tagline: string;
  intro: string;
  examples: [CriterionExcellenceExample, CriterionExcellenceExample];
};

function slugForCriterion(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\/\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const ENTRIES: CriterionExcellenceEntry[] = [
  {
    criterion: 'Composition',
    slug: slugForCriterion('Composition'),
    tagline: 'How the whole image is organized—focal pull, rhythm, and balance.',
    intro:
      'Strong composition makes the eye move with purpose: a clear hierarchy of interest, repeated directions that rhyme, and supporting areas that stay subordinate. Study how masters stage the motif within the rectangle without crowding or drifting.',
    examples: [
      {
        workTitle: 'A Burial at Ornans',
        artist: 'Gustave Courbet',
        year: '1849–50',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        whyExcellence:
          'The painting reads as a wide human frieze: figures lock into a horizontal band while earth and sky hold negative space in check. Your eye travels along faces and hats, then settles on the grave—focal emphasis without a single heroic pyramid. Notice how spacing between bodies creates a slow rhythm, like musical rests, so the scene feels collective rather than cluttered.',
        imageUrl: artImage('courbet-burial-ornans.jpg'),
        imageAlt: 'Courbet, A Burial at Ornans',
        credit: 'Google Art Project / Musée d’Orsay; public domain (PD-old).',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_A_Burial_at_Ornans_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'Barge Haulers on the Volga',
        artist: 'Ilya Repin',
        year: '1870–73',
        medium: 'Oil on canvas',
        collection: 'State Russian Museum, Saint Petersburg',
        whyExcellence:
          'Repin uses a strong diagonal file of bodies to pull you along the riverbank, then interrupts that pull with the boy’s upright stance—a hinge that keeps the design from sliding out of the frame. Foreground ropes and hands pin the narrative to the picture plane while distant banks stay quieter. The lesson: one oblique thrust plus one counter-accent can organize a complex scene.',
        imageUrl: artImage('repin-barge-haulers.jpg'),
        imageAlt: 'Repin, Barge Haulers on the Volga',
        credit: 'Google Art Project; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Ilya_Repin_-_Barge_Haulers_on_the_Volga_-_Google_Art_Project.jpg',
      },
    ],
  },
  {
    criterion: 'Value structure',
    slug: slugForCriterion('Value structure'),
    tagline: 'The big light-and-dark pattern that still reads when you squint.',
    intro:
      'Values do the structural work of making form readable at a distance. Masters group shadows and lights into families, reserve extremes for emphasis, and keep midtones in service of the whole.',
    examples: [
      {
        workTitle: 'The Gleaners',
        artist: 'Jean-François Millet',
        year: '1857',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        whyExcellence:
          'Three bent figures form a compact dark mass against a luminous field and sky—squint and you still get a clear triangle of humanity versus harvest. Millet differentiates blacks in clothing so silhouettes don’t mush together, while distant wagons stay in a lighter key. It is a textbook case of few value steps carrying narrative and mood.',
        imageUrl: artImage('millet-gleaners.jpg'),
        imageAlt: 'Millet, The Gleaners',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg',
      },
      {
        workTitle: 'The Third-Class Carriage',
        artist: 'Honoré Daumier',
        year: 'c. 1862–64',
        medium: 'Oil on canvas',
        collection: 'Metropolitan Museum of Art, New York',
        whyExcellence:
          'Side light carves faces and hands from deep shadow inside a shallow box—high contrast, but each head keeps its own readable light shape. Daumier simplifies legs and luggage so value attention stays on nursing mother, sleeper, and watcher. Selective contrast is value structure in the service of story.',
        imageUrl: artImage('daumier-third-class-carriage.jpg'),
        imageAlt: 'Daumier, The Third-Class Carriage',
        credit: 'Google Art Project / Met Museum; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Honor%C3%A9_Daumier_-_The_Third-Class_Carriage_-_Google_Art_Project.jpg',
      },
    ],
  },
  {
    criterion: 'Color relationships',
    slug: slugForCriterion('Color relationships'),
    tagline: 'How hues relate—temperature, harmony, and contrast across the canvas.',
    intro:
      'Color excellence is not “more saturated”—it is relationships: warm against cool, complements that neutralize mud, repeated intervals that tie distant areas together.',
    examples: [
      {
        workTitle: 'Impression, Sunrise',
        artist: 'Claude Monet',
        year: '1872',
        medium: 'Oil on canvas',
        collection: 'Musée Marmottan Monet, Paris',
        whyExcellence:
          'The orange sun and its reflection vibrate against blue-gray water and mist—simultaneous contrast makes both feel brighter than they are. Monet keeps the palette disciplined: a narrow chord of oranges, blue-grays, and muted greens so the whole harbor shares one light family. Study how he resists over-modeling; color relationships carry atmosphere.',
        imageUrl: artImage('monet-impression-sunrise.jpg'),
        imageAlt: 'Monet, Impression, Sunrise',
        credit: 'Public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Monet_-_Impression%2C_Sunrise.jpg',
      },
      {
        workTitle: 'Bal du moulin de la Galette',
        artist: 'Pierre-Auguste Renoir',
        year: '1876',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        whyExcellence:
          'Dappled shade breaks into patches of complementary blues and oranges; figures cohere because hat bands, faces, and tablecloths repeat those hues at different scales. Warm flesh notes advance while cooler violets in shadow knit the crowd. Renoir shows how broken color can still feel unified when intervals repeat across the field.',
        imageUrl: artImage('renoir-moulin-galette.jpg'),
        imageAlt: 'Renoir, Bal du moulin de la Galette',
        credit: 'Public domain.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir,_Le_Moulin_de_la_Galette.jpg',
      },
    ],
  },
  {
    criterion: 'Drawing and proportion',
    slug: slugForCriterion('Drawing and proportion'),
    tagline: 'Accuracy of form, scale, and spatial relationships in the motif.',
    intro:
      'Drawing here means the underlying structure: proportions, perspective, anatomy or geometry, and how forms occupy space. It can be tight or painterly, but it must convince.',
    examples: [
      {
        workTitle: 'The Ballet Class',
        artist: 'Edgar Degas',
        year: '1871–74',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        whyExcellence:
          'Degas stacks dancers in depth with believable weight on feet and believable foreshortening of limbs. Bodies twist in space without collapsing; the instructor’s seated mass anchors the left while activity scatters right with coherent scale. Even quick passages respect joint logic—drawing that supports motion.',
        imageUrl: artImage('degas-ballet-class.jpg'),
        imageAlt: 'Degas, The Ballet Class',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'The Child’s Bath',
        artist: 'Mary Cassatt',
        year: '1893',
        medium: 'Oil on canvas',
        collection: 'Art Institute of Chicago',
        whyExcellence:
          'The mother’s reach and the child’s foot read with clear foreshortening inside a tilted, shallow space. Hands meet skin with believable scale; the basin and rug establish a believable floor plane. Cassatt’s drawing is soft at the edges but firm in proportion—intimacy without anatomical slippage.',
        imageUrl: artImage('cassatt-childs-bath.jpg'),
        imageAlt: 'Cassatt, The Child’s Bath',
        credit: 'Google Art Project; public domain (PD-old).',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Mary_Cassatt_-_The_Child%27s_Bath_-_Google_Art_Project.jpg',
      },
    ],
  },
  {
    criterion: 'Edge control',
    slug: slugForCriterion('Edge control'),
    tagline: 'Where forms turn hard, soft, or lost—and how that directs attention.',
    intro:
      'Edges are a compositional instrument: sharp accents pin focal points; lost edges weave masses together. Masters vary edge on purpose, not by accident.',
    examples: [
      {
        workTitle: 'The Cradle',
        artist: 'Berthe Morisot',
        year: '1872',
        medium: 'Oil on canvas',
        collection: 'Musée d’Orsay, Paris',
        whyExcellence:
          'The gauze curtain dissolves into atmosphere while the mother’s profile stays relatively crisp—edge contrast tells you where to look without a hard outline around everything. Whites are built with violet shadows and warm highlights so soft edges don’t turn chalky. Morisot uses lost-and-found contour like a veil over drawing.',
        imageUrl: artImage('morisot-cradle.jpg'),
        imageAlt: 'Morisot, The Cradle',
        credit: 'Google Art Project / Musée d’Orsay; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Berthe_Morisot_-_The_Cradle_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'The Gulf Stream',
        artist: 'Winslow Homer',
        year: '1899',
        medium: 'Oil on canvas',
        collection: 'Metropolitan Museum of Art, New York',
        whyExcellence:
          'Distant swells stay relatively smooth and merged; foam and wreckage break into sharp, directional strokes at the crisis zone. Figure and boat edges pop forward because Homer saves harder transitions where danger concentrates. Edge mirrors narrative: calm water loses contour, violent water finds it.',
        imageUrl: artImage('homer-gulf-stream.jpg'),
        imageAlt: 'Homer, The Gulf Stream',
        credit: 'Metropolitan Museum of Art; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Winslow_Homer_-_The_Gulf_Stream_-_Metropolitan_Museum_of_Art.jpg',
      },
    ],
  },
  {
    criterion: 'Brushwork / handling',
    slug: slugForCriterion('Brushwork / handling'),
    tagline: 'The physical trace of paint—scale, direction, and surface energy.',
    intro:
      'Handling reveals decision: long wet strokes versus staccato touches, transparency versus impasto. Coherent brush logic makes the surface feel intentional.',
    examples: [
      {
        workTitle: 'Boulevard Montmartre, Spring',
        artist: 'Camille Pissarro',
        year: '1897',
        medium: 'Oil on canvas',
        collection: 'Courtauld Gallery, London',
        whyExcellence:
          'Pissarro’s brush follows architecture—horizontal balcony lines versus vertical façades—then breaks into staccato marks for carriages and pedestrians. Wet cobblestones get broken vertical reflections that still read as pavement. The handling scales with motif: big streets need broader structure, small figures need livelier ticks.',
        imageUrl: artImage('pissarro-boulevard-montmartre.jpg'),
        imageAlt: 'Pissarro, Boulevard Montmartre, Spring',
        credit: 'Google Art Project; public domain.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Camille_Pissarro_-_Boulevard_Montmartre,_Spring_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'Clematis and Dahlia',
        artist: 'Emil Nolde',
        year: '1940',
        medium: 'Oil on canvas',
        collection: 'National Gallery of Denmark, Copenhagen',
        whyExcellence:
          'Thick, urgent strokes push reds and violets against a dark ground—each petal reads as a wet-on-wet decision, not a filled outline. Notice how he varies pressure: broad loaded passes for flower masses versus thinner dragged edges where forms turn. The surface energy carries the whole; brush scale matches the scale of the blooms.',
        imageUrl: artImage('nolde-prophet.jpg'),
        imageAlt: 'Nolde, Clematis and Dahlia',
        credit: 'National Gallery of Denmark; public domain (artist life+70).',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Emil_Nolde_(1867-1956)_-_Clematis_and_Dahlia_(1940)_-_Oil_on_canvas_-_National_Gallery_of_Denmark.jpg',
      },
    ],
  },
  {
    criterion: 'Unity and variety',
    slug: slugForCriterion('Unity and variety'),
    tagline: 'The whole feels one statement while passages still surprise.',
    intro:
      'Unity without monotony needs repeated shapes, colors, or rhythms plus controlled variation. Too much sameness flattens; too much randomness fractures.',
    examples: [
      {
        workTitle: 'Composition VII',
        artist: 'Wassily Kandinsky',
        year: '1913',
        medium: 'Oil on canvas',
        collection: 'Tretyakov Gallery, Moscow',
        whyExcellence:
          'Angular shards and curves repeat across the canvas so chaos still shares a family of motifs; black lines act like scaffolding, linking busy color islands. Variety lives in hue and direction; unity lives in repeated angle families and linear connectors. Squint: you still sense one turbulent field, not unrelated scraps.',
        imageUrl: artImage('kandinsky-composition-vii.jpg'),
        imageAlt: 'Kandinsky, Composition VII',
        credit: 'Wikimedia Commons (GAC scan); check local copyright term for your jurisdiction.',
        moreInfoUrl: 'https://commons.wikimedia.org/wiki/File:Composition_VII_-_Wassily_Kandinsky,_GAC.jpg',
      },
      {
        workTitle: 'Suprematist Composition: White on White',
        artist: 'Kazimir Malevich',
        year: '1918',
        medium: 'Oil on canvas',
        collection: 'Museum of Modern Art, New York',
        whyExcellence:
          'A tilted white square on an off-white field is unity taken to the limit—then subtle variety appears in temperature shifts and almost imperceptible edges. The painting teaches that “one chord” can still contain hierarchy and motion. For representational painters: borrow the discipline of restraint—how little can change before the whole reads differently?',
        imageUrl: artImage('malevich-white-on-white.jpg'),
        imageAlt: 'Malevich, White on White',
        credit: 'MoMA / Wikimedia Commons; verify rights for your use.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Kazimir_Malevich_-_%27Suprematist_Composition-_White_on_White%27,_oil_on_canvas,_1918,_Museum_of_Modern_Art.jpg',
      },
    ],
  },
  {
    criterion: 'Originality / expressive force',
    slug: slugForCriterion('Originality / expressive force'),
    tagline: 'Distinct voice, risk, and emotional or conceptual pressure in the work.',
    intro:
      'This criterion is about whether the painting feels necessary—personal pressure, bold choices, or a point of view that could not be swapped for a generic solution.',
    examples: [
      {
        workTitle: 'Self-Portrait with Physalis',
        artist: 'Egon Schiele',
        year: '1912',
        medium: 'Oil on wood',
        collection: 'Leopold Museum, Vienna',
        whyExcellence:
          'Schiele’s cropped stance and asymmetrical stare refuse classical poise; sickly greens and pinks on skin are not local color but psychological climate. Fingernails and eyes get harsh accents while cheeks dissolve—expressive force through selective intensity. The image could only be his: distortion in service of interior state, not decoration.',
        imageUrl: artImage('schiele-self-portrait-physalis.jpg'),
        imageAlt: 'Schiele, Self-Portrait with Physalis',
        credit: 'Google Art Project; verify rights for commercial reuse in your region.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Egon_Schiele_-_Self-Portrait_with_Physalis_-_Google_Art_Project.jpg',
      },
      {
        workTitle: 'Street, Berlin',
        artist: 'Ernst Ludwig Kirchner',
        year: '1913',
        medium: 'Oil on canvas',
        collection: 'Museum of Modern Art, New York',
        whyExcellence:
          'Mask-like faces and dagger-like street perspective broadcast urban anxiety; non-naturalistic violets and oranges are chosen for nervous vibration, not description. Kirchner’s carved outlines feel like woodcut transferred to paint—an original synthesis of craft and modern speed. The scene is less “a street” than a psychological weather report.',
        imageUrl: artImage('kirchner-street-berlin.jpg'),
        imageAlt: 'Kirchner, Street, Berlin',
        credit: 'Google Art Project / MoMA; verify rights for your use.',
        moreInfoUrl:
          'https://commons.wikimedia.org/wiki/File:Ernst_Ludwig_Kirchner_-_Berlin_Street_Scene_-_Google_Art_Project.jpg',
      },
    ],
  },
];

const bySlug = new Map<string, CriterionExcellenceEntry>(
  ENTRIES.map((e) => [e.slug, e])
);

const byCriterion = new Map<Criterion, CriterionExcellenceEntry>(
  ENTRIES.map((e) => [e.criterion, e])
);

/** Validate build-time alignment with app criteria order */
function assertCriteriaAligned(): void {
  if (ENTRIES.length !== CRITERIA_ORDER.length) {
    throw new Error('criterionExcellence: expected one entry per CRITERIA_ORDER item');
  }
  for (let i = 0; i < CRITERIA_ORDER.length; i++) {
    if (ENTRIES[i]!.criterion !== CRITERIA_ORDER[i]) {
      throw new Error(`criterionExcellence: order mismatch at index ${i}`);
    }
  }
}

assertCriteriaAligned();

export function learnPathForCriterion(criterion: Criterion): string {
  const e = byCriterion.get(criterion);
  if (!e) throw new Error(`No learn content for criterion: ${criterion}`);
  return `/learn/criterion/${e.slug}`;
}

export function getCriterionLearnEntryBySlug(slug: string | undefined): CriterionExcellenceEntry | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}
