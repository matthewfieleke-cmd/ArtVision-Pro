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
      'studioAnalysis',
      'studioChanges',
      'categories',
      'comparisonNote',
      'overallConfidence',
      'photoQuality',
    ],
    properties: {
      summary: { type: 'string' },
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
                `Voice B for this criterion on THIS painting only. ${VOICE_B_SCHEMA_REMINDER} If level is Master: praise what is exemplary (evidence-grounded), no faux homework. Else: numbered steps to move up one band (Beginner→Intermediate at least 3 steps; Intermediate→Advanced at least 3; Advanced→Master at least 2), each naming visible passages from evidence.`,
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
- summary
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A: composite art-historical critic (see full system prompt); do not name critics. Two paragraphs; every claim anchored in THIS painting (named passages from evidence). Must align with the eight category levels.
- studioChanges: 2–5 items, each { text, previewCriterion } — Voice B: composite studio teacher (see system prompt); responds to Voice A + evidence; do not name teachers. Each text names where and how on THIS canvas; previewCriterion from CRITERIA_ORDER.
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- level: Voice A’s ranking for that criterion alone—Beginner / Intermediate / Advanced / Master—eight independent integrated judgments from the evidence; no single-feature shortcuts; not one grade repeated eight times unless truly warranted.
- feedback: Voice A for this criterion—3+ sentences; name THIS image (zones, colors, edges, motifs from evidence); consistent with level
- actionPlan: Voice B for this criterion. If Master: praise only (evidence-grounded). Else: numbered steps to move up one level—Beginner→Intermediate ≥3 steps; Intermediate→Advanced ≥3; Advanced→Master ≥2—all naming visible passages from evidence on THIS painting
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- subskills`;
}
