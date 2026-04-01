import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import { VOICE_A_SCHEMA_REMINDER, VOICE_B_SCHEMA_REMINDER } from '../shared/critiqueVoiceA.js';

export const CRITIQUE_EVIDENCE_JSON_SCHEMA = {
  name: 'painting_critique_evidence',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'intentHypothesis',
      'strongestVisibleQualities',
      'mainTensions',
      'criterionEvidence',
      'photoQualityRead',
      'comparisonObservations',
      'completionRead',
    ],
    properties: {
      intentHypothesis: { type: 'string' },
      strongestVisibleQualities: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      mainTensions: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      photoQualityRead: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'summary', 'issues'],
        properties: {
          level: { type: 'string', enum: ['poor', 'fair', 'good'] },
          summary: { type: 'string' },
          issues: {
            type: 'array',
            minItems: 0,
            maxItems: 4,
            items: { type: 'string' },
          },
        },
      },
      comparisonObservations: {
        type: 'array',
        minItems: 0,
        maxItems: 4,
        items: { type: 'string' },
      },
      completionRead: {
        type: 'object',
        additionalProperties: false,
        required: ['state', 'confidence', 'cues', 'rationale'],
        properties: {
          state: { type: 'string', enum: ['unfinished', 'likely_finished', 'uncertain'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          cues: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          rationale: { type: 'string' },
        },
      },
      criterionEvidence: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterion', 'visibleEvidence', 'strengthRead', 'tensionRead', 'preserve', 'confidence'],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            visibleEvidence: {
              type: 'array',
              minItems: 2,
              maxItems: 5,
              items: { type: 'string' },
            },
            strengthRead: { type: 'string' },
            tensionRead: { type: 'string' },
            preserve: { type: 'string' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
    },
  },
} as const;

export const CRITIQUE_JSON_SCHEMA = {
  name: 'painting_critique',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'overallSummary',
      'studioAnalysis',
      'studioChanges',
      'categories',
      'comparisonNote',
      'overallConfidence',
      'photoQuality',
      'suggestedPaintingTitles',
    ],
    properties: {
      summary: {
        type: 'string',
        description:
          `Voice A one-sentence synopsis for THIS painting only. Name at least one recognizable passage from the painting or its evidence; do not use generic praise or abstract summary language.`,
      },
      suggestedPaintingTitles: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'title', 'rationale'],
          properties: {
            category: {
              type: 'string',
              enum: ['formalist', 'tactile', 'intent'],
              description:
                'Title category: formalist (structural/compositional), tactile (medium/surface/execution), or intent (mood/psychology/narrative).',
            },
            title: {
              type: 'string',
              description:
                'Title Case, no quotes. Must avoid cliché, overly poetic, or generic names. Ground in specific analysis data from THIS painting.',
            },
            rationale: {
              type: 'string',
              description:
                '1–2 sentences explaining exactly how the specific scores and feedback for this painting generated this title.',
            },
          },
        },
      },
      overallSummary: {
        type: 'object',
        additionalProperties: false,
        required: ['analysis', 'topPriorities'],
        properties: {
          analysis: {
            type: 'string',
            description:
              `Voice A overall summary for THIS painting only. Mention style and medium lens explicitly. Ground it in visible passages from the painting, not generic praise.`,
          },
          topPriorities: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: {
              type: 'string',
              description:
                `Voice B top priority only for THIS painting. Start with one primary action and keep it tied to the same anchored visible passage used in the detailed categories.`,
            },
          },
        },
      },
      studioAnalysis: {
        type: 'object',
        additionalProperties: false,
        required: ['whatWorks', 'whatCouldImprove'],
        properties: {
          whatWorks: {
            type: 'string',
            description:
              `Voice A paragraph: specific strengths in THIS painting. ${VOICE_A_SCHEMA_REMINDER} Must align with the eight per-criterion levels.`,
          },
          whatCouldImprove: {
            type: 'string',
            description:
              `Voice A paragraph: tensions or gaps in THIS painting; calibrate for unfinished vs finished. ${VOICE_A_SCHEMA_REMINDER} Must align with the eight per-criterion levels.`,
          },
        },
      },
      studioChanges: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'previewCriterion'],
          properties: {
            text: {
              type: 'string',
              description:
                `Voice B: one concrete change—where, what, how—for THIS painting only. ${VOICE_B_SCHEMA_REMINDER}`,
            },
            previewCriterion: { type: 'string', enum: [...CRITERIA_ORDER] },
          },
        },
      },
      comparisonNote: { type: ['string', 'null'] },
      overallConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      photoQuality: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'summary', 'issues', 'tips'],
        properties: {
          level: { type: 'string', enum: ['poor', 'fair', 'good'] },
          summary: { type: 'string' },
          issues: { type: 'array', items: { type: 'string' } },
          tips: { type: 'array', items: { type: 'string' } },
        },
      },
      categories: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'criterion',
            'level',
            'feedback',
            'actionPlan',
            'actionPlanSteps',
            'voiceBPlan',
            'confidence',
            'evidenceSignals',
            'preserve',
            'practiceExercise',
            'nextTarget',
            'anchor',
            'editPlan',
            'subskills',
          ],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            level: {
              type: 'string',
              enum: [...RATING_LEVELS],
              description:
                `Voice A’s quality ranking for THIS criterion only (one of eight independent axes). ${VOICE_A_SCHEMA_REMINDER} Beginner = weak on this axis per evidence. Intermediate/Advanced/Master = only when integrated evidence for that axis supports it. Do not copy one overall grade into all eight.`,
            },
            feedback: {
              type: 'string',
              description:
                `Voice A: 3+ sentences—this criterion’s critical assessment for THIS painting only; name visible zones, colors, edges, or motifs from evidence in at least two sentences. Same stance as level. ${VOICE_A_SCHEMA_REMINDER}`,
            },
            actionPlan: {
              type: 'string',
              description:
                `Voice B for this criterion on THIS painting only. ${VOICE_B_SCHEMA_REMINDER} Use the exact opener "Don't change a thing." ONLY if level is Master; for Beginner/Intermediate/Advanced you MUST give numbered improvement steps (never that opener). Master: brief praise only. Else: 1–3 steps (prefer fewer high-leverage steps over padding; Beginner usually 1–3, Intermediate 1–3, Advanced 1–2). Every step must state (1) where in the painting, (2) what exact relationship/problem/strength is there now, and (3) what exact directional move to make or preserve there.`,
            },
            actionPlanSteps: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              description:
                `Voice B structured teaching steps for THIS criterion only. Prefer 1-3 high-leverage moves instead of filler. Each step must stay on the same anchored passage and say where, what is happening there now, what to do, and what should read differently after the move.`,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['area', 'currentRead', 'move', 'expectedRead', 'preserve', 'priority'],
                properties: {
                  area: {
                    type: 'string',
                    description: 'A visible, locatable passage a user could point to in THIS painting (e.g. "the terracotta pot against the red path"). NEVER use "arrangement of elements", "spatial relationships", "areas where energy is evident", or other abstract placeholders.',
                  },
                  currentRead: {
                    type: 'string',
                    description: 'What is visibly happening in that passage right now — name colors, shapes, edges, or spatial events you can see. NEVER write judgment-only language without naming what you see.',
                  },
                  move: {
                    type: 'string',
                    description: 'One concrete verb + target: what to physically change in that passage (soften, darken, cool, group, separate, etc.). NEVER write "adjust elements", "enhance presence", "ensure consistency" without naming what exactly to do to what.',
                  },
                  expectedRead: {
                    type: 'string',
                    description: 'What that same passage should read like after the move.',
                  },
                  preserve: {
                    type: 'string',
                    description: 'Optional nearby success to protect while making the change.',
                  },
                  priority: { type: 'string', enum: ['primary', 'secondary'] },
                },
              },
            },
            voiceBPlan: {
              type: 'object',
              additionalProperties: false,
              required: [
                'currentRead',
                'mainProblem',
                'mainStrength',
                'bestNextMove',
                'optionalSecondMove',
                'avoidDoing',
                'expectedRead',
                'storyIfRelevant',
              ],
              properties: {
                currentRead: {
                  type: 'string',
                  description: 'Voice B diagnosis of what this anchored passage is doing now.',
                },
                mainProblem: {
                  type: 'string',
                  description: 'Optional main local problem in that anchored passage.',
                },
                mainStrength: {
                  type: 'string',
                  description: 'Optional main local strength to preserve in that anchored passage.',
                },
                bestNextMove: {
                  type: 'string',
                  description: 'Best next teaching move in that passage only.',
                },
                optionalSecondMove: {
                  type: 'string',
                  description: 'Optional secondary move if one more local change would help.',
                },
                avoidDoing: {
                  type: 'string',
                  description: 'Optional note on what not to break or overdo.',
                },
                expectedRead: {
                  type: 'string',
                  description: 'What the passage should read like after the best next move.',
                },
                storyIfRelevant: {
                  type: 'string',
                  description: 'Optional story or dramatic situation only when that is genuinely relevant and concrete in this painting.',
                },
              },
            },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            evidenceSignals: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
            },
            preserve: { type: 'string' },
            practiceExercise: { type: 'string' },
            nextTarget: { type: 'string' },
            anchor: {
              type: 'object',
              additionalProperties: false,
              required: ['areaSummary', 'evidencePointer', 'region'],
              properties: {
                areaSummary: {
                  type: 'string',
                  description:
                    'Short phrase naming one exact, recognizable visible passage in THIS painting that Voice A and Voice B are both discussing. It must point to content a user could locate (e.g. "the leftmost seated figure\'s face", "the orange sleeve against the blue wall", "the foreground chair back"), not a conceptual label like "the story", "color transitions", or "left side of the painting". Reuse this same passage in feedback and actionPlan.',
                },
                evidencePointer: {
                  type: 'string',
                  description:
                    'What visible relationship in that exact passage drives this criterion read in THIS painting. Name the concrete visual fact there now (e.g. one edge competing with the face, one warm/cool junction breaking, one overlap flattening). Must align with feedback, actionPlan, overlay, and edit plan.',
                },
                region: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['x', 'y', 'width', 'height'],
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
              },
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
                  description: 'Same passage as anchor.areaSummary.',
                },
                preserveArea: {
                  type: 'string',
                  description: 'What nearby success must remain untouched while editing.',
                },
                issue: {
                  type: 'string',
                  description:
                    'The specific visual problem or strength in that anchored passage right now. Must name what is visibly happening there, not a generic goal like "more realism" or "more depth".',
                },
                intendedChange: {
                  type: 'string',
                  description:
                    'Exact directional change for the AI preview to make in that passage only. Must say what should be altered or preserved there (edge, spacing, temperature, overlap, mark family, etc.), not a vague fix like "refine" or "enhance". If level is Master, describe preservation rather than revision.',
                },
                expectedOutcome: {
                  type: 'string',
                  description:
                    'What the painting should read like after that change in that same passage. Must describe the resulting visual read (e.g. face regains first attention, overlap reads as depth, head turns in space), not a generic improvement slogan.',
                },
                editability: {
                  type: 'string',
                  enum: ['yes', 'no'],
                  description:
                    'Whether the edit model should attempt this criterion change. Master rows may still be no when there is nothing to change.',
                },
              },
            },
            subskills: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'score', 'level'],
                properties: {
                  label: { type: 'string' },
                  score: { type: 'number' },
                  level: { type: 'string', enum: [...RATING_LEVELS] },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const VOICE_A_CRITIQUE_JSON_SCHEMA = {
  name: 'painting_critique_voice_a',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'suggestedPaintingTitles',
      'overallSummary',
      'studioAnalysis',
      'comparisonNote',
      'overallConfidence',
      'photoQuality',
      'categories',
    ],
    properties: {
      summary: CRITIQUE_JSON_SCHEMA.schema.properties.summary,
      suggestedPaintingTitles: CRITIQUE_JSON_SCHEMA.schema.properties.suggestedPaintingTitles,
      overallSummary: {
        type: 'object',
        additionalProperties: false,
        required: ['analysis'],
        properties: {
          analysis: CRITIQUE_JSON_SCHEMA.schema.properties.overallSummary.properties.analysis,
        },
      },
      studioAnalysis: CRITIQUE_JSON_SCHEMA.schema.properties.studioAnalysis,
      comparisonNote: CRITIQUE_JSON_SCHEMA.schema.properties.comparisonNote,
      overallConfidence: CRITIQUE_JSON_SCHEMA.schema.properties.overallConfidence,
      photoQuality: CRITIQUE_JSON_SCHEMA.schema.properties.photoQuality,
      categories: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'criterion',
            'level',
            'feedback',
            'confidence',
            'evidenceSignals',
            'preserve',
            'practiceExercise',
            'nextTarget',
            'subskills',
          ],
          properties: {
            criterion: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.criterion,
            level: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.level,
            feedback: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.feedback,
            confidence: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.confidence,
            evidenceSignals:
              CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.evidenceSignals,
            preserve: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.preserve,
            practiceExercise:
              CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.practiceExercise,
            nextTarget: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.nextTarget,
            subskills: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.subskills,
          },
        },
      },
    },
  },
} as const;

export const VOICE_B_CRITIQUE_JSON_SCHEMA = {
  name: 'painting_critique_voice_b',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['overallSummary', 'studioChanges', 'categories'],
    properties: {
      overallSummary: {
        type: 'object',
        additionalProperties: false,
        required: ['topPriorities'],
        properties: {
          topPriorities: CRITIQUE_JSON_SCHEMA.schema.properties.overallSummary.properties.topPriorities,
        },
      },
      studioChanges: CRITIQUE_JSON_SCHEMA.schema.properties.studioChanges,
      categories: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'criterion',
            'actionPlan',
            'actionPlanSteps',
            'voiceBPlan',
            'anchor',
            'editPlan',
          ],
          properties: {
            criterion: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.criterion,
            actionPlan: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.actionPlan,
            actionPlanSteps:
              CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.actionPlanSteps,
            voiceBPlan: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.voiceBPlan,
            anchor: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.anchor,
            editPlan: CRITIQUE_JSON_SCHEMA.schema.properties.categories.items.properties.editPlan,
          },
        },
      },
    },
  },
} as const;

export function buildCritiqueSchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 objects, each { category, title, rationale }. One "formalist" (from Composition, Value, Color, Drawing criteria — name the dominant structural element), one "tactile" (from Style, Medium, Surface, Edge criteria — name the physical execution), one "intent" (from Intent and Presence criteria — name the mood/psychology). Title Case, no quotes, no cliché or generic names. Each rationale: 1–2 sentences explaining how the specific criterion scores/feedback generated this title.
- overallSummary: { analysis, topPriorities } — analysis is Voice A only; topPriorities = 1–2 Voice B priorities
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A: composite art-historical critic (see full system prompt); do not name critics. Two paragraphs; every claim anchored in THIS painting (named passages from evidence). Must align with the eight category levels.
- studioChanges: 2–5 items, each { text, previewCriterion } — Voice B: composite studio teacher (see system prompt); responds to Voice A + evidence; do not name teachers. Each text names where and how on THIS canvas; previewCriterion from CRITERIA_ORDER.
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- level: Voice A’s ranking for that criterion alone—Beginner / Intermediate / Advanced / Master—eight independent integrated judgments from the evidence; no single-feature shortcuts; not one grade repeated eight times unless truly warranted.
- feedback: Voice A for this criterion—3+ sentences; name THIS image (zones, colors, edges, motifs from evidence); consistent with level
- voiceBPlan: structured teacher notes for this criterion — currentRead, bestNextMove, expectedRead, plus optional mainProblem/mainStrength/avoidDoing/storyIfRelevant
- actionPlanSteps: 1–3 structured Voice B steps, each with { area, currentRead, move, expectedRead, preserve?, priority }; prefer high-leverage steps over filler
- actionPlan: Voice B rendered user-facing text for this criterion, derived from the same structured Voice B plan/steps. Master only: may start with "Don't change a thing." then brief praise. Any other level: numbered steps grounded in evidence. Do not park Edge and Surface one band below everything else by default.
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- anchor: { areaSummary, evidencePointer, region } — same exact passage used by feedback, actionPlan, overlay, and edit plan
- editPlan: { targetArea, preserveArea, issue, intendedChange, expectedOutcome, editability } — machine-readable and aligned to anchor
- subskills`;
}

export function buildVoiceASchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 objects { category, title, rationale }. One "formalist", one "tactile", one "intent". Title Case, no quotes, no cliché. Rationale explains how the specific criterion data generated the title.
- overallSummary: { analysis } — Voice A only
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A only
- comparisonNote
- overallConfidence
- photoQuality
- categories

For each criterion:
- level: Voice A’s ranking for that criterion alone
- feedback: Voice A for this criterion
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- subskills`;
}

export function buildVoiceBSchemaInstruction(): string {
  return `Return JSON with:
- overallSummary: { topPriorities } — Voice B only
- studioChanges: 2–5 items, each { text, previewCriterion }
- categories

For each criterion:
- actionPlanSteps: 1–3 structured Voice B steps, each with { area, currentRead, move, expectedRead, preserve, priority }
- voiceBPlan: structured teacher notes for this criterion — { currentRead, mainProblem, mainStrength, bestNextMove, optionalSecondMove, avoidDoing, expectedRead, storyIfRelevant }
- actionPlan: readable numbered rendering of the same steps
- anchor: { areaSummary, evidencePointer, region }
- editPlan: { targetArea, preserveArea, issue, intendedChange, expectedOutcome, editability }`;
}
