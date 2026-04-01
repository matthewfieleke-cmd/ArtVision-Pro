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
          type: 'string',
          description:
            'Exhibition-style painting title: Title Case, no quotes. Ground in visible motifs, light, space, or handling from THIS image. Avoid generic praise. Vary structure across the three (e.g. descriptive, study-style, subtitle with medium).',
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
                `Voice B for this criterion on THIS painting only. ${VOICE_B_SCHEMA_REMINDER} Use the exact opener "Don't change a thing." ONLY if level is Master; for Beginner/Intermediate/Advanced you MUST give numbered improvement steps (never that opener). Master: brief praise only. Else: Beginner→Intermediate ≥3 steps; Intermediate→Advanced ≥3; Advanced→Master ≥2. Every step must state (1) where in the painting, (2) what exact relationship/problem/strength is there now, and (3) what exact directional move to make or preserve there.`,
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

export function buildCritiqueSchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 strings — scholarly, catalogue-ready titles for THIS painting only, grounded in visible passages from the evidence (motifs, light, space, color behavior, mark-making). Standard conventions: Title Case; no quotation marks; no artist self-reference; not generic ("Beautiful Landscape"). Each title should feel like a plausible museum label variant and should differ in phrasing from the other two.
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
- actionPlan: Voice B for this criterion. Master only: may start with "Don't change a thing." then brief praise. Any other level: numbered steps only (no that phrase)—Beginner→Intermediate ≥3; Intermediate→Advanced ≥3; Advanced→Master ≥2; all grounded in evidence. Do not park Edge and Surface one band below everything else by default.
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- anchor: { areaSummary, evidencePointer, region } — same exact passage used by feedback, actionPlan, overlay, and edit plan
- editPlan: { targetArea, preserveArea, issue, intendedChange, expectedOutcome, editability } — machine-readable and aligned to anchor
- subskills`;
}
