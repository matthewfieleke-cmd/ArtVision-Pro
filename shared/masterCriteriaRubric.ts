import type { StyleKey } from './artists.js';
import { CRITERIA_ORDER, type CriterionLabel } from './criteria.js';

/**
 * Style-specific observable signals for vision critique prompts.
 * Grounds "Master" in techniques associated with the full benchmark roster (including added masters).
 */
export type CriterionRubric = {
  criterion: CriterionLabel;
  /** Short bullets for the model; keep concrete and visually checkable in a photo */
  masterSignals: string[];
};

const REALISM_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition',
    masterSignals: [
      'Frieze or pyramid grouping with clear figure–ground (Courbet, Millet); diagonal narrative pull (Repin); measured spatial depth (Eakins).',
      'Social or moral focus staged through who is centered and who labors (Courbet, Daumier, Millet).',
      'Urban geometry and reflective façades as compositional puzzle—stacked mirrors, signage, and depth cues (Estes, Photorealism).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Big readable masses when squinting; differentiated blacks and earth families (Courbet, Daumier).',
      'Outdoor light that explains form and weight—cool reflected light, warm top light (Repin, Homer, Eakins).',
      'Photorealist clarity: reflections and transparencies parsed into discrete value steps on glass and metal (Estes).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Restrained harmony disciplined by observed light; temperature shifts in greys and neutrals (Eakins, Repin).',
      'Sky vs ground color families stay distinct so figures anchor (Millet, Homer).',
      'Synthetic color in city light—neutrals keyed to chrome, glass, and sky reflection (Estes).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Anatomy and architecture observed with construction underneath (Eakins, Repin).',
      'Graphic clarity of type and posture with few strokes (Daumier); weight and contact read convincingly.',
      'Linear perspective and architectural module held while reflections fracture the view (Estes).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Hard silhouettes where bodies meet sky vs softer internal modeling (Millet, Courbet).',
      'Selective sharpness on hands, faces, and narrative hooks vs atmospheric recession (Homer water, Repin ropes).',
      'Razor transitions between reflection, transparency, and support—edges as optical facts (Estes).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Facture supports description—rough stone, wet water, fabric weight (Courbet, Homer).',
      'Economy: large accurate passages before detail (Homer, Daumier lithographic logic in oil).',
      'Acrylic-friendly layering: crisp passes that preserve earlier information—mechanical precision without visible hesitation (Estes, Photorealism).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating motifs (backs, waves, carriage riders) with controlled variation (Millet, Daumier).',
      'Weather and scale unify figure and setting (Homer); multi-figure clarity without clutter (Repin).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Ordinary life given moral or pictorial weight without sentimentality (Millet, Courbet).',
      'American isolation or endurance as clear voice (Homer); unflinching observation (Eakins).',
      'Modern urban stillness—banal infrastructure made riveting through optical exactitude (Estes).',
    ],
  },
];

const IMPRESSIONISM_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition',
    masterSignals: [
      'Casual crop, off-center emphasis, modern life framing (Degas, Cassatt, Morisot).',
      'Horizon and water geometry carry the design (Monet, Pissarro); leisure clusters (Renoir).',
      'Modern architecture as calm stage; explosive transient motif (splash, figure, splash) as timed event (Hockney).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Few value keys; light as the true subject—still reads when squinting (Monet).',
      'High-key interiors with soft envelope of light (Morisot, Cassatt).',
      'Flat sun-bleached planes vs one high-contrast “event” area—value reserved for the fleeting moment (Hockney).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Broken color and complements for vibration; simultaneous contrast (Monet, Pissarro).',
      'Domestic palettes: warm skin, cool surround, restrained accents (Cassatt, Morisot, Renoir).',
      'Opaque acrylic flats for architecture and water body; high-chroma accents where motion demands (Hockney).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Drawing dissolved into sensation but structure underneath figures (Degas, Morisot).',
      'Tender observation of gesture without stiff outline (Cassatt, Renoir).',
      'Pool geometry and diving board read as simple vectors; figure and splash as calligraphic incident (Hockney).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Lost edges in light, found edges in silhouette and contour (Monet, Pissarro).',
      'Pastel-like softness vs decisive contour where the story needs it (Cassatt, Degas).',
      'Crisp building edges vs splintered splash edges—scale of edge matches scale of motion (Hockney).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Separate touches that fuse optically at distance (Monet, Pissarro).',
      'Feathered veils and scumble for atmosphere (Morisot); brisk figure notation (Degas).',
      'Broad blocked-in fields plus patient small-brush notation for turbulence—acrylic supports both speeds (Hockney).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeated brush logic across the canvas; accents placed sparingly (Monet series discipline).',
      'Figure and setting share one light-world (Renoir ball scenes; Cassatt domestic space).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Optical truth as argument—why this moment, this weather (Monet).',
      'Intimacy and modern life without anecdotal clutter (Cassatt, Morisot).',
      'Contemporary leisure and light—Impressionist “instant” updated with California clarity and wit (Hockney).',
    ],
  },
];

const EXPRESSIONISM_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition',
    masterSignals: [
      'Distortion and diagonal stress as psychological fact (Munch, Kirchner).',
      'Compressed monumentality and stillness (Modersohn-Becker) vs diagrammatic panic (Munch).',
      'Central iconic form—skull, mask, totem—anchoring scribal energy and peripheral marks (Basquiat, Neo-Expressionism).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Non-naturalistic value still serves hierarchy and mood (Munch, Nolde).',
      'High-contrast graphic clarity in compressed space (Schiele, Kirchner).',
      'Graphic punch from flat color fields vs scraped, worked passages—value as stage for graffiti logic (Basquiat).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Symbolic or feverish chords—chromatic pressure without total mud (Nolde, Kirchner).',
      'Earthy, simplified flesh and ground (Modersohn-Becker) vs acidic urban pairs (Kirchner).',
      'Street primaries and industrial hues; color as shout and label—layered but not muddied (Basquiat).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Deliberate elongation, hinge joints, exposed structure (Schiele, Modersohn-Becker).',
      'Wavy perspective and simplified masses as inner state (Munch).',
      'Primal silhouette (skull) plus improvised anatomy and signage—drawing that collapses icon and doodle (Basquiat).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Nervous contour vs blunt blocked shapes—chosen for anxiety or weight (Schiele, Nolde).',
      'Carved outlines around figures in street scenes (Kirchner).',
      'Spray softness vs oil-stick scrape vs acrylic flat—edge type signals layer order (Basquiat).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Scratch, drag, stain—surface matches emotional temperature (Kirchner, Nolde).',
      'Heavy simplicity and tactile earth (Modersohn-Becker); graphic wipe in Munch skies.',
      'Fast-drying ground (acrylic) for immediate overwrites—oil stick and spray on top without dirtying underlayers (Basquiat).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating angularity or curves as motif across the canvas (Kirchner, Kandinsky early).',
      'One dominant emotional temperature with controlled counter-accents (Munch).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Inner life made visible through color and form, not illustration (Munch, Schiele).',
      'Bold reduction and quiet intensity (Modersohn-Becker); raw chroma as voice (Nolde).',
      'Urban myth-making—words, symbols, and crowned heads as contemporary hieroglyph (Basquiat).',
    ],
  },
];

const ABSTRACT_ART_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition',
    masterSignals: [
      'Grid equilibrium and dynamic asymmetry (Mondrian); stacked intervals (Rothko).',
      'All-over rhythm without a single “hero” motif (Pollock); biomorphic placement (Miró, Kandinsky).',
      'Open field stained with floating shapes—figure and ground merge through absorption (Frankenthaler, soak-stain).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Intervals of white, grey, and black as active space (Mondrian, Malevich).',
      'Close-value fields that breathe—luminosity from layering (Rothko).',
      'Light seems to emanate from within the weave—value carried by stain density, not only surface paint (Frankenthaler).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Few hues, high stakes per plane—primaries as structural events (Mondrian).',
      'Color chords as non-objective “sound” (Kandinsky); restrained accents in Miró’s signs.',
      'Diluted acrylic pools: temperature shifts where pigments meet and bleed in raw canvas (Frankenthaler).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Internal proportion of intervals, bars, and shapes—not depiction (Mondrian, Malevich).',
      'Calligraphic drawing merged with field (Pollock, Miró).',
      'Soft contours born from liquid flow—drawing implied by tide-lines of stain, not contour first (Frankenthaler).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Knife-sharp junctions vs matte correction (Mondrian); feathered horizontals (Rothko).',
      'Linear skeins as edge and texture (Pollock).',
      'Feathered stain edges vs untouched canvas—edge as soak front (Frankenthaler).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Hidden brushing in veils (Rothko); visible drip choreography (Pollock).',
      'Flat discipline and sanded revision (Mondrian); graphic sign-painting clarity (Miró, Malevich).',
      'Thin fluid application—brush or pour—where body and soak time are the “hand” (Frankenthaler).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating modules with slight variation—bars, drips, stacks (Mondrian, Pollock).',
      'Whole canvas obeys one structural law (Malevich square; Rothko stacks).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Reduction as radical invention (Malevich); spiritual scale without illustration (Rothko).',
      'Play and primitive signs as modern voice (Miró); bodily scale of mark (Pollock).',
      'Inventing a new optical softness—stain as radical alternative to impasto monument (Frankenthaler).',
    ],
  },
];

const BY_STYLE: Record<StyleKey, CriterionRubric[]> = {
  Realism: REALISM_RUBRIC,
  Impressionism: IMPRESSIONISM_RUBRIC,
  Expressionism: EXPRESSIONISM_RUBRIC,
  'Abstract Art': ABSTRACT_ART_RUBRIC,
};

/** Compact text block for OpenAI system prompt (per declared style). */
export function formatRubricForPrompt(style: string): string {
  const key = style as StyleKey;
  const rows = BY_STYLE[key as StyleKey];
  if (!rows) return '';
  return rows
    .map((r) => {
      const bullets = r.masterSignals.map((s) => `  - ${s}`).join('\n');
      return `${r.criterion}:\n${bullets}`;
    })
    .join('\n\n');
}

/** Ensures rubric order matches CRITERIA_ORDER for a given style */
function assertRubricOrder(): void {
  for (const style of Object.keys(BY_STYLE) as StyleKey[]) {
    const rubric = BY_STYLE[style];
    if (rubric.length !== CRITERIA_ORDER.length) throw new Error(`Rubric length mismatch for ${style}`);
    for (let i = 0; i < CRITERIA_ORDER.length; i++) {
      if (rubric[i]!.criterion !== CRITERIA_ORDER[i]) {
        throw new Error(`Rubric criterion order mismatch at ${style} index ${i}`);
      }
    }
  }
}

assertRubricOrder();
