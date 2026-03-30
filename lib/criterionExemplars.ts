import { MASTER_ENTRIES } from '../src/data/masterCatalog.js';
import type { StyleKey } from '../shared/artists.js';
import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';

type Exemplar = {
  artist: string;
  workTitle: string;
  medium?: string;
  why: string;
};

const EXEMPLARS: Record<StyleKey, Partial<Record<CriterionLabel, Exemplar[]>>> = {
  Realism: {
    'Composition and shape structure': [
      {
        artist: 'Gustave Courbet',
        workTitle: 'A Burial at Ornans',
        medium: 'Oil on canvas',
        why: 'Frieze-like massing and collective figure-ground structure stay lucid at scale.',
      },
      {
        artist: 'Ilya Repin',
        workTitle: 'Barge Haulers on the Volga',
        medium: 'Oil on canvas',
        why: 'Diagonal narrative pull with a clear counter-accent organizes a complex scene.',
      },
    ],
    'Value and light structure': [
      {
        artist: 'Jean-François Millet',
        workTitle: 'The Gleaners',
        medium: 'Oil on canvas',
        why: 'Large light-dark masses remain readable under a squint while carrying mood.',
      },
      {
        artist: 'Honoré Daumier',
        workTitle: 'The Third-Class Carriage',
        medium: 'Oil on canvas',
        why: 'Confined chiaroscuro stays selective and legible without flattening the forms.',
      },
    ],
    'Color relationships': [
      {
        artist: 'Johannes Vermeer',
        workTitle: 'Girl with a Pearl Earring',
        medium: 'Oil on canvas',
        why: 'A restrained chord of blues, creams, and flesh temperatures feels exact and luminous.',
      },
      {
        artist: 'John Singer Sargent',
        workTitle: 'Madame X',
        medium: 'Oil on canvas',
        why: 'Cool flesh, black satin, and selective accents create high-fashion chromatic authority.',
      },
    ],
    'Drawing, proportion, and spatial form': [
      {
        artist: 'Thomas Eakins',
        workTitle: 'Wrestlers',
        medium: 'Oil on canvas',
        why: 'Anatomy, overlap, and contact read with rigorous structural clarity.',
      },
      {
        artist: 'Diego Velázquez',
        workTitle: 'Las Meninas',
        medium: 'Oil on canvas',
        why: 'Multi-figure spatial drawing remains coherent across a complex reflexive room.',
      },
    ],
    'Edge and focus control': [
      {
        artist: 'Winslow Homer',
        workTitle: 'The Gulf Stream',
        medium: 'Oil on canvas',
        why: 'Hard and soft edges shift exactly where danger and narrative emphasis need them.',
      },
      {
        artist: 'Johannes Vermeer',
        workTitle: 'Girl with a Pearl Earring',
        medium: 'Oil on canvas',
        why: 'Soft flesh transitions and crisp jewel accents establish refined hierarchy.',
      },
    ],
    'Surface and medium handling': [
      {
        artist: 'Gustave Courbet',
        workTitle: 'A Burial at Ornans',
        medium: 'Oil on canvas',
        why: 'Facture supports weight and material fact without slipping into noise.',
      },
      {
        artist: 'John Singer Sargent',
        workTitle: 'Madame X',
        medium: 'Oil on canvas',
        why: 'Bold satin and flesh passages stay decisive, selective, and alive.',
      },
    ],
    'Intent and necessity': [
      {
        artist: 'Gustave Courbet',
        workTitle: 'A Burial at Ornans',
        medium: 'Oil on canvas',
        why: 'Formal choices feel inseparable from the social and human stakes of the subject.',
      },
      {
        artist: 'Diego Velázquez',
        workTitle: 'Las Meninas',
        medium: 'Oil on canvas',
        why: 'Every interval and focal relation serves one reflexive pictorial argument.',
      },
    ],
    'Presence, point of view, and human force': [
      {
        artist: 'Winslow Homer',
        workTitle: 'The Gulf Stream',
        medium: 'Oil on canvas',
        why: 'Atmosphere, danger, and human vulnerability fuse into one unmistakable viewpoint.',
      },
      {
        artist: 'Francisco Goya',
        workTitle: 'The Third of May 1808',
        medium: 'Oil on canvas',
        why: 'Light, stance, and staging carry moral and psychic force beyond mere description.',
      },
    ],
  },
  Impressionism: {
    'Composition and shape structure': [
      {
        artist: 'Edgar Degas',
        workTitle: 'The Ballet Class',
        medium: 'Oil on canvas',
        why: 'Cropping and distributed figures feel casual yet highly controlled.',
      },
      {
        artist: 'Claude Monet',
        workTitle: 'Water Lilies',
        medium: 'Oil on canvas',
        why: 'Open-field placement still sustains rhythm and interval.',
      },
    ],
    'Value and light structure': [
      {
        artist: 'Claude Monet',
        workTitle: 'Impression, Sunrise',
        medium: 'Oil on canvas',
        why: 'Light is the subject, but the value pattern still holds under a squint.',
      },
      {
        artist: 'Berthe Morisot',
        workTitle: 'The Cradle',
        medium: 'Oil on canvas',
        why: 'High-key light remains coherent without collapsing form.',
      },
    ],
    'Color relationships': [
      {
        artist: 'Claude Monet',
        workTitle: 'Impression, Sunrise',
        medium: 'Oil on canvas',
        why: 'Broken complements and a narrow palette create atmospheric vibration.',
      },
      {
        artist: 'Pierre-Auguste Renoir',
        workTitle: 'Bal du moulin de la Galette',
        medium: 'Oil on canvas',
        why: 'Warm and cool intervals repeat across the field to unify a busy scene.',
      },
    ],
    'Drawing, proportion, and spatial form': [
      {
        artist: 'Edgar Degas',
        workTitle: 'The Ballet Class',
        medium: 'Pastel / drawing practice benchmark',
        why: 'Degas is a strong internal benchmark for draftsmanship inside a softer, graphic medium logic.',
      },
      {
        artist: 'Edgar Degas',
        workTitle: 'The Ballet Class',
        medium: 'Oil on canvas',
        why: 'Foreshortening, gesture, and group spacing stay accountable inside a loose touch.',
      },
      {
        artist: 'Mary Cassatt',
        workTitle: 'The Child’s Bath',
        medium: 'Oil on canvas',
        why: 'Soft edges do not weaken anatomical or spatial conviction.',
      },
    ],
    'Edge and focus control': [
      {
        artist: 'Berthe Morisot',
        workTitle: 'The Cradle',
        medium: 'Pastel / watercolor-adjacent softness benchmark',
        why: 'A useful benchmark when softness must still direct attention without deadening the image.',
      },
      {
        artist: 'Winslow Homer',
        workTitle: 'The Gulf Stream',
        medium: 'Oil on canvas',
        why: 'A useful cross-style edge benchmark: danger sharpens while atmosphere softens.',
      },
      {
        artist: 'Berthe Morisot',
        workTitle: 'The Cradle',
        medium: 'Oil on canvas',
        why: 'Lost-and-found contour directs attention without academic hardening.',
      },
    ],
    'Surface and medium handling': [
      {
        artist: 'Claude Monet',
        workTitle: 'Impression, Sunrise',
        medium: 'Watercolor-adjacent wash and atmosphere benchmark',
        why: 'A useful benchmark for fluid, light-led surface handling where atmosphere should stay breathable.',
      },
      {
        artist: 'Camille Pissarro',
        workTitle: 'Boulevard Montmartre, Spring',
        medium: 'Oil on canvas',
        why: 'Touch scale changes with motif while keeping the whole surface coherent.',
      },
      {
        artist: 'Claude Monet',
        workTitle: 'Water Lilies',
        medium: 'Oil on canvas',
        why: 'Surface rhythm holds atmosphere without turning into generic broken color.',
      },
    ],
    'Intent and necessity': [
      {
        artist: 'Claude Monet',
        workTitle: 'Impression, Sunrise',
        medium: 'Oil on canvas',
        why: 'Light, crop, color, and touch all answer to one sensation.',
      },
      {
        artist: 'Paul Cézanne',
        workTitle: 'Mont Sainte-Victoire',
        medium: 'Oil on canvas',
        why: 'Every patch-like decision serves one constructive pictorial logic.',
      },
    ],
    'Presence, point of view, and human force': [
      {
        artist: 'Berthe Morisot',
        workTitle: 'The Cradle',
        medium: 'Oil on canvas',
        why: 'Intimacy and atmosphere are memorable without theatrical exaggeration.',
      },
      {
        artist: 'Claude Monet',
        workTitle: 'Impression, Sunrise',
        medium: 'Oil on canvas',
        why: 'A distinct lived sensation survives even open drawing and value compression.',
      },
    ],
  },
  Expressionism: {
    'Composition and shape structure': [
      {
        artist: 'Edvard Munch',
        workTitle: 'The Scream',
        medium: 'Oil, tempera, pastel and crayon on cardboard',
        why: 'Distortion and directional stress operate as a single psychological design.',
      },
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Directional stroke rhythms structure the whole image while sustaining mood.',
      },
    ],
    'Value and light structure': [
      {
        artist: 'Edvard Munch',
        workTitle: 'The Scream',
        medium: 'Oil, tempera, pastel and crayon on cardboard',
        why: 'Non-naturalistic value still creates a legible hierarchy of pressure and event.',
      },
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Night luminosity remains organized rather than muddy.',
      },
    ],
    'Color relationships': [
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Blue-green and yellow opposition vibrates without losing coherence.',
      },
      {
        artist: 'Wassily Kandinsky',
        workTitle: 'Composition VII',
        medium: 'Oil on canvas',
        why: 'Color reads as forceful structural relation, not decorative scatter.',
      },
    ],
    'Drawing, proportion, and spatial form': [
      {
        artist: 'Egon Schiele',
        workTitle: 'Seated Woman with Bent Knee',
        medium: 'Drawing benchmark',
        why: 'A strong benchmark for intentional distortion, line authority, and structural drawing in dry media logic.',
      },
      {
        artist: 'Egon Schiele',
        workTitle: 'Seated Woman with Bent Knee',
        medium: 'Oil on canvas',
        why: 'Deliberate distortion still feels anatomically authored, not inept.',
      },
      {
        artist: 'Paula Modersohn-Becker',
        workTitle: 'Self-Portrait on Her Sixth Wedding Anniversary',
        medium: 'Oil on canvas',
        why: 'Simplification of form preserves conviction and monumentality.',
      },
    ],
    'Edge and focus control': [
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Impasto halos and merging stroke fields create deliberate focus shifts.',
      },
      {
        artist: 'Ernst Ludwig Kirchner',
        workTitle: 'Street, Berlin',
        medium: 'Oil on canvas',
        why: 'Carved outlines and blunt blocked shapes sharpen psychic stress.',
      },
    ],
    'Surface and medium handling': [
      {
        artist: 'Edvard Munch',
        workTitle: 'The Scream',
        medium: 'Pastel and crayon benchmark',
        why: 'A useful benchmark when powdery or graphic media must stay emotionally charged without losing structure.',
      },
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Stroke rhythm becomes structure and feeling at once.',
      },
      {
        artist: 'Jean-Michel Basquiat',
        workTitle: 'Untitled (Skull)',
        medium: 'Acrylic, oilstick, and spray paint on canvas',
        why: 'Layer order and material variety stay legible inside aggressive handling.',
      },
    ],
    'Intent and necessity': [
      {
        artist: 'Edvard Munch',
        workTitle: 'The Scream',
        medium: 'Oil, tempera, pastel and crayon on cardboard',
        why: 'Every distortion and color choice belongs to one emotional proposition.',
      },
      {
        artist: 'Vincent van Gogh',
        workTitle: 'Starry Night Over the Rhône',
        medium: 'Oil on canvas',
        why: 'Stroke, light, and motif handling all serve a unified mood.',
      },
    ],
    'Presence, point of view, and human force': [
      {
        artist: 'Edvard Munch',
        workTitle: 'The Scream',
        medium: 'Oil, tempera, pastel and crayon on cardboard',
        why: 'The work feels unmistakably inhabited by a single charged consciousness.',
      },
      {
        artist: 'Jean-Michel Basquiat',
        workTitle: 'Untitled (Skull)',
        medium: 'Acrylic, oilstick, and spray paint on canvas',
        why: 'Graphic violence and iconography become a distinct authored pressure.',
      },
    ],
  },
  'Abstract Art': {
    'Composition and shape structure': [
      {
        artist: 'Piet Mondrian',
        workTitle: 'Composition with Red, Blue, and Yellow',
        medium: 'Oil on canvas',
        why: 'Intervals and asymmetry remain exact without obvious pictorial subject matter.',
      },
      {
        artist: 'Helen Frankenthaler',
        workTitle: 'Mountains and Sea',
        medium: 'Oil on unprimed canvas',
        why: 'Open-field placement and floating shape families feel structurally inevitable.',
      },
    ],
    'Value and light structure': [
      {
        artist: 'Mark Rothko',
        workTitle: 'No. 61 (Rust and Blue)',
        medium: 'Oil on canvas',
        why: 'Close-value fields breathe through layered luminosity.',
      },
      {
        artist: 'Kazimir Malevich',
        workTitle: 'Black Square',
        medium: 'Oil on linen',
        why: 'Value intervals themselves become the structure.',
      },
    ],
    'Color relationships': [
      {
        artist: 'Wassily Kandinsky',
        workTitle: 'Composition VII',
        medium: 'Oil on canvas',
        why: 'Color reads as non-objective structural tension with high stakes per relation.',
      },
      {
        artist: 'Robert Delaunay',
        workTitle: 'Simultaneous Windows on the City',
        medium: 'Oil on canvas',
        why: 'Simultaneous contrast and prismatic segmentation create ordered vibration.',
      },
    ],
    'Drawing, proportion, and spatial form': [
      {
        artist: 'Piet Mondrian',
        workTitle: 'Composition with Red, Blue, and Yellow',
        medium: 'Oil on canvas',
        why: 'Proportion and interval replace depiction while remaining exact.',
      },
      {
        artist: 'Helen Frankenthaler',
        workTitle: 'Mountains and Sea',
        medium: 'Oil on unprimed canvas',
        why: 'Soft contour and tide-line drawing imply structure without literal outline.',
      },
    ],
    'Edge and focus control': [
      {
        artist: 'Piet Mondrian',
        workTitle: 'Composition with Red, Blue, and Yellow',
        medium: 'Oil on canvas',
        why: 'Edge junctions are exact structural events.',
      },
      {
        artist: 'Mark Rothko',
        workTitle: 'No. 61 (Rust and Blue)',
        medium: 'Oil on canvas',
        why: 'Feathered color boundaries create atmospheric focus without contour.',
      },
    ],
    'Surface and medium handling': [
      {
        artist: 'Jackson Pollock',
        workTitle: 'Autumn Rhythm (Number 30)',
        medium: 'Enamel on canvas',
        why: 'Surface choreography remains legible across an all-over field.',
      },
      {
        artist: 'Helen Frankenthaler',
        workTitle: 'Mountains and Sea',
        medium: 'Oil on unprimed canvas',
        why: 'Soak-stain handling makes medium behavior itself the image logic.',
      },
    ],
    'Intent and necessity': [
      {
        artist: 'Piet Mondrian',
        workTitle: 'Composition with Red, Blue, and Yellow',
        medium: 'Oil on canvas',
        why: 'Every interval and color choice answers to one pictorial law.',
      },
      {
        artist: 'Mark Rothko',
        workTitle: 'No. 61 (Rust and Blue)',
        medium: 'Oil on canvas',
        why: 'Atmosphere and structure feel inseparable rather than decorative.',
      },
    ],
    'Presence, point of view, and human force': [
      {
        artist: 'Mark Rothko',
        workTitle: 'No. 61 (Rust and Blue)',
        medium: 'Oil on canvas',
        why: 'Reduction still carries a felt human pressure and scale of attention.',
      },
      {
        artist: 'Jackson Pollock',
        workTitle: 'Autumn Rhythm (Number 30)',
        medium: 'Enamel on canvas',
        why: 'Surface, rhythm, and bodily trace merge into a distinct authored presence.',
      },
    ],
  },
};

function hasReliableImage(style: StyleKey, artist: string, workTitle: string): boolean {
  const entry = MASTER_ENTRIES.find((item) => item.style === style && item.displayName === artist);
  if (!entry) return false;
  return entry.figures.some((figure) => figure.workTitle === workTitle && typeof figure.imageUrl === 'string');
}

function formatExemplar(exemplar: Exemplar): string {
  return `${exemplar.artist}, ${exemplar.workTitle}${exemplar.medium ? ` (${exemplar.medium})` : ''} — ${exemplar.why}`;
}

function normalizeMedium(medium: string | undefined): string {
  return (medium ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mediumLooksCompatible(exemplarMedium: string | undefined, requestedMedium: string | undefined): boolean {
  const exemplar = normalizeMedium(exemplarMedium);
  const requested = normalizeMedium(requestedMedium);
  if (!requested || !exemplar) return false;
  if (requested === exemplar) return true;
  if (requested === 'oil on canvas' && exemplar.includes('oil')) return true;
  if (requested === 'watercolor' && exemplar.includes('watercolor')) return true;
  if (requested === 'drawing' && (exemplar.includes('drawing') || exemplar.includes('graphite') || exemplar.includes('charcoal') || exemplar.includes('crayon') || exemplar.includes('pastel'))) return true;
  if (requested === 'pastel' && exemplar.includes('pastel')) return true;
  if (requested === 'acrylic' && exemplar.includes('acrylic')) return true;
  return false;
}

export function getCriterionExemplarBlock(style: StyleKey, medium?: string): string {
  const rows = CRITERIA_ORDER.map((criterion) => {
    const allItems = (EXEMPLARS[style][criterion] ?? []).filter((item) =>
      hasReliableImage(style, item.artist, item.workTitle)
    );
    const mediumMatched = allItems.filter((item) => mediumLooksCompatible(item.medium, medium));
    const items = mediumMatched.length > 0 ? mediumMatched : allItems;
    if (!items.length) return null;
    const formatted = items.map((item) => `  - ${formatExemplar(item)}`).join('\n');
    return `${criterion}:\n${formatted}`;
  }).filter((row): row is string => Boolean(row));
  return rows.join('\n\n');
}
