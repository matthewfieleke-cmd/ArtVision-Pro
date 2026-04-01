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

// ---------------------------------------------------------------------------
// Shared sub-objects
// ---------------------------------------------------------------------------

export const normalizedRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const anchorSchema = z.object({
  areaSummary: z.string().describe(
    'Short phrase naming one exact, recognizable visible passage in THIS painting that Voice A and Voice B are both discussing. It must point to content a user could locate, not a conceptual label.'
  ),
  evidencePointer: z.string().describe(
    'What visible relationship in that exact passage drives this criterion read in THIS painting. Name the concrete visual fact there now.'
  ),
  region: normalizedRegionSchema,
});

export const editPlanSchema = z.object({
  targetArea: z.string().describe('Same passage as anchor.areaSummary.'),
  preserveArea: z.string().describe('What nearby success must remain untouched while editing.'),
  issue: z.string().describe(
    'The specific visual problem or strength in that anchored passage right now. Must name what is visibly happening there, not a generic goal.'
  ),
  intendedChange: z.string().describe(
    'Exact directional change for the AI preview to make in that passage only. If level is Master, describe preservation rather than revision.'
  ),
  expectedOutcome: z.string().describe(
    'What the painting should read like after that change in that same passage. Must describe the resulting visual read, not a generic improvement slogan.'
  ),
  editability: z.enum(['yes', 'no']).describe(
    'Whether the edit model should attempt this criterion change. Master rows may still be no when there is nothing to change.'
  ),
});

export const voiceBStepSchema = z.object({
  area: z.string().describe(
    'A visible, locatable passage in THIS painting that a user could point to — e.g. "the terracotta pot against the red path" or "the blue delphiniums at left". NEVER use abstract placeholders like "arrangement of elements", "areas where energy is evident", "spatial relationships", or "the composition". If the criterion is conceptual (Intent, Presence), still name the physical passage that carries it.'
  ),
  currentRead: z.string().describe(
    'What is visibly happening in that specific passage right now — name colors, shapes, edges, or spatial relationships you can see. NEVER write "could be more unified", "feels less necessary", or other judgment-only language without naming what you see.'
  ),
  move: z.string().describe(
    'One specific directional verb + what to change in that passage. Must start with a concrete CHANGE verb (soften, darken, cool, group, separate, sharpen, widen, compress, vary, etc.) applied to a named visual element. For non-Master criteria, NEVER lead with "maintain", "preserve", "keep", "continue", or "protect" — those are preservation, not improvement. NEVER write "adjust elements", "enhance presence", "ensure consistency", "improve structure", or "strengthen" without saying what exactly to do to what.'
  ),
  expectedRead: z.string().describe('What that same passage should read like after the move — describe the visual result, not an abstract improvement.'),
  preserve: z.string().describe('What specific nearby success to protect while making the change.'),
  priority: z.enum(['primary', 'secondary']),
});

export const voiceBPlanSchema = z.object({
  currentRead: z.string().describe('What this anchored passage is visibly doing now — name what you see (colors, edges, shapes, spatial events), not abstract qualities.'),
  mainProblem: z.string().describe('The specific visible problem in that passage — what two things compete, merge, or misalign. Empty string if none.'),
  mainStrength: z.string().describe('The specific visible strength to preserve — name the exact relationship that works. Empty string if none.'),
  bestNextMove: z.string().describe('One concrete verb + target: what to physically do in that passage. Must name the visual element to change.'),
  optionalSecondMove: z.string().describe('A second distinct move if needed, or empty string.'),
  avoidDoing: z.string().describe('What not to break or overdo in that passage, or empty string.'),
  expectedRead: z.string().describe('What the passage should look like after the move — describe the visual result.'),
  storyIfRelevant: z.string().describe('The specific narrative or dramatic situation visible in this painting, or empty string if not relevant.'),
});

// ---------------------------------------------------------------------------
// Voice A stage result
// ---------------------------------------------------------------------------

const voiceASubskillSchema = z.object({
  label: z.string(),
  score: z.number(),
  level: ratingLevelEnum,
});

const voiceACategorySchema = z.object({
  criterion: criterionEnum,
  level: ratingLevelEnum.describe(
    `Voice A's quality ranking for THIS criterion only (one of eight independent axes). ${VOICE_A_SCHEMA_REMINDER}`
  ),
  feedback: z.string().describe(
    `Voice A: 3+ sentences—this criterion's critical assessment for THIS painting only. ${VOICE_A_SCHEMA_REMINDER}`
  ),
  confidence: confidenceEnum,
  evidenceSignals: z.array(z.string()).min(2).max(4),
  preserve: z.string(),
  practiceExercise: z.string(),
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
    'Title Case, no quotes. Must avoid cliché, overly poetic, or generic names. Ground in specific analysis data from THIS painting.'
  ),
  rationale: z.string().describe(
    '1–2 sentences explaining exactly how the specific scores and feedback for this painting generated this title.'
  ),
});

export const voiceAStageResultSchema = z.object({
  summary: z.string().describe(
    'Voice A one-sentence synopsis for THIS painting only. Name at least one recognizable passage from the evidence.'
  ),
  suggestedPaintingTitles: z.array(suggestedTitleSchema).min(3).max(3).describe(
    'Exactly three categorized title suggestions: one formalist, one tactile, one intent. Each with a rationale grounded in the criterion analysis.'
  ),
  overallSummary: z.object({
    analysis: z.string().describe(
      'Voice A overall summary for THIS painting only. Mention style and medium lens explicitly.'
    ),
  }),
  studioAnalysis: z.object({
    whatWorks: z.string().describe(
      `Voice A paragraph: specific strengths in THIS painting. ${VOICE_A_SCHEMA_REMINDER}`
    ),
    whatCouldImprove: z.string().describe(
      `Voice A paragraph: tensions or gaps in THIS painting. ${VOICE_A_SCHEMA_REMINDER}`
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

const voiceBCategorySchema = z.object({
  criterion: criterionEnum,
  actionPlan: z.string().describe(
    `Voice B for this criterion on THIS painting only. ${VOICE_B_SCHEMA_REMINDER} Use the exact opener "Don't change a thing." ONLY if level is Master. Else: 1–3 steps (prefer fewer high-leverage steps over padding).`
  ),
  actionPlanSteps: z.array(voiceBStepSchema).min(1).max(3).describe(
    'Voice B structured teaching steps for THIS criterion only. Prefer 1-3 high-leverage moves instead of filler.'
  ),
  voiceBPlan: voiceBPlanSchema,
  anchor: anchorSchema,
  editPlan: editPlanSchema,
});

const studioChangeSchema = z.object({
  text: z.string().describe(
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

const criterionEvidenceSchema = z.object({
  criterion: criterionEnum,
  visibleEvidence: z.array(
    z.string().describe(
      'One specific visual observation for this criterion. Must name two identifiable things and their relationship — e.g. "the white newspaper page meets the dark coat behind it at left-center with almost no value break" or "the warm yellow window glow against the cool blue-gray clapboard creates the strongest temperature contrast on the facade." NEVER write "the background could be improved" or "some edges are soft" without naming which objects/areas and what is happening between them.'
    )
  ).min(2).max(5),
  strengthRead: z.string().describe(
    'What already works for this criterion in this painting. Name the specific passage and relationship that succeeds — not "good composition" but "the diagonal of figures from lower-left to upper-right creates a clear reading path through the office."'
  ),
  tensionRead: z.string().describe(
    'What is unresolved for this criterion, if anything. Name the specific passage and what competes, merges, or misaligns there. If nothing is genuinely unresolved, say so plainly. NEVER manufacture a tension just to fill this field.'
  ),
  preserve: z.string().describe(
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

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type VoiceAStageResult = z.infer<typeof voiceAStageResultSchema>;
export type VoiceBStageResult = z.infer<typeof voiceBStageResultSchema>;
export type EvidenceStageResult = z.infer<typeof evidenceStageResultSchema>;

export type VoiceBPlanZ = z.infer<typeof voiceBPlanSchema>;
export type VoiceBStepZ = z.infer<typeof voiceBStepSchema>;
export type CriterionAnchorZ = z.infer<typeof anchorSchema>;
export type CriterionEditPlanZ = z.infer<typeof editPlanSchema>;
export type NormalizedRegionZ = z.infer<typeof normalizedRegionSchema>;
