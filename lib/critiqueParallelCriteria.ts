import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import type {
  ObservationBank,
  ObservationBankStageResult,
} from './critiqueZodSchemas.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';
import { buildOpenAIMaxTokensParam, buildOpenAISamplingParam } from './openaiModels.js';
import { buildHighDetailImageMessage, type VisionUserMessagePart } from './openaiVisionContent.js';
import { errorMessage } from './critiqueErrors.js';
import {
  CRITIQUE_AUDIENCE_FRAMING,
  VOICE_A_COMPOSITE_EXPERTS,
  VOICE_A_PARAGRAPH_SHAPE,
  VOICE_B_COMPOSITE_TEACHERS,
  VOICE_B_PARAGRAPH_SHAPE,
} from '../shared/critiqueVoiceA.js';

/**
 * Result for a single criterion's writer call. The writer now owns ALL
 * per-criterion work: picking the anchor passage, writing the evidence
 * lines, producing Voice A + Voice B prose, emitting the structured edit
 * plan that the AI-edit endpoint consumes, and locating the anchor in the
 * photo as a normalized bounding box. Everything here is grounded in the
 * shared observation bank + the painting image, which the writer sees
 * directly.
 */
export type CriterionWritingResult = {
  criterion: CriterionLabel;
  /** Anchor passage + evidence pointer + normalized region the writer located. */
  anchor: CriterionAnchor;
  /** 3–6 junction-level observations specific to this criterion. */
  visibleEvidence: string[];
  /** Short plain read of what is genuinely unresolved on this axis, if anything. */
  tensionRead: string;
  /** Voice A's critic paragraph (instructional register). */
  voiceACritique: string;
  /** Voice B's teacher paragraph (imperative register, four-beat shape). */
  voiceBSuggestions: string;
  /** Short line naming what to protect while editing. */
  preserve: string;
  /** Structured edit plan the AI-edit endpoint consumes directly. */
  editPlan: CriterionEditPlan;
  /** Writer's confidence in this criterion's read, given the photo. */
  confidence: 'low' | 'medium' | 'high';
};

/**
 * Strict JSON schema for a single criterion's writer output.
 *
 * This writer now owns every per-criterion field the pipeline produces:
 *   - anchor (areaSummary / evidencePointer / region) — so every criterion
 *     has a box on the photo the critique text points at.
 *   - visibleEvidence — 3–6 junction-level observations grounding the text.
 *   - tensionRead — what is genuinely unresolved on this axis, if anything.
 *   - voiceACritique — instructional-register critic paragraph.
 *   - voiceBSuggestions — imperative-register teacher paragraph.
 *   - preserve — what to protect while editing.
 *   - editPlan — the structured spec the AI-edit endpoint consumes.
 *   - confidence — low / medium / high for this criterion only.
 *
 * OpenAI Structured Outputs requires every property in `properties` to also
 * be in `required` and `additionalProperties: false`. Kept hand-written so
 * descriptions stay prescriptive in one place rather than spread across Zod
 * `.describe()` calls.
 */
export const CRITERION_JSON_SCHEMA = {
  name: 'painting_criterion_writer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'anchor',
      'visibleEvidence',
      'tensionRead',
      'voiceACritique',
      'voiceBSuggestions',
      'preserve',
      'editPlan',
      'confidence',
    ],
    properties: {
      anchor: {
        type: 'object',
        additionalProperties: false,
        required: ['areaSummary', 'evidencePointer', 'region'],
        properties: {
          areaSummary: {
            type: 'string',
            description:
              'Noun phrase naming ONE specific, locatable passage on the canvas. Figurative example: "the jaw edge against the hair". Mark-level / abstract example: "the bright cadmium strip where it meets the olive field". Landscape example: "the ridge line where it meets the sky". Must fit grammatically after "in": downstream prose writes "In [areaSummary], …". No predicates, no pose descriptions.',
          },
          evidencePointer: {
            type: 'string',
            description:
              'One sentence saying what is visibly happening in that exact passage right now — the specific relationship (value break, edge type, temperature shift, overlap, compression) that matters for THIS criterion. Not a theme or mood claim.',
          },
          region: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'width', 'height'],
            properties: {
              x: { type: 'number', description: 'Left edge, 0 = left, 1 = right.' },
              y: { type: 'number', description: 'Top edge, 0 = top, 1 = bottom.' },
              width: { type: 'number', description: 'Fraction of image width. x + width ≤ 1.' },
              height: { type: 'number', description: 'Fraction of image height. y + height ≤ 1.' },
            },
          },
        },
        description:
          'Anchor passage + normalized bounding box in the photo. The box must tightly contain the passage named by areaSummary; for "A against B" anchors include BOTH A and the adjacent B. Elongated along diagonals (bridge, path); wide for horizontal bands (sky, ridgeline); straddling any "where X meets Y" junction. Never empty background while the named object sits outside.',
      },
      visibleEvidence: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'string',
          description:
            'One junction-level observation tied to this criterion. Names TWO identifiable things and the specific relationship between them (value break, color shift, edge event, spatial overlap, alignment). The FIRST line MUST reuse the concrete nouns from anchor.areaSummary and describe one visible event there.',
        },
      },
      tensionRead: {
        type: 'string',
        description:
          'What is genuinely unresolved on THIS axis, named at the passage. If nothing is, say so plainly — do not manufacture a problem. One to two sentences.',
      },
      voiceACritique: {
        type: 'string',
        description:
          "Voice A critic paragraph in the instructional register described in the system message. 2–4 sentences. Declarative, evaluative, third-person about the painting. Name the anchored passage first, then say what is happening there, then the structural consequence. No conversational address to the reader, no 'you', no filler openings.",
      },
      voiceBSuggestions: {
        type: 'string',
        description:
          "Voice B teacher paragraph in the instructional register described in the system message. 2–4 sentences. Imperative. Follow the four-beat shape (where → what is happening now → what to try → what you should see afterward). Start the move with a concrete studio verb. Never 'you might', 'let's', 'try to', 'we can' — imperative only.",
      },
      preserve: {
        type: 'string',
        description:
          'One short sentence naming a specific visible strength in or near the anchored passage that the artist should protect while making the move.',
      },
      editPlan: {
        type: 'object',
        additionalProperties: false,
        required: [
          'targetArea',
          'preserveArea',
          'issue',
          'intendedChange',
          'expectedOutcome',
          'editability',
        ],
        properties: {
          targetArea: {
            type: 'string',
            description:
              'The passage the AI edit should revise. Usually the same phrase as anchor.areaSummary. Examples, spanning painting types: "the jaw edge against the hair", "the bright cadmium strip where it meets the olive field", "the heavy impasto cluster in the lower right".',
          },
          preserveArea: {
            type: 'string',
            description:
              'What nearby success must remain untouched while the AI edit revises the target. A specific named passage or relationship, not a generic "the rest of the painting".',
          },
          issue: {
            type: 'string',
            description:
              'The specific visual problem or strength in the target area RIGHT NOW. Must name what is visibly happening there. If there is nothing to fix (criterion is already working at the highest level), say so plainly and set editability to "no".',
          },
          intendedChange: {
            type: 'string',
            description:
              'The single move the AI edit should make, imperative voice, starting with a concrete studio verb (soften / darken / cool / warm / group / separate / reserve / glaze / scrape / restate / widen / narrow / compress / simplify). For criteria that are already working well, start with a preserve verb (preserve / keep / protect / leave / hold) and set editability to "no".',
          },
          expectedOutcome: {
            type: 'string',
            description:
              'What the painting should read like after the move — a visible result the painter can verify by looking. Examples: "the figure separates from the background", "the ridge reads one step farther back", "the negative shape between the two bars opens", "the central mark stops competing with the upper band".',
          },
          editability: {
            type: 'string',
            enum: ['yes', 'no'],
            description:
              'Whether the AI-edit endpoint should attempt this criterion. "yes" when intendedChange is a real change; "no" when the criterion is already working and the plan is a preserve instruction.',
          },
        },
        description:
          'Structured edit plan for this criterion. The AI-edit endpoint reads this directly. Every criterion emits one, so every criterion has a concrete AI-edit the user can trigger — tied to exactly the move the critique proposed.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description:
          'How well the visible evidence in the photo supports this criterion read. Put hedging here, not in the prose.',
      },
    },
  },
} as const;

/**
 * One system message for every parallel criterion call. The job of this
 * message is to lock in a SINGLE house voice across the eight concurrent
 * calls — otherwise the critic / teacher outputs drift stylistically and
 * the synthesis stage has to smooth them over.
 *
 * As of the "per-criterion writer owns everything" architecture, the writer
 * also sees the painting image and is responsible for picking the anchor
 * passage, writing the visible-evidence lines, locating the anchor as a
 * normalized bounding box, and emitting the structured editPlan the AI-edit
 * endpoint consumes. Moving that work into the 8 parallel calls removes it
 * from the (previously slow and serial) single vision call.
 */
export const PARALLEL_CRITERIA_SYSTEM_MESSAGE = [
  'You are the per-criterion writer for ONE criterion of ONE painting. You see the painting image and a shared observation bank the vision stage already produced. You produce, in one JSON response: the anchor passage + normalized bounding box on the photo; 3–6 junction-level visible-evidence lines; a tensionRead; a critic paragraph (Voice A); a teacher paragraph (Voice B); a preserve line; a structured editPlan the AI-edit endpoint consumes; and a confidence tag.',
  '',
  CRITIQUE_AUDIENCE_FRAMING,
  '',
  VOICE_A_COMPOSITE_EXPERTS,
  '',
  VOICE_A_PARAGRAPH_SHAPE,
  '',
  VOICE_B_COMPOSITE_TEACHERS,
  '',
  VOICE_B_PARAGRAPH_SHAPE,
  '',
  'Anchor-region rules (for anchor.region):',
  '- Normalized 0–1 coordinates relative to the full image: x=0 left, y=0 top, width/height as fractions.',
  '- Box must tightly cover the visible passage named by anchor.areaSummary — not empty sky, random background, or a different object.',
  '- "A against B" / "A on B" anchors must include BOTH A and the adjacent B so the relationship is visible.',
  '- "where X meets Y" / horizon / shoreline / waterline anchors must straddle that boundary: include pixels on both sides so the dividing line sits inside the rectangle.',
  '- Named object + context ("X under the sky", "distant X"): the named object is the required center of the box. Never a box entirely in background while the named X sits outside.',
  '- Small specific objects (hand, cup rim, earring, sign, candle, eye, small window, small boat): tight local box; do not widen to the surrounding body or room.',
  '- Plural repeats along a line (posts, pickets, rails, figures, windows, boats): widen so multiple repeats are inside.',
  '- Wide horizontal bands (sky, cloud band, treeline, ridgeline): cover most of the image width (typically width ≥ 0.55).',
  '- Diagonal structures (bridge, path): elongated box along the structure.',
  '',
  'Hard rules for every field:',
  '- Ground every claim in the painting image and the observation bank you are given. Do not invent passages that are not in the image.',
  '- Every criterion gets ONE anchor and ONE structured editPlan, whether the passage is figurative (a jaw edge, a figure against a field), mark-level (a cadmium strip against an olive field, an impasto cluster), or abstract (a band cutting across a plane). The framework does not assume representational subject matter.',
  '- Never name any critic, teacher, artist, famous artwork, or art-historical movement. The expert panels are for your reasoning only; the reader never sees them.',
  '- Never use filler openings ("This painting…", "In this work…", "Overall, the composition…"). Start inside the anchored passage.',
  '- Do not re-teach basic studio vocabulary; the reader already has it.',
  '- Confidence goes in the confidence field only, not in hedging words in the prose.',
  '- If the criterion genuinely has nothing unresolved (the painting is already working at the highest level on this axis), say so plainly in tensionRead and emit an editPlan with editability="no" and intendedChange starting with a preserve verb (preserve / keep / protect / leave / hold). Never manufacture a change just to fill the field.',
].join('\n');

/**
 * Per-axis "what insight looks like for THIS criterion" guidance, injected
 * into the per-criterion writer prompt. This is the single biggest
 * prompt-only quality lever: without it the writer spends reasoning budget
 * figuring out which axis of judgment it's on before it can make a point.
 * With it, the writer can go straight from the observation bank to a
 * specific, on-axis structural claim.
 *
 * Each block names:
 *   1. What this criterion is actually about (what a strong read names).
 *   2. What kinds of visible events tend to matter here.
 *   3. What "insight" looks like for this axis — the kind of structural
 *      claim a critic would land that's specific to this criterion and
 *      would NOT make sense on a different criterion.
 *   4. What moves the painter-facing teacher paragraph tends to prescribe
 *      for this axis.
 *
 * Painting-agnostic: every block gives examples that span figurative,
 * landscape, still life, and mark-level / abstract work.
 */
function criterionInsightGuidance(criterion: CriterionLabel): string {
  switch (criterion) {
    case 'Intent and necessity':
      return `What insight looks like for Intent and necessity:
- This axis is about why the painting commits to its choices — what the work is genuinely going for and whether the picture's decisions serve that aim. A strong read names the specific passage that CARRIES the intent (a direct pressure-bearing passage, not a generic focal point) and says whether the rest of the picture is backing that intent or undercutting it.
- What tends to matter: which passage bears the painting's argument (the encounter, the contact, the compression, the specific thing the painter kept insisting on); whether other passages defer to or fight that carrier.
- Structural-claim verbs specific to this axis: "commits to", "backs", "serves", "undercuts", "dilutes", "anchors the intent", "stops the picture from cohering around", "is the one passage the painting is actually about."
- Teacher moves for this axis tend to protect or strengthen the carrier passage: preserve the compression, quiet a competing accent elsewhere, recommit to the specific relationship that is the intent.`;
    case 'Composition and shape structure':
      return `What insight looks like for Composition and shape structure:
- This axis is about how shapes and their intervals organise the picture plane — where forms stack, widen, narrow, align, tilt, cut, or leave gaps. A strong read names a structural event between forms and says what that event does for the whole picture: does it balance, does it stall, does it crowd, does it open.
- What tends to matter: overlap and interval between major masses; how negative shapes behave; alignment / tilt / stack of vertical + horizontal structure; whether a diagonal leads the eye or fractures the plane.
- Structural-claim verbs: "organises", "fractures", "crowds", "stalls the eye at", "ties the picture together at", "leaves a wider gap on one side than the other so…", "cuts through the pale field and…"
- Teacher moves tend to rebalance intervals, group competing shapes, widen or narrow a gap, simplify a cluttered passage, strengthen or break an alignment.`;
    case 'Value and light structure':
      return `What insight looks like for Value and light structure:
- This axis is about how light mass and shadow mass shape the picture — value grouping, where the biggest value break sits, whether the light reads as a system or as piecework. A strong read names the shape of the light mass and says what that shape does for figure-ground separation and depth.
- What tends to matter: where the picture's strongest value contrast lands; whether lights group into one shape; whether shadows group or scatter; whether a passage is carrying ALL the brightness or ALL the dark.
- Structural-claim verbs: "groups", "scatters", "carries all the light", "flattens the figure against the ground because the values compress", "reads back because the shadow mass is unified", "sets the light scaffold for the whole picture."
- Teacher moves tend to regroup values, darken or lighten a specific passage, compress or expand the value range within a named area, restate a light shape.`;
    case 'Color relationships':
      return `What insight looks like for Color relationships:
- This axis is about how hue, chroma, and temperature behave as a system — what belongs to a shared palette, where chroma is placed strategically vs. scattered, whether temperature shifts are doing structural work. For drawing, this axis reads value harmony / paper tone / mark families instead.
- What tends to matter: where the highest chroma lands and whether it's earned; whether temperature shifts map the space (warm forward, cool back) or fight it; whether the local color of an object has been sacrificed for palette logic (or vice versa).
- Structural-claim verbs: "ties the palette together at", "breaks the palette's logic because…", "places the brightest chroma where it can actually do structural work", "pulls the eye away from the intended focus because…", "the temperature shift carries the depth the drawing was trying to do."
- Teacher moves tend to quiet a chroma spike, shift a temperature to line up with depth, regroup color families across similar passages, or preserve a specific earned accent.`;
    case 'Drawing, proportion, and spatial form':
      return `What insight looks like for Drawing, proportion, and spatial form:
- This axis is about construction: are the things in the picture actually *built* — are their proportions, their angles, their overlaps, their feet on the ground convincing? For abstract work, this is about how forms sit in the picture plane and whether their relative scale / placement reads deliberate.
- What tends to matter: specific proportion relationships (jaw to forehead, height of a pot to its width, the near-to-far ratio of a receding mass); whether the perspective holds at the junctions the eye tests (feet on the floor, plates elliptical on the table, windows shortening with the wall); whether a form reads as solid or as a silhouette.
- Structural-claim verbs: "reads as solid because…", "flattens into a silhouette", "the proportions of X to Y set the figure's scale for the whole picture", "the perspective gives up at the back of the room", "the form sits on the plane because the angle at X holds."
- Teacher moves tend to restate a specific angle or proportion, rebuild the junction where the drawing gives up, darken under a foot or base to set it on the ground, check a relative scale with a named reference.`;
    case 'Edge and focus control':
      return `What insight looks like for Edge and focus control:
- This axis is about where the picture sharpens and where it softens, and whether that pattern tells the eye where to look. A strong read names the lost-and-found pattern and says what it does for focal hierarchy.
- What tends to matter: which edges are hardest and whether they're in the passage the painting actually cares about; where lost edges are doing work (and where they're just avoidance); whether a passage is accidentally as sharp as the focus; whether what looks soft is photo capture or painted ambiguity.
- Structural-claim verbs: "holds the focus at", "pulls focus away from the intended subject because…", "gives the eye nowhere to stop", "sets up a clear lost-and-found pattern that lands on…", "the hardest edge in the picture is in the wrong place."
- Teacher moves tend to soften a competing edge, sharpen the intended focus, break a contour into lost / found segments, resolve ambiguous-vs-captured softness.`;
    case 'Surface and medium handling':
      return `What insight looks like for Surface and medium handling:
- This axis is about the mark behavior actually visible on the canvas — direction, thickness, wet/dry, scumble, tooth, correction layers — and whether the handling is doing work for the picture or fighting it. A strong read names a specific mark passage and says what that handling accomplishes.
- What tends to matter: whether different mark families separate different areas (hatching in the wall vs. smoother shirt, impasto in the lights vs. thinner darks); whether reworking has enriched or deadened a passage; whether the surface rhythm belongs to the declared medium.
- Structural-claim verbs: "carries the surface rhythm", "has been overworked and reads deadened", "the loaded rim holds the form because…", "the dry drag scatters the light where it should be grouped", "the hatch field organises the wall as a single plane."
- Teacher moves tend to protect a working mark economy, scrape back a deadened passage, vary mark direction in a flattening area, reserve a dry passage against a loaded one.`;
    case 'Presence, point of view, and human force':
      return `What insight looks like for Presence, point of view, and human force:
- This axis is about whether the painting addresses a viewer — whether it feels inhabited, whether there is a specific point of view, whether the picture makes bodily / psychological pressure visible. The anchor must be a physical carrier passage on the canvas, not a mood word.
- What tends to matter: which passage carries the bodily pressure (a tilt, a contact, a gaze, a compression of bodies, an encounter between forms); the point of view the picture takes (over the shoulder, across the room, from below); whether other passages back that point of view or dilute it.
- Structural-claim verbs: "addresses the viewer through", "withholds presence because…", "the inward tilt carries all the human pressure", "the staging feels inhabited because…", "the figure is present but the picture is not about being near it."
- Teacher moves tend to preserve the specific carrier of presence, quiet a passage that's pulling attention away from it, or strengthen a point-of-view cue in a named passage.`;
  }
}

export function buildCriterionPrompt(args: {
  criterion: CriterionLabel;
  style: string;
  medium: string;
  userTitle?: string;
  observationBank: ObservationBank;
  topLevelContext: Pick<
    ObservationBankStageResult,
    'intentHypothesis' | 'strongestVisibleQualities' | 'mainTensions'
  >;
}): string {
  const { criterion, style, medium, userTitle, observationBank, topLevelContext } = args;
  const titleLine = userTitle ? ` The artist titled this work: "${userTitle}".` : '';

  const passagesBlock = observationBank.passages
    .map((p) => `  ${p.id} (${p.role}): ${p.label}`)
    .join('\n');

  const eventsBlock = observationBank.visibleEvents
    .map((e) => `  ${e.passageId} [${e.signalType}] ${e.event}`)
    .join('\n');

  const carriersBlock = observationBank.intentCarriers
    .map((c) => `  ${c.passageId} — ${c.passage}: ${c.reason}`)
    .join('\n');

  const mediumCuesBlock = observationBank.mediumCues.map((cue) => `  - ${cue}`).join('\n');
  const photoCaveatsBlock = observationBank.photoCaveats.length
    ? observationBank.photoCaveats.map((cue) => `  - ${cue}`).join('\n')
    : '  (none)';

  return [
    `Write the per-criterion critique block for ONE criterion of ONE painting: ${criterion}.`,
    `Style: ${style}. Medium: ${medium}.${titleLine}`,
    '',
    criterionInsightGuidance(criterion),
    '',
    'Shared observation bank (same for every criterion in this painting):',
    '',
    'Passages (you may reuse any of these as your anchor — copy the label verbatim when it fits this criterion):',
    passagesBlock,
    '',
    'Visible events (event-first observations keyed to passage ids):',
    eventsBlock,
    '',
    'Intent / presence carriers (passages that visibly carry pressure, address, contact):',
    carriersBlock,
    '',
    'Medium cues (what the declared medium is actually doing in this image):',
    mediumCuesBlock,
    '',
    'Photo caveats (what the photograph hides or distorts):',
    photoCaveatsBlock,
    '',
    `Painting-wide context:`,
    `- Intent hypothesis: ${topLevelContext.intentHypothesis}`,
    `- Strongest visible qualities: ${topLevelContext.strongestVisibleQualities.join('; ') || '(none recorded)'}`,
    `- Main tensions: ${topLevelContext.mainTensions.join('; ') || '(none recorded)'}`,
    '',
    'Your job for this criterion:',
    '- Pick ONE anchor passage: either copy a passages[].label verbatim from the bank above when it genuinely fits this criterion, or name a new locatable passage you can see in the image. Anchor must be a noun phrase that fits after "in": downstream prose writes "In [areaSummary], …".',
    '- Locate that anchor in the photograph as a normalized bounding box (x, y, width, height in 0–1 coords).',
    '- Write 3–6 junction-level visibleEvidence lines. The FIRST line must reuse the concrete nouns from anchor.areaSummary and describe one visible event there.',
    `- Write Voice A (critic) — instructional register, 2–4 sentences, declarative and evaluative. Follow the Voice A paragraph shape from the system message. For ${criterion} specifically, name the anchored passage, say what is happening there on this axis (value / color / edge / surface / drawing / composition / intent / presence as appropriate), then the structural consequence — what this passage does for the painting on this criterion.`,
    `- Write Voice B (teacher) — instructional register, 2–4 sentences, imperative. Follow the four-beat shape. One primary move, starting with a concrete studio verb. Respect the declared medium (${medium}): do not recommend moves the medium would fight.`,
    '- Write preserve — one short sentence naming a specific visible strength nearby that the artist should protect.',
    '- Emit editPlan — the structured spec the AI-edit endpoint reads directly. intendedChange must start with a concrete studio verb, or with a preserve verb if the criterion is already working. editability = "yes" if intendedChange is a real change; "no" if the criterion is already working and the plan is a preserve instruction.',
    '- Set confidence ("low" / "medium" / "high") based on how well the visible evidence in the photo supports this criterion read. Put hedging here, not in the prose.',
    '',
    'Reminders:',
    '- Stay on THIS painting. No studio-generic advice, no textbook definitions, no "paintings in general".',
    '- Never name critics, teachers, artists, famous artworks, or art-historical movements in the text you emit.',
    '- The framework is painting-agnostic: figurative, landscape, still life, abstract, representational, non-objective — use the shape that fits what the image actually contains.',
  ].join('\n');
}

type OpenAIChatCompletion = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string };
};

const MAX_CRITERION_AUDIT_RETRIES = 1;
const GENERIC_ANCHOR_WORDS = new Set([
  'area',
  'areas',
  'composition',
  'canvas',
  'painting',
  'picture',
  'work',
  'image',
  'scene',
  'section',
  'passage',
  'color',
  'colors',
  'edge',
  'edges',
  'value',
  'values',
  'light',
  'surface',
  'space',
  'form',
  'forms',
  'main',
  'overall',
  'some',
]);

async function callCriterionStage(args: {
  apiKey: string;
  model: string;
  userContent: VisionUserMessagePart[];
}): Promise<unknown> {
  const body = {
    model: args.model,
    messages: [
      { role: 'system', content: PARALLEL_CRITERIA_SYSTEM_MESSAGE },
      { role: 'user', content: args.userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: CRITERION_JSON_SCHEMA,
    },
    // Per-criterion writer calls see the image and do per-axis perception
    // + prose + anchor region + editPlan in one response. `low` was too
    // tight — the model spread its reasoning budget across nine output
    // fields and the prose (Voice A + Voice B) suffered. `medium` gives
    // room to think structurally about the anchored passage without
    // blowing the pipeline latency budget: the 8 writer calls run in
    // parallel so a per-call bump affects the critical path only by the
    // *longest* call, not 8x.
    //
    // Pair with a headroom bump on max_completion_tokens (1400 → 1800,
    // which becomes 7200 on reasoning models after the 4x multiplier in
    // buildOpenAIMaxTokensParam). The extra headroom gives the model
    // more space for reasoning tokens AND prevents the prose fields
    // from being truncated when the reasoning path goes long.
    ...buildOpenAISamplingParam(args.model, { temperature: 0.2, reasoningEffort: 'medium' }),
    ...buildOpenAIMaxTokensParam(args.model, 1800),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI criterion stage error ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAIChatCompletion;
  if (json.error?.message) {
    throw new Error(`OpenAI criterion stage error: ${json.error.message}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenAI criterion stage returned empty content.');
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(
      `OpenAI criterion stage returned non-JSON content: ${errorMessage(parseError)}; preview=${content.slice(0, 200)}`
    );
  }
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !GENERIC_ANCHOR_WORDS.has(word));
}

function normaliseConfidence(value: unknown): 'low' | 'medium' | 'high' {
  return value === 'high' || value === 'medium' ? value : 'low';
}

function clampRegion(raw: unknown): { x: number; y: number; width: number; height: number } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const toNumber = (value: unknown, fallback: number): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const x = Math.min(1, Math.max(0, toNumber(r.x, 0.2)));
  const y = Math.min(1, Math.max(0, toNumber(r.y, 0.2)));
  let width = Math.min(1, Math.max(0.02, toNumber(r.width, 0.35)));
  let height = Math.min(1, Math.max(0.02, toNumber(r.height, 0.35)));
  if (x + width > 1) width = Math.max(0.02, 1 - x);
  if (y + height > 1) height = Math.max(0.02, 1 - y);
  return { x, y, width, height };
}

function parseWriterOutput(
  criterion: CriterionLabel,
  raw: unknown
): CriterionWritingResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const anchorRaw = (r.anchor ?? {}) as Record<string, unknown>;
  const editPlanRaw = (r.editPlan ?? {}) as Record<string, unknown>;
  const visibleEvidence = Array.isArray(r.visibleEvidence)
    ? (r.visibleEvidence as unknown[]).filter(
        (line): line is string => typeof line === 'string' && line.trim().length > 0
      )
    : [];
  const editability = editPlanRaw.editability === 'no' ? 'no' : 'yes';
  const anchor: CriterionAnchor = {
    areaSummary: typeof anchorRaw.areaSummary === 'string' ? anchorRaw.areaSummary.trim() : '',
    evidencePointer:
      typeof anchorRaw.evidencePointer === 'string' ? anchorRaw.evidencePointer.trim() : '',
    region: clampRegion(anchorRaw.region),
  };
  const editPlan: CriterionEditPlan = {
    targetArea: typeof editPlanRaw.targetArea === 'string' ? editPlanRaw.targetArea.trim() : '',
    preserveArea:
      typeof editPlanRaw.preserveArea === 'string' ? editPlanRaw.preserveArea.trim() : '',
    issue: typeof editPlanRaw.issue === 'string' ? editPlanRaw.issue.trim() : '',
    intendedChange:
      typeof editPlanRaw.intendedChange === 'string' ? editPlanRaw.intendedChange.trim() : '',
    expectedOutcome:
      typeof editPlanRaw.expectedOutcome === 'string'
        ? editPlanRaw.expectedOutcome.trim()
        : '',
    editability,
  };
  return {
    criterion,
    anchor,
    visibleEvidence,
    tensionRead: typeof r.tensionRead === 'string' ? r.tensionRead.trim() : '',
    voiceACritique: typeof r.voiceACritique === 'string' ? r.voiceACritique.trim() : '',
    voiceBSuggestions:
      typeof r.voiceBSuggestions === 'string' ? r.voiceBSuggestions.trim() : '',
    preserve: typeof r.preserve === 'string' ? r.preserve.trim() : '',
    editPlan,
    confidence: normaliseConfidence(r.confidence),
  };
}

function auditCriterionResult(result: CriterionWritingResult): string[] {
  const issues: string[] = [];
  const anchor = result.anchor.areaSummary.trim();
  const pointer = result.anchor.evidencePointer.trim();
  const evidence = result.visibleEvidence.map((line) => line.trim()).filter(Boolean);
  const anchorTokens = normalizeWords(anchor);
  const firstEvidence = evidence[0]?.toLowerCase() ?? '';
  const allEvidence = evidence.join(' ').toLowerCase();
  const voiceA = result.voiceACritique.trim();
  const voiceB = result.voiceBSuggestions.trim();
  const editPlan = result.editPlan;

  if (anchor.length < 12 || anchorTokens.length < 2) {
    issues.push('anchor.areaSummary is too generic to locate confidently on the painting');
  }
  if (pointer.length < 18) {
    issues.push('anchor.evidencePointer is too thin to verify the selected passage');
  }
  if (evidence.length < 3) {
    issues.push('visibleEvidence has fewer than three concrete observations');
  }
  if (
    anchorTokens.length >= 2 &&
    evidence.length > 0 &&
    anchorTokens.filter((token) => firstEvidence.includes(token)).length < Math.min(2, anchorTokens.length)
  ) {
    issues.push('first visibleEvidence line does not reuse the concrete anchor nouns');
  }
  if (
    anchorTokens.length >= 2 &&
    anchorTokens.filter((token) => allEvidence.includes(token)).length < Math.min(2, anchorTokens.length)
  ) {
    issues.push('visibleEvidence does not appear tied to the anchor passage');
  }
  if (voiceA.length < 80 || !voiceA.toLowerCase().includes(anchor.toLowerCase().slice(0, 12))) {
    issues.push('Voice A is too short or does not clearly name the anchor passage');
  }
  if (voiceB.length < 80 || !voiceB.toLowerCase().includes(anchor.toLowerCase().slice(0, 12))) {
    issues.push('Voice B is too short or does not clearly name the anchor passage');
  }
  if (!editPlan.targetArea || !editPlan.issue || !editPlan.intendedChange || !editPlan.expectedOutcome) {
    issues.push('editPlan is missing one or more machine-usable fields');
  }
  if (result.confidence === 'low' && issues.length > 0) {
    issues.push('confidence is low on an already suspicious criterion output');
  }

  return issues;
}

function buildCriterionRetryPrompt(basePrompt: string, issues: string[]): string {
  return [
    basePrompt,
    '',
    'Quality audit retry:',
    'The previous answer was rejected before synthesis for these reasons:',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Regenerate the full JSON object. Re-check the painting image directly. Pick a more locatable anchor if needed, make the first visibleEvidence line reuse its concrete nouns, and keep Voice A / Voice B tied to that same passage. Do not explain the audit; return only the schema JSON.',
  ].join('\n');
}

/**
 * Fallback `CriterionWritingResult` for a single criterion when its writer
 * call fails. Returns a minimal-safe entry grounded in the observation bank
 * so downstream assembly always has a complete criterion set. Kept simple —
 * the goal is to NOT break the critique, not to synthesize a plausible
 * replacement critique from prose fragments.
 */
function buildCriterionFallback(
  criterion: CriterionLabel,
  observationBank: ObservationBank
): CriterionWritingResult {
  const passage = observationBank.passages[0];
  const anchorLabel = passage?.label ?? 'the main compositional passage';
  const anchorPointer =
    observationBank.visibleEvents.find((e) => e.passageId === passage?.id)?.event ??
    'the primary visible event in this passage';
  return {
    criterion,
    anchor: {
      areaSummary: anchorLabel,
      evidencePointer: anchorPointer,
      region: { x: 0.2, y: 0.2, width: 0.35, height: 0.35 },
    },
    visibleEvidence: [anchorPointer],
    tensionRead: `This criterion did not produce a dedicated read on this pass; revisit ${anchorLabel} for a more specific diagnosis.`,
    voiceACritique: `In ${anchorLabel}, the writer pass for ${criterion.toLowerCase()} did not complete.`,
    voiceBSuggestions: `In ${anchorLabel}, revisit the passage and restate it so it carries its weight on this axis.`,
    preserve: 'Keep the surrounding arrangement while refining execution in the targeted passage.',
    editPlan: {
      targetArea: anchorLabel,
      preserveArea: 'the surrounding passages that are already working',
      issue: 'this criterion did not produce a dedicated evidence block on this pass',
      intendedChange: 'Restate the targeted passage so it carries its weight on this axis.',
      expectedOutcome: 'the passage reads more clearly on this criterion',
      editability: 'no',
    },
    confidence: 'low',
  };
}

async function runCriterionWriterWithAudit(args: {
  apiKey: string;
  model: string;
  criterion: CriterionLabel;
  prompt: string;
  imageMessage: VisionUserMessagePart;
}): Promise<CriterionWritingResult> {
  let prompt = args.prompt;
  let lastResult: CriterionWritingResult | undefined;
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt <= MAX_CRITERION_AUDIT_RETRIES; attempt++) {
    const raw = await callCriterionStage({
      apiKey: args.apiKey,
      model: args.model,
      userContent: [
        { type: 'text', text: prompt },
        args.imageMessage,
      ],
    });
    const result = parseWriterOutput(args.criterion, raw);
    const issues = auditCriterionResult(result);
    if (issues.length === 0) {
      if (attempt > 0) {
        console.log(`[critique criterion audit] ${args.criterion} passed after retry`);
      }
      return result;
    }

    lastResult = result;
    lastIssues = issues;
    if (attempt < MAX_CRITERION_AUDIT_RETRIES) {
      console.warn(`[critique criterion audit] retrying ${args.criterion}: ${issues.join('; ')}`);
      prompt = buildCriterionRetryPrompt(args.prompt, issues);
    }
  }

  console.warn(
    `[critique criterion audit] ${args.criterion} kept after retry with issues: ${lastIssues.join('; ')}`
  );
  return lastResult!;
}

/**
 * Run all eight criterion writer calls concurrently. Each writer sees the
 * painting image + the shared observation bank and owns anchor picking,
 * evidence lines, voice A / voice B prose, the structured editPlan, and the
 * anchor's bounding box in the photo. Failures in a single criterion do not
 * cancel the others; a failed call produces a low-confidence fallback.
 */
export async function runParallelCriteriaStage(args: {
  apiKey: string;
  model: string;
  style: string;
  medium: string;
  userTitle?: string;
  imageDataUrl: string;
  observationBank: ObservationBank;
  topLevelContext: Pick<
    ObservationBankStageResult,
    'intentHypothesis' | 'strongestVisibleQualities' | 'mainTensions'
  >;
}): Promise<{
  results: CriterionWritingResult[];
  failedCriteria: Array<{ criterion: CriterionLabel; reason: string }>;
}> {
  const start = Date.now();
  console.log(
    `[critique parallel criteria] launching ${CRITERIA_ORDER.length} concurrent writer calls (model=${args.model})`
  );

  const imageMessage = buildHighDetailImageMessage(args.imageDataUrl);

  const settled = await Promise.allSettled(
    CRITERIA_ORDER.map(async (criterion) => {
      const prompt = buildCriterionPrompt({
        criterion,
        style: args.style,
        medium: args.medium,
        userTitle: args.userTitle,
        observationBank: args.observationBank,
        topLevelContext: args.topLevelContext,
      });
      return runCriterionWriterWithAudit({
        apiKey: args.apiKey,
        model: args.model,
        criterion,
        prompt,
        imageMessage,
      });
    })
  );

  const results: CriterionWritingResult[] = [];
  const failedCriteria: Array<{ criterion: CriterionLabel; reason: string }> = [];
  settled.forEach((outcome, index) => {
    const criterion = CRITERIA_ORDER[index]!;
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
      return;
    }
    const reason = errorMessage(outcome.reason);
    console.warn(`[critique parallel criteria] ${criterion} failed: ${reason}`);
    failedCriteria.push({ criterion, reason });
    results.push(buildCriterionFallback(criterion, args.observationBank));
  });

  const elapsed = Date.now() - start;
  console.log(
    `[critique parallel criteria] ${CRITERIA_ORDER.length} writer calls complete in ${(elapsed / 1000).toFixed(1)}s (longest-call bound; ${failedCriteria.length} fell back)`
  );

  return { results, failedCriteria };
}
