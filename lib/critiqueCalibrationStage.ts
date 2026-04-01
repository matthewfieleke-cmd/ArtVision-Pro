import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import { CRITERIA_ORDER, RATING_LEVELS, type RatingLevelLabel } from '../shared/criteria.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';

const CALIBRATION_SCHEMA = {
  name: 'painting_critique_calibration',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['overallClass', 'overallRead', 'calibrationFlags', 'criterionCaps'],
    properties: {
      overallClass: {
        type: 'string',
        enum: ['novice_like', 'developing', 'competent_or_better'],
      },
      overallRead: { type: 'string' },
      calibrationFlags: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string' },
      },
      criterionCaps: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterion', 'maxLevel', 'reason'],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            maxLevel: { type: 'string', enum: [...RATING_LEVELS] },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export type CritiqueCalibrationDTO = {
  overallClass: 'novice_like' | 'developing' | 'competent_or_better';
  overallRead: string;
  calibrationFlags: string[];
  criterionCaps: Array<{
    criterion: (typeof CRITERIA_ORDER)[number];
    maxLevel: RatingLevelLabel;
    reason: string;
  }>;
};

type CalibrationUserContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } }
>;

function buildCalibrationPrompt(style: string, medium: string, evidence: CritiqueEvidenceDTO): string {
  const rubricBlock = formatRubricForPrompt(style);
  return `You are a calibration gate for a painting-critique system.

Your job is NOT to write the critique. Your job is to decide whether the visible image itself suggests that the work should be capped at lower rating bands before the critic writes.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

Calibration rules:
- Be conservative about giving high caps to work that looks childlike, naive, rudimentary, or clearly early-stage.
- Do NOT confuse crude simplification, undeveloped feature placement, symbolic facial shorthand, weak value grouping, or basic mark-making with successful Expressionism or successful Abstract Art.
- Bold outlines, strange proportions, or flat shapes are NOT sufficient evidence of advanced stylization.
- Typical novice-like warning signs include: floating or unstable feature placement, blunt symbolic eyes/teeth/noses, childlike house/tree/sun icons, scribbled or indecisive mark bundles, shapes that do not lock into believable structure, and color used without controlled relational logic.
- If the picture reads like an early learner made it, cap most criteria at Beginner; at most allow selective Intermediate caps where the evidence truly supports them.
- Decide overallClass as:
  - novice_like = clearly childlike, rudimentary, or early-stage
  - developing = still student-level but with some credible structure or control
  - competent_or_better = not obviously novice work
- Look at the IMAGE first. Use the evidence JSON only as supporting context, not as a substitute for your own raw visual judgment.
- maxLevel means the writer stage must not rate that criterion above this level.

Per-criterion band rubric for this style:
${rubricBlock || '- No style-aware rubric block supplied.'}

Evidence JSON:
${JSON.stringify(evidence)}

Return JSON only matching the schema.`;
}

export async function runCritiqueCalibrationStage(
  apiKey: string,
  model: string,
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO,
  userContent: CalibrationUserContent
): Promise<CritiqueCalibrationDTO> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: CALIBRATION_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: buildCalibrationPrompt(style, medium, evidence),
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${res.status}`);
  }

  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty calibration response');
  const parsed = JSON.parse(text) as CritiqueCalibrationDTO;
  if (
    parsed.overallClass !== 'novice_like' &&
    parsed.overallClass !== 'developing' &&
    parsed.overallClass !== 'competent_or_better'
  ) {
    throw new Error('Invalid calibration overallClass');
  }
  if (!Array.isArray(parsed.criterionCaps) || parsed.criterionCaps.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid calibration response');
  }
  return parsed;
}

const LEVEL_RANK: Record<RatingLevelLabel, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
};

function clampLevel(current: RatingLevelLabel, maxLevel: RatingLevelLabel): RatingLevelLabel {
  return LEVEL_RANK[current] > LEVEL_RANK[maxLevel] ? maxLevel : current;
}

export function applyCalibrationToCritique(
  critique: CritiqueResultDTO,
  calibration: CritiqueCalibrationDTO
): CritiqueResultDTO {
  const capMap = new Map(calibration.criterionCaps.map((cap) => [cap.criterion, cap.maxLevel] as const));
  const categories = critique.categories.map((category) => {
    const maxLevel = capMap.get(category.criterion);
    if (!maxLevel || !category.level) return category;
    return {
      ...category,
      level: clampLevel(category.level, maxLevel),
    };
  });

  const noviceLike = calibration.overallClass === 'novice_like';
  return {
    ...critique,
    categories,
    overallConfidence: noviceLike ? 'low' : critique.overallConfidence,
    overallSummary:
      noviceLike && critique.overallSummary
        ? {
            ...critique.overallSummary,
            analysis:
              'Using the chosen style and medium lens, this work still reads as early-stage rather than as mature expressive stylization. The forms are rudimentary, the spatial logic is unstable, and the mark-making does not yet show the control needed for higher ratings.',
          }
        : critique.overallSummary,
  };
}
