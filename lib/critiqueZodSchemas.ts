/**
 * Single source of truth for Voice B critique stage schemas.
 *
 * Zod schemas define the canonical shape. From each Zod schema we derive:
 *   1. TypeScript types  — z.infer<typeof …>
 *   2. OpenAI strict JSON Schema objects — via z.toJSONSchema()
 *   3. Runtime validation — schema.parse() / schema.safeParse()
 *
 * This eliminates the class of bug where a field name or optionality
 * drifts between the JSON Schema, the stage result type, the DTO, or
 * the validation function.
 */
import { z } from 'zod';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import {
  VOICE_A_SCHEMA_REMINDER,
  VOICE_B_SCHEMA_REMINDER,
} from '../shared/critiqueVoiceA.js';

const criterionEnum = z.enum(CRITERIA_ORDER as unknown as [string, ...string[]]);
const ratingLevelEnum = z.enum(RATING_LEVELS as unknown as [string, ...string[]]);
const confidenceEnum = z.enum(['low', 'medium', 'high']);
/** Align with CRITIQUE_CHANGE_VERB_PATTERN ∪ CRITIQUE_PRESERVE_VERB_PATTERN in critiqueTextRules.ts */
const studioVerbPattern =
  /^\s*(soften|group|separate|darken|quiet|restate|widen|narrow|cool|warm|sharpen|lose|compress|vary|lighten|lift|simplify|straighten|merge|break|integrate|adjust|reduce|shift|refine|preserve|keep|protect|leave|hold|maintain|continue)\b/i;

// ---------------------------------------------------------------------------
// Shared sub-objects
// ---------------------------------------------------------------------------

export const normalizedRegionSchema = z
  .object({
    x: z
      .number()
      .min(0)
      .max(1)
      .describe('Left edge of the bounding box in normalized image coordinates (0 = left, 1 = right).'),
    y: z
      .number()
      .min(0)
      .max(1)
      .describe('Top edge of the bounding box in normalized image coordinates (0 = top, 1 = bottom).'),
    width: z
      .number()
      .gt(0)
      .max(1)
      .describe('Width of the box as a fraction of full image width; x + width must not exceed 1.'),
    height: z
      .number()
      .gt(0)
      .max(1)
      .describe('Height of the box as a fraction of full image height; y + height must not exceed 1.'),
  })
  .describe(
    'Axis-aligned box in the SAME photo the critique analyzed. It must tightly cover the visible passage described by areaSummary and evidencePointer: include the concrete forms and relationships named there; avoid large unrelated empty areas. If the text names a relationship between two visible masses, span both so their junction lies inside the box. Match vertical band to the words: foreground / bridge / path / railing implies the box reaches toward the bottom of the frame; sky-only anchors sit higher. Prefer an elongated box along a named diagonal (bridge, path) rather than a centered square that misses the structure.'
  );

export const anchorSchema = z.object({
  areaSummary: z.string().min(8).describe(
    'Short phrase naming one exact, recognizable visible passage in THIS painting that Voice A and Voice B are both discussing. It must point to content a user could locate, not a conceptual label.'
  ),
  evidencePointer: z.string().min(16).describe(
    'What visible relationship in that exact passage drives this criterion read in THIS painting. Name the concrete visual fact there now.'
  ),
  region: normalizedRegionSchema,
});

export const editPlanSchema = z.object({
  targetArea: z.string().min(8).describe('Same passage as anchor.areaSummary.'),
  preserveArea: z.string().min(8).describe('What nearby success must remain untouched while editing.'),
  issue: z.string().min(16).describe(
    'The specific visual problem or strength in that anchored passage right now. Must name what is visibly happening there, not a generic goal.'
  ),
  intendedChange: z.string().min(12).regex(studioVerbPattern).describe(
    'Exact directional move for the AI preview to make in that passage only. For non-Master rows, start with a concrete change verb. For Master rows, start with a preserve verb such as preserve, keep, protect, leave, or hold.'
  ),
  expectedOutcome: z.string().min(16).describe(
    'What the painting should read like after that change in that same passage. Must describe the resulting visual read, not a generic improvement slogan.'
  ),
  editability: z.enum(['yes', 'no']).describe(
    'Whether the edit model should attempt this criterion change. Master rows may still be no when there is nothing to change.'
  ),
});

export const voiceBStepSchema = z.object({
  area: z.string().min(8).describe(
    'A visible, locatable passage in THIS painting that a user could point to — e.g. "the terracotta pot against the red path" or "the blue delphiniums at left". NEVER use abstract placeholders like "arrangement of elements", "areas where energy is evident", "spatial relationships", or "the composition". If the criterion is conceptual (Intent, Presence), still name the physical passage that carries it.'
  ),
  currentRead: z.string().min(16).describe(
    'What is visibly happening in that specific passage right now — name colors, shapes, edges, or spatial relationships you can see. NEVER write "could be more unified", "feels less necessary", or other judgment-only language without naming what you see.'
  ),
  move: z.string().min(12).regex(studioVerbPattern).describe(
    'One specific directional move for that passage. For non-Master criteria, it must start with a concrete CHANGE verb (soften, darken, cool, group, separate, sharpen, widen, compress, vary, etc.) applied to a named visual element. For Master criteria, it must instead start with a preserve verb such as preserve, keep, protect, leave, or hold. NEVER write "adjust elements", "enhance presence", "ensure consistency", "improve structure", or "strengthen" without saying what exactly to do to what.'
  ),
  expectedRead: z.string().min(16).describe('What that same passage should read like after the move — describe the visual result, not an abstract improvement.'),
  preserve: z.string().min(8).describe('What specific nearby success to protect while making the change.'),
  priority: z.enum(['primary', 'secondary']),
});

export const voiceBPlanSchema = z.object({
  currentRead: z.string().min(16).describe('What this anchored passage is visibly doing now — name what you see (colors, edges, shapes, spatial events), not abstract qualities.'),
  mainProblem: z.string().describe('The specific visible problem in that passage — what two things compete, merge, or misalign. Empty string if none.'),
  mainStrength: z.string().describe('The specific visible strength to preserve — name the exact relationship that works. Empty string if none.'),
  bestNextMove: z.string().min(12).regex(studioVerbPattern).describe('One concrete move + target: what to physically do in that passage. For non-Master rows, start with a change verb. For Master rows, start with a preserve verb. Must name the visual element or relationship at stake.'),
  optionalSecondMove: z.string().describe('A second distinct move if needed, or empty string.'),
  avoidDoing: z.string().describe('What not to break or overdo in that passage, or empty string.'),
  expectedRead: z.string().min(16).describe('What the passage should look like after the move — describe the visual result.'),
  storyIfRelevant: z.string().describe('The specific narrative or dramatic situation visible in this painting, or empty string if not relevant.'),
});

export const voiceBCanonicalPlanSchema = z.object({
  currentRead: z.string().min(16).describe(
    'Canonical Voice B current read for the anchored passage. Name the visible fact in that passage now, not an abstract diagnosis.'
  ),
  move: z.string().min(12).regex(studioVerbPattern).describe(
    'Canonical Voice B move for the anchored passage. For non-Master criteria, begin with a true change verb; for Master criteria, begin with a preserve verb.'
  ),
  expectedRead: z.string().min(16).describe(
    'Canonical Voice B expected read after the move in that same anchored passage.'
  ),
  preserve: z.string().describe(
    'Nearby success to protect while making the move. Use empty string if there is nothing specific to preserve.'
  ),
  editability: z.enum(['yes', 'no']).describe(
    'Whether this criterion should be available for AI edit preview generation.'
  ),
});

// ---------------------------------------------------------------------------
// Voice A stage result
// ---------------------------------------------------------------------------

const voiceASubskillSchema = z.object({
  label: z.string(),
  score: z.number(),
  level: ratingLevelEnum,
});

const critiquePhase1Schema = z.object({
  visualInventory: z.string().describe(
    `Phase 1 — objective extraction only for THIS criterion. Quote or paraphrase this criterion's anchor, then add detail from at least two different visibleEvidence lines. Name motifs, quadrants, colors, edges, intervals—never vague "the painting" or "the composition" without the anchored passage. No judgment verbs ("works", "fails", "weak"). ${VOICE_A_SCHEMA_REMINDER}`
  ),
});

const critiquePhase2Schema = z.object({
  criticsAnalysis: z.string().describe(
    `Phase 2 — Voice A: 2–4 sentences tied to THIS criterion's anchor and visibleEvidence. Every sentence should let a reader locate the passage on the photo. No diagnosis of "the work as a whole" without naming concrete forms from the evidence. Rating rationale without repeating the same fact twice. ${VOICE_A_SCHEMA_REMINDER}`
  ),
});

const critiquePhase3Schema = z.object({
  teacherNextSteps: z.string().describe(
    `Phase 3 — Voice B: 2–3 short sentences, one primary move, plain studio English. Name the passage once (do not paste anchor.areaSummary as a title then repeat it). Lead with one concrete visible read, then an imperative move, then a brief outcome; avoid repeating the same mood words in lead and outcome. After "In [passage], " use lowercase for the next word unless a proper noun. ${VOICE_B_SCHEMA_REMINDER} Use "Don't change a thing." ONLY if level is Master (then follow with what is exemplary in the anchored passage).`
  ),
});

const voiceACategorySchema = z.object({
  criterion: criterionEnum,
  level: ratingLevelEnum.describe(
    `Voice A's quality ranking for THIS criterion only (one of eight independent axes). ${VOICE_A_SCHEMA_REMINDER}`
  ),
  phase1: critiquePhase1Schema,
  phase2: critiquePhase2Schema,
  confidence: confidenceEnum,
  evidenceSignals: z
    .array(z.string().min(12))
    .min(2)
    .max(4)
    .describe(
      '2–4 short lines: each must distill one distinct junction or fact from this criterion’s visibleEvidence in the supplied JSON. Do not add new locations or claims that are not supported by visibleEvidence.'
    ),
  preserve: z.string(),
  nextTarget: z.string(),
  subskills: z.array(voiceASubskillSchema).min(2).max(4),
});

const photoQualitySchema = z.object({
  level: z.enum(['poor', 'fair', 'good']),
  summary: z.string(),
  issues: z.array(z.string()),
  tips: z.array(z.string()),
});

export const suggestedTitleSchema = z.object({
  category: z.enum(['formalist', 'tactile', 'intent']).describe(
    'Title category: formalist (structural/compositional), tactile (medium/surface/execution), or intent (mood/psychology/narrative).'
  ),
  title: z.string().describe(
    'Short working title (often sentence case). No quotes. Avoid exhibition clichés and formulaic endings. Ground in THIS painting’s evidence.'
  ),
  rationale: z.string().describe(
    'One clear sentence on how the critique for this painting supports the title—plain speech, not thesis language.'
  ),
});

export const voiceAStageResultSchema = z.object({
  summary: z.string().describe(
    'Voice A primary overall summary: 3–5 sentences in plain critical prose, grounded in multiple concrete passages from the painting. It should read like a compact serious critique, not a slogan or one-line synopsis.'
  ),
  suggestedPaintingTitles: z.array(suggestedTitleSchema).min(3).max(3).describe(
    'Three sketchbook-style titles: formalist, tactile, intent. Modest and specific; rationales in normal speech.'
  ),
  overallSummary: z.object({
    analysis: z.string().describe(
      'Voice A supporting overall analysis: mention style and medium, and name multiple specific passages or motifs from the evidence (not one vague overview). Keep it distinct from summary rather than repeating the same lines.'
    ),
  }),
  studioAnalysis: z.object({
    whatWorks: z.string().describe(
      `Voice A: strengths with named passages from evidence—at least two distinct anchored areas or evidence motifs. ${VOICE_A_SCHEMA_REMINDER}`
    ),
    whatCouldImprove: z.string().describe(
      `Voice A: tensions with named passages—at least two distinct anchored areas; no "some areas" without naming them from evidence. ${VOICE_A_SCHEMA_REMINDER}`
    ),
  }),
  comparisonNote: z.string().nullable(),
  overallConfidence: confidenceEnum,
  photoQuality: photoQualitySchema,
  categories: z.array(voiceACategorySchema).min(CRITERIA_ORDER.length).max(CRITERIA_ORDER.length),
});

// ---------------------------------------------------------------------------
// Voice B stage result
// ---------------------------------------------------------------------------

export const voiceBCategorySchema = z.object({
  criterion: criterionEnum,
  phase3: critiquePhase3Schema,
  anchor: anchorSchema,
  plan: voiceBCanonicalPlanSchema.describe(
    'Canonical Voice B plan for THIS criterion only. This is the primary machine-usable teaching plan; legacy actionPlan/edit fields may be derived from it.'
  ),
  actionPlanSteps: z.array(voiceBStepSchema).length(1).optional().describe(
    'Legacy compatibility field derived from plan for preview/edit consumers that still expect one structured step.'
  ),
  voiceBPlan: voiceBPlanSchema.optional().describe(
    'Legacy compatibility field derived from plan for older consumers.'
  ),
  editPlan: editPlanSchema.optional().describe(
    'Legacy compatibility field derived from plan for preview/edit consumers.'
  ),
});

export const studioChangeSchema = z.object({
  text: z.string().min(24).describe(
    `Voice B: one concrete change—where, what, how—for THIS painting only. ${VOICE_B_SCHEMA_REMINDER}`
  ),
  previewCriterion: criterionEnum,
});

export const voiceBStageResultSchema = z.object({
  overallSummary: z.object({
    topPriorities: z.array(
      z.string().describe(
        'Voice B top priority only for THIS painting. Start with one primary action tied to a visible passage.'
      )
    ).min(1).max(2),
  }),
  studioChanges: z.array(studioChangeSchema).min(2).max(5),
  categories: z.array(voiceBCategorySchema).min(CRITERIA_ORDER.length).max(CRITERIA_ORDER.length),
});

// ---------------------------------------------------------------------------
// Evidence stage result
// ---------------------------------------------------------------------------

const completionReadSchema = z.object({
  state: z.enum(['unfinished', 'likely_finished', 'uncertain']),
  confidence: confidenceEnum,
  cues: z.array(z.string()).min(1).max(4),
  rationale: z.string(),
});

const photoQualityReadSchema = z.object({
  level: z.enum(['poor', 'fair', 'good']),
  summary: z.string(),
  issues: z.array(z.string()).min(0).max(4),
});

const observationPassageSchema = z.object({
  id: z.string().regex(/^p\d{1,2}$/).describe(
    'Stable passage id such as "p1" or "p2". Later stages will reuse this passage by id and copy the label verbatim when it fits.'
  ),
  label: z.string().min(10).describe(
    'One locatable visible passage in the painting, written as a physical carrier phrase such as "the jaw edge against the dark collar" or "the reflection crossing the harbor water".'
  ),
  role: z.enum(['structure', 'value', 'color', 'edge', 'surface', 'intent', 'presence']).describe(
    'What kind of visual carrier this passage most strongly serves.'
  ),
  visibleFacts: z.array(z.string().min(16)).min(2).max(4).describe(
    '2-4 concrete, visible facts about this same passage only.'
  ),
});

const observationEventSchema = z.object({
  passageId: z.string().regex(/^p\d{1,2}$/).describe(
    'The stable passage id this event belongs to.'
  ),
  passage: z.string().min(10).describe(
    'The exact passage label this event belongs to, copied verbatim from passages[].label.'
  ),
  event: z.string().min(16).describe(
    'One visible event in that passage, written in event-first language.'
  ),
  signalType: z.enum(['shape', 'value', 'color', 'edge', 'space', 'surface']).describe(
    'Primary visual signal this event belongs to.'
  ),
});

const observationCarrierSchema = z.object({
  passageId: z.string().regex(/^p\d{1,2}$/).describe(
    'The stable passage id for this intent or presence carrier.'
  ),
  passage: z.string().min(10).describe(
    'One physical carrier passage for intent or presence, copied verbatim from passages[].label.'
  ),
  reason: z.string().min(16).describe(
    'Why this passage seems to carry intent or presence, still grounded in visible form.'
  ),
});

export const observationBankSchema = z.object({
  passages: z.array(observationPassageSchema).min(6).max(12),
  visibleEvents: z.array(observationEventSchema).min(10).max(22),
  mediumCues: z.array(z.string().min(12)).min(3).max(6),
  photoCaveats: z.array(z.string().min(8)).min(0).max(4),
  intentCarriers: z.array(observationCarrierSchema).min(2).max(4),
});

const criterionEvidenceSchema = z.object({
  criterion: criterionEnum,
  observationPassageId: z.string().regex(/^p\d{1,2}$/).describe(
    'The observation-bank passages[].id chosen for this criterion. Choose one reusable shared passage and copy its label verbatim into anchor.'
  ),
  anchor: z.string().min(12).describe(
    'One specific locatable anchor for this criterion: copy the chosen observation-bank passage label verbatim when it genuinely fits this criterion. Do not paraphrase it into a broader summary.'
  ),
  visibleEvidence: z.array(
    z.string().describe(
      'One junction-level observation for this criterion. Required shape: where on the canvas (quadrant or named motif) + thing A + thing B + what happens at their meeting (value, color temp, edge, overlap, scale). Aim for 40+ characters when the image supports it. NEVER vague area praise or "some edges." Spread observations across different parts of the picture when possible.'
    )
  ).min(4).max(8),
  strengthRead: z.string().min(16).describe(
    'What already works for this criterion in this painting. Name the specific passage and relationship that succeeds — not "good composition" but "the diagonal of figures from lower-left to upper-right creates a clear reading path through the office."'
  ),
  tensionRead: z.string().min(16).describe(
    'What is unresolved for this criterion, if anything. Name the specific passage and what competes, merges, or misaligns there. If nothing is genuinely unresolved, say so plainly. NEVER manufacture a tension just to fill this field.'
  ),
  preserve: z.string().min(16).describe(
    'What specific relationship in this painting must survive any revision for this criterion. Name the passage and the visual event to protect.'
  ),
  confidence: confidenceEnum,
});

export const evidenceStageResultSchema = z.object({
  intentHypothesis: z.string(),
  strongestVisibleQualities: z.array(z.string()).min(2).max(4),
  mainTensions: z.array(z.string()).min(2).max(4),
  photoQualityRead: photoQualityReadSchema,
  comparisonObservations: z.array(z.string()).min(0).max(4),
  completionRead: completionReadSchema,
  criterionEvidence: z.array(criterionEvidenceSchema).min(CRITERIA_ORDER.length).max(CRITERIA_ORDER.length),
});

/**
 * Per-criterion anchor region carried by the unified vision call (Merge C).
 * The vision model has the image loaded for the observation/evidence work
 * already, so it produces the normalized bounding box for each criterion's
 * anchor in the same response. Downstream code copies these into
 * `categories[].anchor.region` after voice B + guardrails, replacing the
 * dedicated `refineCritiqueAnchorRegionsFromImage` round-trip that used to
 * re-ask a vision model for the same boxes.
 */
export const criterionAnchorRegionSchema = z.object({
  criterion: criterionEnum,
  region: normalizedRegionSchema,
});

/**
 * Unified vision-stage schema (Merge A + Merge C): the observation bank, the
 * evidence object, and per-criterion anchor regions are all produced by ONE
 * OpenAI call. The model sees the image once, builds the shared observation
 * bank, picks per-criterion evidence anchored back to those passages, and
 * locates each anchor in the photo with normalized box coordinates. Cuts two
 * full vision round-trips and removes the cross-call drift where the evidence
 * model or the late region-refine model could disagree with passages they did
 * not generate themselves.
 *
 * The two prose halves are kept as nested objects so the existing
 * `parseObservationStageResult` / `validateEvidenceResult` validators (and
 * every downstream consumer) work unchanged on the split parts.
 */
export const visionStageResultSchema = z.object({
  observationBank: observationBankSchema,
  evidence: evidenceStageResultSchema,
  anchorRegions: z
    .array(criterionAnchorRegionSchema)
    .length(CRITERIA_ORDER.length)
    .describe(
      `Exactly ${CRITERIA_ORDER.length} per-criterion bounding boxes (one for every criterion in the canonical order). Each box must tightly cover the visible passage named by that criterion's evidence anchor in the painting photograph.`
    ),
});

// ---------------------------------------------------------------------------
// Convert Zod schema to OpenAI strict JSON Schema wrapper
// ---------------------------------------------------------------------------

export function toOpenAIJsonSchema(
  name: string,
  schema: z.ZodType
): { name: string; strict: true; schema: Record<string, unknown> } {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema['$schema'];
  return { name, strict: true, schema: jsonSchema };
}

// ---------------------------------------------------------------------------
// Generated OpenAI JSON Schema objects
// ---------------------------------------------------------------------------

export const VOICE_A_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_voice_a',
  voiceAStageResultSchema
);

export const VOICE_B_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_voice_b',
  voiceBStageResultSchema
);

export const EVIDENCE_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_evidence',
  evidenceStageResultSchema
);

export const OBSERVATION_BANK_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_observation_bank',
  observationBankSchema
);

export const VISION_STAGE_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_vision',
  visionStageResultSchema
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type VoiceAStageResult = z.infer<typeof voiceAStageResultSchema>;
export type VoiceBStageResult = z.infer<typeof voiceBStageResultSchema>;
export type EvidenceStageResult = z.infer<typeof evidenceStageResultSchema>;
export type ObservationBank = z.infer<typeof observationBankSchema>;
export type VisionStageResult = z.infer<typeof visionStageResultSchema>;

export type VoiceBPlanZ = z.infer<typeof voiceBPlanSchema>;
export type VoiceBStepZ = z.infer<typeof voiceBStepSchema>;
export type VoiceBCanonicalPlanZ = z.infer<typeof voiceBCanonicalPlanSchema>;
export type CriterionAnchorZ = z.infer<typeof anchorSchema>;
export type CriterionEditPlanZ = z.infer<typeof editPlanSchema>;
export type NormalizedRegionZ = z.infer<typeof normalizedRegionSchema>;
