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
    criterion: 'Composition and shape structure',
    masterSignals: [
      'Frieze or pyramid grouping with clear figure–ground (Courbet, Millet); diagonal narrative pull (Repin); measured spatial depth (Eakins).',
      'Social or moral focus staged through who is centered and who labors (Courbet, Daumier, Millet).',
      'Urban geometry and reflective façades as compositional puzzle—stacked mirrors, signage, and depth cues (Estes, Photorealism).',
      'Intimate head-and-shoulders or single-figure focus with fabric and jewelry as abstract anchors (Vermeer).',
      'Mirror, doorway, and multi-figure space as a reflexive puzzle—who sees whom (Velázquez, Las Meninas).',
    ],
  },
  {
    criterion: 'Value and light structure',
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
    criterion: 'Drawing, proportion, and spatial form',
    masterSignals: [
      'Anatomy and architecture observed with construction underneath (Eakins, Repin).',
      'Graphic clarity of type and posture with few strokes (Daumier); weight and contact read convincingly.',
      'Linear perspective and architectural module held while reflections fracture the view (Estes).',
      'Portrait likeness with subtle asymmetry and sculptural turning of the head (Vermeer).',
      'Spatial drawing across servants, royals, dog, and canvas-within-canvas (Velázquez).',
    ],
  },
  {
    criterion: 'Edge and focus control',
    masterSignals: [
      'Hard silhouettes where bodies meet sky vs softer internal modeling (Millet, Courbet).',
      'Selective sharpness on hands, faces, and narrative hooks vs atmospheric recession (Homer water, Repin ropes).',
      'Razor transitions between reflection, transparency, and support—edges as optical facts (Estes).',
      'Soft lost edges in flesh and fabric vs crisp jewelry or collar accents (Vermeer).',
      'Hard contour on victim’s shirt vs painterly dissolution in crowd and hill (Goya).',
    ],
  },
  {
    criterion: 'Surface and medium handling',
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
    criterion: 'Intent and necessity',
    masterSignals: [
      'Every formal choice feels tied to the subject’s social and human weight, not added as generic polish (Courbet, Millet, Daumier).',
      'Observation, staging, and facture all serve one pictorial aim—nothing feels merely decorative (Eakins, Homer).',
      'Modern urban exactitude turns ordinary infrastructure into a coherent visual argument, not a pile of detail (Estes).',
      'Each decision about focus, silhouette, and interval feels necessary to the painting’s point, as in Velázquez and Vermeer.',
    ],
  },
  {
    criterion: 'Presence, point of view, and human force',
    masterSignals: [
      'Ordinary life is given moral or human weight without sentimentality (Millet, Courbet).',
      'A distinct way of seeing governs the image—private, severe, tender, or unflinching (Vermeer, Eakins, Homer).',
      'The painting carries atmosphere or psychological charge that lingers after the first read (Goya, Sargent).',
      'Subject and treatment feel inseparable, so the work reads as necessary rather than merely well made.',
    ],
  },
];

const IMPRESSIONISM_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition and shape structure',
    masterSignals: [
      'Casual crop, off-center emphasis, modern life framing (Degas, Cassatt, Morisot).',
      'Horizon and water geometry carry the design (Monet, Pissarro); leisure clusters (Renoir).',
      'Modern architecture as calm stage; explosive transient motif (splash, figure, splash) as timed event (Hockney).',
      'Figures distributed as color notes across horizontal band—Sunday leisure as frieze (Seurat, Grande Jatte).',
      'Mountain and architecture built from shifting planes—Cézanne’s constructive stroke holds space without single vanishing theatrics.',
    ],
  },
  {
    criterion: 'Value and light structure',
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
    criterion: 'Drawing, proportion, and spatial form',
    masterSignals: [
      'Drawing dissolved into sensation but structure underneath figures (Degas, Morisot).',
      'Tender observation of gesture without stiff outline (Cassatt, Renoir).',
      'Pool geometry and diving board read as simple vectors; figure and splash as calligraphic incident (Hockney).',
      'Silhouette and posture read at distance; individual backs and hats still accountable (Seurat).',
      'Underlying geometry of slopes and rooflines even when contour wobbles (Cézanne).',
    ],
  },
  {
    criterion: 'Edge and focus control',
    masterSignals: [
      'Lost edges in light, found edges in silhouette and contour (Monet, Pissarro).',
      'Pastel-like softness vs decisive contour where the story needs it (Cassatt, Degas).',
      'Crisp building edges vs splintered splash edges—scale of edge matches scale of motion (Hockney).',
      'Thousands of micro-edges from dots aggregate into soft boundaries (Seurat).',
      'Contour “searches” and color boundaries replace ink line (Cézanne).',
    ],
  },
  {
    criterion: 'Surface and medium handling',
    masterSignals: [
      'Separate touches that fuse optically at distance (Monet, Pissarro).',
      'Feathered veils and scumble for atmosphere (Morisot); brisk figure notation (Degas).',
      'Broad blocked-in fields plus patient small-brush notation for turbulence—acrylic supports both speeds (Hockney).',
      'Consistent dot or dash module—discipline of touch as style (Seurat).',
      'Patch-like parallel strokes that construct plane rather than illustrate texture (Cézanne).',
    ],
  },
  {
    criterion: 'Intent and necessity',
    masterSignals: [
      'Light, crop, and touch all serve the chosen sensation of the moment rather than competing for attention (Monet, Pissarro).',
      'Figure and setting belong to one atmosphere and one way of seeing (Cassatt, Morisot, Renoir).',
      'The painting’s looseness is disciplined: apparent spontaneity still feels organized and necessary (Monet series, Cézanne, Hockney).',
      'Optical decisions read as a coherent pictorial problem, not a collection of Impressionist effects.',
    ],
  },
  {
    criterion: 'Presence, point of view, and human force',
    masterSignals: [
      'A specific lived sensation—light, weather, intimacy, leisure, or stillness—comes through clearly (Monet, Cassatt, Morisot).',
      'The painting carries a recognizable viewpoint without needing theatrical drama (Renoir, Pissarro).',
      'Modern life is filtered through a distinct sensibility rather than merely recorded (Seurat, Hockney).',
      'Atmosphere and point of view stay memorable even when drawing and edges remain open.',
    ],
  },
];

const EXPRESSIONISM_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition and shape structure',
    masterSignals: [
      'Distortion and diagonal stress as psychological fact (Munch, Kirchner).',
      'Compressed monumentality and stillness (Modersohn-Becker) vs diagrammatic panic (Munch).',
      'Central iconic form—skull, mask, totem—anchoring scribal energy and peripheral marks (Basquiat, Neo-Expressionism).',
      'Riverfront night sky pulsing with directional strokes—lights reflected as a second rhythm below (van Gogh, Starry Night Over the Rhône).',
    ],
  },
  {
    criterion: 'Value and light structure',
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
    criterion: 'Drawing, proportion, and spatial form',
    masterSignals: [
      'Deliberate elongation, hinge joints, exposed structure (Schiele, Modersohn-Becker).',
      'Wavy perspective and simplified masses as inner state (Munch).',
      'Primal silhouette (skull) plus improvised anatomy and signage—drawing that collapses icon and doodle (Basquiat).',
      'Masts, shoreline, and reflected lights act as vertical and horizontal anchors inside a moving night field (van Gogh).',
    ],
  },
  {
    criterion: 'Edge and focus control',
    masterSignals: [
      'Nervous contour vs blunt blocked shapes—chosen for anxiety or weight (Schiele, Nolde).',
      'Carved outlines around figures in street scenes (Kirchner).',
      'Spray softness vs oil-stick scrape vs acrylic flat—edge type signals layer order (Basquiat).',
      'Impasto ridges create sharp halos; sky and land merge in stroke direction (van Gogh).',
    ],
  },
  {
    criterion: 'Surface and medium handling',
    masterSignals: [
      'Scratch, drag, stain—surface matches emotional temperature (Kirchner, Nolde).',
      'Heavy simplicity and tactile earth (Modersohn-Becker); graphic wipe in Munch skies.',
      'Fast-drying ground (acrylic) for immediate overwrites—oil stick and spray on top without dirtying underlayers (Basquiat).',
      'Parallel and spiral strokes follow form and feeling—energy made visible (van Gogh).',
    ],
  },
  {
    criterion: 'Intent and necessity',
    masterSignals: [
      'Distortion, chroma, and brush energy all serve one emotional pressure rather than pulling in different directions (Munch, Kirchner).',
      'The work knows when to simplify and when to intensify; force comes from selection, not noise (Modersohn-Becker, Nolde).',
      'Graphic signs, figures, and marks all belong to one expressive system (Basquiat).',
      'Stroke rhythm and motif handling feel necessary to the mood the painting is trying to create (van Gogh).',
    ],
  },
  {
    criterion: 'Presence, point of view, and human force',
    masterSignals: [
      'Inner life becomes visible through color, distortion, and surface rather than literal storytelling (Munch, Schiele).',
      'The painting carries a clear emotional or psychological temperature that does not dilute itself (Nolde, Modersohn-Becker).',
      'Subject and treatment fuse into a point of view that feels unmistakably personal (Basquiat, van Gogh).',
      'Even rough or unstable passages contribute to conviction instead of reading as unresolved by accident.',
    ],
  },
];

const ABSTRACT_ART_RUBRIC: CriterionRubric[] = [
  {
    criterion: 'Composition and shape structure',
    masterSignals: [
      'Grid equilibrium and dynamic asymmetry (Mondrian); stacked intervals (Rothko).',
      'All-over rhythm without a single “hero” motif (Pollock); biomorphic placement (Miró, Kandinsky).',
      'Open field stained with floating shapes—figure and ground merge through absorption (Frankenthaler, soak-stain).',
      'Couple as icon within decorative field—gold and pattern flatten and elevate simultaneously (Klimt, The Kiss).',
      'Eiffel Tower and disks fracture Paris into color rhythm—Orphism as urban abstraction (Delaunay).',
    ],
  },
  {
    criterion: 'Value and light structure',
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
    criterion: 'Drawing, proportion, and spatial form',
    masterSignals: [
      'Internal proportion of intervals, bars, and shapes—not depiction (Mondrian, Malevich).',
      'Calligraphic drawing merged with field (Pollock, Miró).',
      'Soft contours born from liquid flow—drawing implied by tide-lines of stain, not contour first (Frankenthaler).',
      'Figure contour simplified to merge with surrounding arabesque (Klimt).',
      'Tower geometry implied through overlapping color wedges (Delaunay).',
    ],
  },
  {
    criterion: 'Edge and focus control',
    masterSignals: [
      'Knife-sharp junctions vs matte correction (Mondrian); feathered horizontals (Rothko).',
      'Linear skeins as edge and texture (Pollock).',
      'Feathered stain edges vs untouched canvas—edge as soak front (Frankenthaler).',
      'Hard silhouette of bodies vs soft dissolve into ornament (Klimt).',
      'Circular and diagonal edges slice space without perspectival box (Delaunay).',
    ],
  },
  {
    criterion: 'Surface and medium handling',
    masterSignals: [
      'Hidden brushing in veils (Rothko); visible drip choreography (Pollock).',
      'Flat discipline and sanded revision (Mondrian); graphic sign-painting clarity (Miró, Malevich).',
      'Thin fluid application—brush or pour—where body and soak time are the “hand” (Frankenthaler).',
      'Gold leaf, oil paint, and pattern—surface as luxury and design (Klimt).',
      'Broken brushy facets in high-chroma passages (Delaunay).',
    ],
  },
  {
    criterion: 'Intent and necessity',
    masterSignals: [
      'Every interval, color decision, and shape family feels governed by one pictorial law (Mondrian, Malevich, Rothko).',
      'Gesture, stain, or pattern behaves as a system rather than as unrelated incidents (Pollock, Frankenthaler, Klimt).',
      'Even playfulness or openness still feels structurally committed, not casual (Miró, Delaunay).',
      'The work reads as a deliberate proposition about painting, not simply an arrangement of attractive abstract parts.',
    ],
  },
  {
    criterion: 'Presence, point of view, and human force',
    masterSignals: [
      'The painting carries conviction through scale, interval, atmosphere, or sign rather than representational subject matter (Rothko, Malevich).',
      'A distinct voice appears in the way the surface and structure meet—bodily, lyrical, severe, or ecstatic (Pollock, Miró, Frankenthaler).',
      'Abstraction still generates felt presence: the work seems inhabited by a way of seeing (Klimt, Delaunay).',
      'Reduction, ornament, or gesture become memorable because they feel necessary, not merely novel.',
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
  const ordered = CRITERIA_ORDER.map((criterion) => rows.find((row) => row.criterion === criterion)).filter(
    (row): row is CriterionRubric => Boolean(row)
  );
  return ordered
    .map((r) => {
      const bullets = r.masterSignals.map((s) => `  - ${s}`).join('\n');
      return `${r.criterion}:\n${bullets}`;
    })
    .join('\n\n');
}

/** Ensures every style supplies one rubric row per criterion label. */
function assertRubricOrder(): void {
  for (const style of Object.keys(BY_STYLE) as StyleKey[]) {
    const rubric = BY_STYLE[style];
    if (rubric.length !== CRITERIA_ORDER.length) throw new Error(`Rubric length mismatch for ${style}`);
    const seen = new Set(rubric.map((row) => row.criterion));
    for (const criterion of CRITERIA_ORDER) {
      if (!seen.has(criterion)) {
        throw new Error(`Rubric criterion missing at ${style}: ${criterion}`);
      }
    }
  }
}

assertRubricOrder();
