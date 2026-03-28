import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';

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
              'Voice A paragraph: specific strengths visible in THIS painting; informed by style, medium, completion read.',
          },
          whatCouldImprove: {
            type: 'string',
            description:
              'Voice A paragraph: specific tensions or gaps visible in THIS painting; calibrate tone for unfinished vs finished.',
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
                'Voice B: one concrete change—where, what, how—for THIS painting only; no vague advice.',
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
                'Beginner = weak in this criterion. Intermediate = strong but still developing. Advanced = strong with only minor refinement left. Master = very rare, exceptional sustained control in this criterion.',
            },
            feedback: { type: 'string' },
            actionPlan: {
              type: 'string',
              description:
                'Concrete how-to-improve guidance for THIS criterion in THIS painting only: 2–5 short numbered steps (1. … 2. …) or 2–4 tight paragraphs. Every step names visible passages from the evidence—no generic studio homework.',
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
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A: two labeled paragraphs, specific to THIS painting; use declared style, medium, and completion read (unfinished → structure/pacing; likely_finished → selective refinement). Name visible passages, colors, edges, motifs.
- studioChanges: 2–5 items, each { text, previewCriterion } — Voice B: concrete studio instructions only; each text names where and how; previewCriterion is the single best-matching criterion from CRITERIA_ORDER for that change (used for preview image routing).
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- level: Beginner (weak), Intermediate (strong but still developing), Advanced (strong, little development needed), Master (very rare, exceptional)
- feedback: 3+ sentences grounded in visible evidence
- actionPlan: 2–5 numbered steps OR 2–4 short paragraphs—all specific to THIS painting (name areas, edges, colors, shapes from evidence). No generic advice; enough detail that the artist knows what to do where
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- subskills`;
}
