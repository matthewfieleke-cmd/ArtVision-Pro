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
      'Intimate head-and-shoulders or single-figure focus with fabric and jewelry as abstract anchors (Vermeer).',
      'Mirror, doorway, and multi-figure space as a reflexive puzzle—who sees whom (Velázquez, Las Meninas).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Big readable masses when squinting; differentiated blacks and earth families (Courbet, Daumier).',
      'Outdoor light that explains form and weight—cool reflected light, warm top light (Repin, Homer, Eakins).',
      'Photorealist clarity: reflections and transparencies parsed into discrete value steps on glass and metal (Estes).',
      'Controlled spotlight and deep shadow as moral staging—one lit body against compressed dark (Goya, Third of May).',
      'Luminous dissolution in mist and sunset while narrative silhouette holds (Turner, marine light).',
      'High-fashion contrast: porcelain flesh, black satin, and background recession in few steps (Sargent, Madame X).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Restrained harmony disciplined by observed light; temperature shifts in greys and neutrals (Eakins, Repin).',
      'Sky vs ground color families stay distinct so figures anchor (Millet, Homer).',
      'Synthetic color in city light—neutrals keyed to chrome, glass, and sky reflection (Estes).',
      'Limited chord keyed to headscarf, flesh, and pearl—cool shadow in whites and blues (Vermeer).',
      'Velázquez greys and blacks unify court dress while isolated reds and creams signal rank (Las Meninas).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Anatomy and architecture observed with construction underneath (Eakins, Repin).',
      'Graphic clarity of type and posture with few strokes (Daumier); weight and contact read convincingly.',
      'Linear perspective and architectural module held while reflections fracture the view (Estes).',
      'Portrait likeness with subtle asymmetry and sculptural turning of the head (Vermeer).',
      'Spatial drawing across servants, royals, dog, and canvas-within-canvas (Velázquez).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Hard silhouettes where bodies meet sky vs softer internal modeling (Millet, Courbet).',
      'Selective sharpness on hands, faces, and narrative hooks vs atmospheric recession (Homer water, Repin ropes).',
      'Razor transitions between reflection, transparency, and support—edges as optical facts (Estes).',
      'Soft lost edges in flesh and fabric vs crisp jewelry or collar accents (Vermeer).',
      'Hard contour on victim’s shirt vs painterly dissolution in crowd and hill (Goya).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Facture supports description—rough stone, wet water, fabric weight (Courbet, Homer).',
      'Economy: large accurate passages before detail (Homer, Daumier lithographic logic in oil).',
      'Acrylic-friendly layering: crisp passes that preserve earlier information—mechanical precision without visible hesitation (Estes, Photorealism).',
      'Thin translucent darks and pointillé highlights in restrained passages (Vermeer).',
      'Velázquez’s confident shorthand on secondary figures vs measured focus on Infanta (Las Meninas).',
      'Sweeping atmospheric scumble and scraped light on water and sky (Turner).',
      'Bold wet passages on satin and skin with decisive silhouette (Sargent).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating motifs (backs, waves, carriage riders) with controlled variation (Millet, Daumier).',
      'Weather and scale unify figure and setting (Homer); multi-figure clarity without clutter (Repin).',
      'Court ensemble as rhythm of verticals and intervals—dog, dwarf, door as counterbeats (Velázquez).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Ordinary life given moral or pictorial weight without sentimentality (Millet, Courbet).',
      'American isolation or endurance as clear voice (Homer); unflinching observation (Eakins).',
      'Modern urban stillness—banal infrastructure made riveting through optical exactitude (Estes).',
      'Private gaze and material modesty elevated to iconic presence (Vermeer).',
      'Execution scene as modern history painting—pity without theatrical prettiness (Goya).',
      'Society portrait as psychological dare—beauty and scandal in one silhouette (Sargent).',
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
      'Figures distributed as color notes across horizontal band—Sunday leisure as frieze (Seurat, Grande Jatte).',
      'Mountain and architecture built from shifting planes—Cézanne’s constructive stroke holds space without single vanishing theatrics.',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Few value keys; light as the true subject—still reads when squinting (Monet).',
      'High-key interiors with soft envelope of light (Morisot, Cassatt).',
      'Flat sun-bleached planes vs one high-contrast “event” area—value reserved for the fleeting moment (Hockney).',
      'Pointillist dots aggregate into shadow under trees and grass—value from optical mixture, not blended mud (Seurat).',
      'Parallel planes of warm and cool grey-green build mass on Mont Sainte-Victoire (Cézanne).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Broken color and complements for vibration; simultaneous contrast (Monet, Pissarro).',
      'Domestic palettes: warm skin, cool surround, restrained accents (Cassatt, Morisot, Renoir).',
      'Opaque acrylic flats for architecture and water body; high-chroma accents where motion demands (Hockney).',
      'Complementary pairs in grass, shadow, and water—science-minded harmony at a distance (Seurat).',
      'Earth greens, violets, and ochres modulate one mountain motif (Cézanne).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Drawing dissolved into sensation but structure underneath figures (Degas, Morisot).',
      'Tender observation of gesture without stiff outline (Cassatt, Renoir).',
      'Pool geometry and diving board read as simple vectors; figure and splash as calligraphic incident (Hockney).',
      'Silhouette and posture read at distance; individual backs and hats still accountable (Seurat).',
      'Underlying geometry of slopes and rooflines even when contour wobbles (Cézanne).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Lost edges in light, found edges in silhouette and contour (Monet, Pissarro).',
      'Pastel-like softness vs decisive contour where the story needs it (Cassatt, Degas).',
      'Crisp building edges vs splintered splash edges—scale of edge matches scale of motion (Hockney).',
      'Thousands of micro-edges from dots aggregate into soft boundaries (Seurat).',
      'Contour “searches” and color boundaries replace ink line (Cézanne).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Separate touches that fuse optically at distance (Monet, Pissarro).',
      'Feathered veils and scumble for atmosphere (Morisot); brisk figure notation (Degas).',
      'Broad blocked-in fields plus patient small-brush notation for turbulence—acrylic supports both speeds (Hockney).',
      'Consistent dot or dash module—discipline of touch as style (Seurat).',
      'Patch-like parallel strokes that construct plane rather than illustrate texture (Cézanne).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeated brush logic across the canvas; accents placed sparingly (Monet series discipline).',
      'Figure and setting share one light-world (Renoir ball scenes; Cassatt domestic space).',
      'Umbrellas, skirts, and dogs repeat intervals across the lawn without identical repetition (Seurat).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Optical truth as argument—why this moment, this weather (Monet).',
      'Intimacy and modern life without anecdotal clutter (Cassatt, Morisot).',
      'Contemporary leisure and light—Impressionist “instant” updated with California clarity and wit (Hockney).',
      'Neo-Impressionist rigor—leisure made laboratory (Seurat).',
      'From Impressionist light toward modern structure—mountain as permanent experiment (Cézanne).',
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
      'Vortex sky and village—swirling directional strokes as emotional weather (van Gogh, Starry Night).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Non-naturalistic value still serves hierarchy and mood (Munch, Nolde).',
      'High-contrast graphic clarity in compressed space (Schiele, Kirchner).',
      'Graphic punch from flat color fields vs scraped, worked passages—value as stage for graffiti logic (Basquiat).',
      'Moon and stars as bright accents against deep blue-green recession—night as pulsing field (van Gogh).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Symbolic or feverish chords—chromatic pressure without total mud (Nolde, Kirchner).',
      'Earthy, simplified flesh and ground (Modersohn-Becker) vs acidic urban pairs (Kirchner).',
      'Street primaries and industrial hues; color as shout and label—layered but not muddied (Basquiat).',
      'Cobalt, viridian, and yellow strokes in rhythmic opposition—color as vibration (van Gogh).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Deliberate elongation, hinge joints, exposed structure (Schiele, Modersohn-Becker).',
      'Wavy perspective and simplified masses as inner state (Munch).',
      'Primal silhouette (skull) plus improvised anatomy and signage—drawing that collapses icon and doodle (Basquiat).',
      'Church spire and cypress as vertical anchors inside a rolling sky (van Gogh).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Nervous contour vs blunt blocked shapes—chosen for anxiety or weight (Schiele, Nolde).',
      'Carved outlines around figures in street scenes (Kirchner).',
      'Spray softness vs oil-stick scrape vs acrylic flat—edge type signals layer order (Basquiat).',
      'Impasto ridges create sharp halos; sky and land merge in stroke direction (van Gogh).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Scratch, drag, stain—surface matches emotional temperature (Kirchner, Nolde).',
      'Heavy simplicity and tactile earth (Modersohn-Becker); graphic wipe in Munch skies.',
      'Fast-drying ground (acrylic) for immediate overwrites—oil stick and spray on top without dirtying underlayers (Basquiat).',
      'Parallel and spiral strokes follow form and feeling—energy made visible (van Gogh).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating angularity or curves as motif across the canvas (Kirchner, Kandinsky early).',
      'One dominant emotional temperature with controlled counter-accents (Munch).',
      'Whole sky obeys one stroke grammar while village stays comparatively still (van Gogh).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Inner life made visible through color and form, not illustration (Munch, Schiele).',
      'Bold reduction and quiet intensity (Modersohn-Becker); raw chroma as voice (Nolde).',
      'Urban myth-making—words, symbols, and crowned heads as contemporary hieroglyph (Basquiat).',
      'Landscape as spiritual agitation—post-Impressionist path to Expressionism (van Gogh).',
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
      'Couple as icon within decorative field—gold and pattern flatten and elevate simultaneously (Klimt, The Kiss).',
      'Eiffel Tower and disks fracture Paris into color rhythm—Orphism as urban abstraction (Delaunay).',
    ],
  },
  {
    criterion: 'Value structure',
    masterSignals: [
      'Intervals of white, grey, and black as active space (Mondrian, Malevich).',
      'Close-value fields that breathe—luminosity from layering (Rothko).',
      'Light seems to emanate from within the weave—value carried by stain density, not only surface paint (Frankenthaler).',
      'Metallic leaf catches real light; flesh and robe built from mosaic-like value steps (Klimt).',
    ],
  },
  {
    criterion: 'Color relationships',
    masterSignals: [
      'Few hues, high stakes per plane—primaries as structural events (Mondrian).',
      'Color chords as non-objective “sound” (Kandinsky); restrained accents in Miró’s signs.',
      'Diluted acrylic pools: temperature shifts where pigments meet and bleed in raw canvas (Frankenthaler).',
      'Jewel-like blues, greens, and golds in repeating ornamental units (Klimt).',
      'Simultaneous contrast in disk segments—Paris read as prismatic motion (Delaunay).',
    ],
  },
  {
    criterion: 'Drawing and proportion',
    masterSignals: [
      'Internal proportion of intervals, bars, and shapes—not depiction (Mondrian, Malevich).',
      'Calligraphic drawing merged with field (Pollock, Miró).',
      'Soft contours born from liquid flow—drawing implied by tide-lines of stain, not contour first (Frankenthaler).',
      'Figure contour simplified to merge with surrounding arabesque (Klimt).',
      'Tower geometry implied through overlapping color wedges (Delaunay).',
    ],
  },
  {
    criterion: 'Edge control',
    masterSignals: [
      'Knife-sharp junctions vs matte correction (Mondrian); feathered horizontals (Rothko).',
      'Linear skeins as edge and texture (Pollock).',
      'Feathered stain edges vs untouched canvas—edge as soak front (Frankenthaler).',
      'Hard silhouette of bodies vs soft dissolve into ornament (Klimt).',
      'Circular and diagonal edges slice space without perspectival box (Delaunay).',
    ],
  },
  {
    criterion: 'Brushwork / handling',
    masterSignals: [
      'Hidden brushing in veils (Rothko); visible drip choreography (Pollock).',
      'Flat discipline and sanded revision (Mondrian); graphic sign-painting clarity (Miró, Malevich).',
      'Thin fluid application—brush or pour—where body and soak time are the “hand” (Frankenthaler).',
      'Gold leaf, oil paint, and pattern—surface as luxury and design (Klimt).',
      'Broken brushy facets in high-chroma passages (Delaunay).',
    ],
  },
  {
    criterion: 'Unity and variety',
    masterSignals: [
      'Repeating modules with slight variation—bars, drips, stacks (Mondrian, Pollock).',
      'Whole canvas obeys one structural law (Malevich square; Rothko stacks).',
      'Ornamental grid repeats with variation—whiplash and circle motifs (Klimt).',
    ],
  },
  {
    criterion: 'Originality / expressive force',
    masterSignals: [
      'Reduction as radical invention (Malevich); spiritual scale without illustration (Rothko).',
      'Play and primitive signs as modern voice (Miró); bodily scale of mark (Pollock).',
      'Inventing a new optical softness—stain as radical alternative to impasto monument (Frankenthaler).',
      'Secessionist synthesis—fine art, craft, and eros in one plane (Klimt).',
      'Modernity as color-music—city and technology as abstract joy (Delaunay).',
    ],
  },
];

const BY_STYLE: Record<StyleKey, CriterionRubric[]> = {
  Realism: REALISM_RUBRIC,
  Impressionism: IMPRESSIONISM_RUBRIC,
  Expressionism: EXPRESSIONISM_RUBRIC,
  'Abstract Art': ABSTRACT_ART_RUBRIC,
};

export function getCriterionRubric(style: string, criterion: CriterionLabel): CriterionRubric | null {
  const key = style as StyleKey;
  const rows = BY_STYLE[key];
  if (!rows) return null;
  return rows.find((row) => row.criterion === criterion) ?? null;
}

export function getCriterionMasterSignals(style: string, criterion: CriterionLabel): string[] {
  return getCriterionRubric(style, criterion)?.masterSignals ?? [];
}

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
