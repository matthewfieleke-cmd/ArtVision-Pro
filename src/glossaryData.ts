import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria';

export type GlossarySection = 'General' | CriterionLabel;

export type GlossaryEntry = {
  id: string;
  term: string;
  section: GlossarySection;
  definition: string;
  whyItMatters: string;
  critiqueExample: string;
  aliases: string[];
};

function entry(args: Omit<GlossaryEntry, 'id'>): GlossaryEntry {
  return {
    ...args,
    id: `${args.section}:${args.term}`.toLowerCase().replace(/[^\w]+/g, '-'),
  };
}

export const GLOSSARY_SECTION_ORDER: readonly GlossarySection[] = [
  'General',
  ...CRITERIA_ORDER,
] as const;

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  entry({
    term: 'Anchor / passage',
    section: 'General',
    definition:
      'A specific, pointable area of the painting, often one shape or zone against another. The critique uses anchors so every judgment and instruction refers to a real passage on the canvas.',
    whyItMatters:
      'If the critique cannot point to an exact passage, the feedback becomes vague and hard to trust or act on.',
    critiqueExample:
      '“In the jaw edge against the dark collar, sharpen that break a little more so the face claims first attention.”',
    aliases: ['anchor', 'passage', 'anchored passage', 'anchor passage'],
  }),
  entry({
    term: 'Carrier passage',
    section: 'General',
    definition:
      'The visible passage that actually carries a feeling, pressure, or idea in the picture. It is the concrete place where the painting’s intent becomes legible.',
    whyItMatters:
      'This keeps conceptual feedback tied to something you can see and point to instead of drifting into mood-only language.',
    critiqueExample:
      '“The chair bars cutting across the sitter’s torso are the carrier passage for the painting’s withheld pressure.”',
    aliases: ['carrier passage', 'carrier', 'visible carrier'],
  }),
  entry({
    term: 'Value',
    section: 'General',
    definition:
      'How light or dark something is, separate from its hue. Value structure is the big-picture arrangement of lights and darks.',
    whyItMatters:
      'Strong value organization helps the painting read clearly before color and detail do their work.',
    critiqueExample:
      '“The wall behind the head sits too close in value to the crown, delaying the head read.”',
    aliases: ['value', 'light-dark', 'light dark', 'value structure'],
  }),
  entry({
    term: 'Value grouping',
    section: 'General',
    definition:
      'How smaller shapes are organized into larger families of light, middle, and dark.',
    whyItMatters:
      'If values group well, the painting reads sooner. If they break into too many unrelated patches, the image can feel noisy or flat.',
    critiqueExample:
      '“The shirt and window strip group into one readable light family, but the wall behind the crown breaks that grouping.”',
    aliases: ['value grouping', 'value groups', 'grouping'],
  }),
  entry({
    term: 'Chroma / saturation',
    section: 'General',
    definition:
      'How intense or muted a color is. Low chroma is closer to gray; high chroma is more vivid.',
    whyItMatters:
      'Chroma shifts can create emphasis or break palette unity if one accent jumps harder than the rest of the painting needs.',
    critiqueExample:
      '“One warm floor patch jumps slightly hotter than the muted palette around it.”',
    aliases: ['chroma', 'saturation', 'high chroma', 'low chroma'],
  }),
  entry({
    term: 'Color temperature',
    section: 'General',
    definition:
      'Whether a color reads warmer or cooler relative to its neighbors—not whether the subject is literally hot or cold.',
    whyItMatters:
      'Temperature shifts can turn a form, separate planes, or create a mood without relying only on value contrast.',
    critiqueExample:
      '“The orange cheek turning into the cooler green shadow gives the head its turn in space.”',
    aliases: ['color temperature', 'temperature', 'warm', 'cool', 'temperature shift'],
  }),
  entry({
    term: 'Half-tone',
    section: 'General',
    definition:
      'The middle-value transition between the light side and the shadow side of a form.',
    whyItMatters:
      'A good half-tone often keeps a form turning in space instead of breaking into flat light and dark stickers.',
    critiqueExample:
      '“Bridge the jump with a muted half-tone so the cheek turns instead of snapping.”',
    aliases: ['half-tone', 'halftone', 'middle tone'],
  }),
  entry({
    term: 'Edge',
    section: 'General',
    definition:
      'The boundary between two shapes, values, or colors. Edges can be hard, soft, lost, or found.',
    whyItMatters:
      'Edges control clarity, focus, atmosphere, and where the eye lands first.',
    critiqueExample:
      '“Sharpen the jaw-to-collar edge while leaving the cheek-to-wall edge softer.”',
    aliases: ['edge', 'edges', 'edge control'],
  }),
  entry({
    term: 'Lost and found',
    section: 'General',
    definition:
      'An edge or contour that appears clearly in one stretch and disappears or softens in another.',
    whyItMatters:
      'Lost and found edges can guide attention and keep a passage alive instead of equally describing everything.',
    critiqueExample:
      '“Keep the cheek edge lost into the wall so the face doesn’t become evenly cut out.”',
    aliases: ['lost and found', 'lost edge', 'found edge'],
  }),
  entry({
    term: 'Brushwork / handling',
    section: 'General',
    definition:
      'How paint or marks are applied: direction, thickness, drag, wetness, scumble, hatch, and pressure.',
    whyItMatters:
      'Handling affects whether a passage feels convincing, deadened, lively, overworked, or true to the medium.',
    critiqueExample:
      '“The wall hatching beside the smoother shirt passage gives this area a controlled surface contrast.”',
    aliases: ['brushwork', 'handling', 'paint handling', 'surface handling'],
  }),
  entry({
    term: 'Wash',
    section: 'General',
    definition:
      'A thin, often transparent layer of color, especially common in watercolor and thinly painted passages.',
    whyItMatters:
      'Washes can hold broad atmosphere and value relationships, but they can also become muddy or patchy if overworked.',
    critiqueExample:
      '“Let the wash stay broad here; don’t chop it into small unrelated accents.”',
    aliases: ['wash', 'washes'],
  }),
  entry({
    term: 'Glaze',
    section: 'General',
    definition:
      'A transparent or semi-transparent layer laid over a dry passage to shift color or deepen value without fully repainting the area.',
    whyItMatters:
      'Glazing can unify or deepen a passage, but only when the medium and the existing surface can support it.',
    critiqueExample:
      '“A thin glaze would darken this passage without repainting the full shape family.”',
    aliases: ['glaze', 'glazing'],
  }),
  entry({
    term: 'Scumble',
    section: 'General',
    definition:
      'A broken, often drier layer dragged lightly over a passage so some of the lower layer still shows through.',
    whyItMatters:
      'Scumble can create vibration, atmosphere, or surface variety without fully covering what is underneath.',
    critiqueExample:
      '“The dry scumble over the darker underlayer gives this light passage a breathable surface.”',
    aliases: ['scumble', 'scumbled', 'dry drag'],
  }),
  entry({
    term: 'Impasto / load',
    section: 'General',
    definition:
      'Paint applied thickly enough to create physical relief on the surface.',
    whyItMatters:
      'Heavy load can make an accent more tactile and assertive, but too much thickness can turn into a distracting bump.',
    critiqueExample:
      '“Keep the loaded highlight stroke, but don’t let neighboring marks build to the same physical weight.”',
    aliases: ['impasto', 'load', 'loaded stroke', 'thick paint'],
  }),
  entry({
    term: 'Focal hierarchy',
    section: 'General',
    definition:
      'Which areas read first, second, and later. Some paintings center attention tightly; others distribute it on purpose.',
    whyItMatters:
      'Good hierarchy helps the eye move in the right order without making every passage equally loud.',
    critiqueExample:
      '“The face should win before the collar, but the current edge hierarchy lets them compete too evenly.”',
    aliases: ['focal hierarchy', 'focus hierarchy', 'focal point', 'focus'],
  }),
  entry({
    term: 'Silhouette',
    section: 'General',
    definition:
      'The outer contour of a shape as it reads against the space around it.',
    whyItMatters:
      'A silhouette often determines whether a form reads clearly before internal modeling does.',
    critiqueExample:
      '“Darken the house silhouette against the horizon so the distant structure reads sooner.”',
    aliases: ['silhouette', 'silhouette edge'],
  }),
  entry({
    term: 'Overlap',
    section: 'General',
    definition:
      'One form covering part of another so the eye reads depth or ordering in space.',
    whyItMatters:
      'Weak overlaps can flatten space; strong overlaps can make form and placement feel convincing very quickly.',
    critiqueExample:
      '“The cup rim overlapping the hand is still too even, so the front-back read stays soft.”',
    aliases: ['overlap', 'overlaps', 'overlapping'],
  }),
  entry({
    term: 'Atmospheric perspective',
    section: 'General',
    definition:
      'The tendency for distant forms to soften, lighten, cool, or compress compared with nearer ones.',
    whyItMatters:
      'This helps a landscape or interior recede without having to draw every passage sharply.',
    critiqueExample:
      '“The distant house can stay small and soft, but it still needs enough separation to hold its place at the horizon.”',
    aliases: ['atmospheric perspective', 'distance haze', 'distance read'],
  }),
  entry({
    term: 'Big shape / scaffold',
    section: 'Composition and shape structure',
    definition:
      'The main masses and their arrangement in the rectangle before detail or narrative.',
    whyItMatters:
      'If the big-shape scaffold works, smaller details can sit inside a structure that already feels deliberate.',
    critiqueExample:
      '“The window strip, chair back, and sitter form three readable vertical bands.”',
    aliases: ['big shape', 'scaffold', 'shape scaffold', 'big-shape'],
  }),
  entry({
    term: 'Interval / gap',
    section: 'Composition and shape structure',
    definition:
      'The space between shapes and the rhythm those spaces create.',
    whyItMatters:
      'Intervals can create flow and tension, or they can feel accidental and make the structure wobble.',
    critiqueExample:
      '“Widen the small gap above the shoulder so the eye can step from chair to head.”',
    aliases: ['interval', 'gap', 'spacing', 'rhythm'],
  }),
  entry({
    term: 'Key',
    section: 'Value and light structure',
    definition:
      'The overall lightness or darkness of the painting’s value range.',
    whyItMatters:
      'A high-key or low-key painting can still work beautifully—but only if the internal relationships stay controlled.',
    critiqueExample:
      '“The painting keeps a compressed key, but one head-to-wall value jump still needs clearer separation.”',
    aliases: ['key', 'high-key', 'high key', 'low-key', 'low key'],
  }),
  entry({
    term: 'Compression',
    section: 'Value and light structure',
    definition:
      'A narrow range of differences between lights and darks, colors, or edges.',
    whyItMatters:
      'Compression can feel subtle and elegant when intended, or flat when the painting needs one clearer separation.',
    critiqueExample:
      '“The wall behind the head is too compressed against the crown, delaying the form read.”',
    aliases: ['compression', 'compressed', 'compressed range'],
  }),
  entry({
    term: 'Harmony vs discord',
    section: 'Color relationships',
    definition:
      'Whether colors hold together as a controlled family or clash in a way that reads intentional or accidental.',
    whyItMatters:
      'A painting can use discord well, but accidental clashes often make one passage feel separate from the color world of the whole.',
    critiqueExample:
      '“One floor patch jumps hotter than the room palette around it.”',
    aliases: ['harmony', 'discord', 'color harmony', 'palette world'],
  }),
  entry({
    term: 'Proportion / alignment',
    section: 'Drawing, proportion, and spatial form',
    definition:
      'How lengths, tilts, placements, and overlaps work together so forms feel believable in space.',
    whyItMatters:
      'If alignment drifts, even a good color or value passage can still feel unstable in structure.',
    critiqueExample:
      '“The near table leg kicks outward before it meets the floor plane.”',
    aliases: ['proportion', 'alignment', 'placement', 'spatial form'],
  }),
  entry({
    term: 'Selective focus',
    section: 'Edge and focus control',
    definition:
      'Sharpening and softening only where needed so some passages advance and others recede.',
    whyItMatters:
      'Selective focus keeps the eye moving deliberately instead of treating every edge with the same importance.',
    critiqueExample:
      '“Sharpen the jaw-to-collar edge and leave the cheek edge softer.”',
    aliases: ['selective focus', 'focus control', 'focus hierarchy'],
  }),
  entry({
    term: 'Tooth / support',
    section: 'Surface and medium handling',
    definition:
      'The physical texture of the paper, canvas, or ground that receives the marks.',
    whyItMatters:
      'Support texture affects how dry media layers, how paint catches, and whether a passage can stay breathable instead of overworked.',
    critiqueExample:
      '“The tooth is still helping the dry pastel vibration breathe through the lighter passages.”',
    aliases: ['tooth', 'support', 'paper tooth', 'canvas tooth'],
  }),
  entry({
    term: 'Necessity',
    section: 'Intent and necessity',
    definition:
      'Whether a decision feels inevitable for this painting rather than optional decoration.',
    whyItMatters:
      'Necessity helps distinguish a painting with conviction from one that merely has many effects.',
    critiqueExample:
      '“The obstruction already feels necessary, but one darker bar turns that necessity slightly blunt.”',
    aliases: ['necessity', 'inevitable', 'inevitability'],
  }),
  entry({
    term: 'Point of view',
    section: 'Presence, point of view, and human force',
    definition:
      'Where the viewer seems to stand physically and emotionally in relation to the picture.',
    whyItMatters:
      'Point of view shapes whether the painting feels intimate, distant, withheld, confrontational, or observational.',
    critiqueExample:
      '“The downturned head and obstructed chair create a withheld point of view rather than a straightforward portrait address.”',
    aliases: ['point of view', 'viewpoint', 'presence', 'human force', 'human pressure'],
  }),
];

export function normalizeGlossarySearchText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function aliasPattern(alias: string): RegExp {
  const normalized = normalizeGlossarySearchText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${normalized.replace(/\s+/g, '\\s+')}\\b`, 'i');
}

export function searchGlossaryEntries(query: string, section: GlossarySection | 'All' = 'All'): GlossaryEntry[] {
  const normalizedQuery = normalizeGlossarySearchText(query);
  const filteredBySection =
    section === 'All'
      ? GLOSSARY_ENTRIES
      : GLOSSARY_ENTRIES.filter((entry) => entry.section === section);

  const filtered = normalizedQuery
    ? filteredBySection.filter((entry) => {
        const haystack = normalizeGlossarySearchText(
          [entry.term, entry.definition, entry.whyItMatters, entry.critiqueExample, ...entry.aliases].join(' ')
        );
        return haystack.includes(normalizedQuery);
      })
    : [...filteredBySection];

  return filtered.sort((left, right) => left.term.localeCompare(right.term));
}

export function findGlossaryEntriesForText(
  texts: string[],
  opts?: { section?: GlossarySection; limit?: number }
): GlossaryEntry[] {
  const combined = normalizeGlossarySearchText(texts.join(' '));
  if (!combined) return [];
  const limit = opts?.limit ?? 4;
  const scoped = GLOSSARY_ENTRIES.filter((entry) =>
    opts?.section ? entry.section === 'General' || entry.section === opts.section : true
  );

  const scored = scoped
    .map((entry) => {
      let score = entry.section === opts?.section ? 8 : 0;
      for (const alias of [entry.term, ...entry.aliases]) {
        if (aliasPattern(alias).test(combined)) {
          score = Math.max(score, normalizeGlossarySearchText(alias).length + (entry.section === opts?.section ? 8 : 0));
        }
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.entry.term.localeCompare(right.entry.term);
    });

  const unique: GlossaryEntry[] = [];
  const seen = new Set<string>();
  for (const item of scored) {
    if (seen.has(item.entry.id)) continue;
    unique.push(item.entry);
    seen.add(item.entry.id);
    if (unique.length >= limit) break;
  }
  return unique;
}
