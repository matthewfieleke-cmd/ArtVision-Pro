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
    // Per-criterion writer calls see the image and do per-axis perception +
    // prose + anchor region + editPlan. Keep reasoning_effort at `low`: the
    // work is well-scoped, the observation bank has already done the shared
    // perception, and end-to-end pipeline latency is the gating product
    // constraint. Bump to `medium` only if per-criterion insight noticeably
    // thins out in production.
    ...buildOpenAISamplingParam(args.model, { temperature: 0.2, reasoningEffort: 'low' }),
    ...buildOpenAIMaxTokensParam(args.model, 1400),
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
      const userContent: VisionUserMessagePart[] = [
        { type: 'text', text: prompt },
        imageMessage,
      ];
      const raw = await callCriterionStage({
        apiKey: args.apiKey,
        model: args.model,
        userContent,
      });
      return parseWriterOutput(criterion, raw);
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
