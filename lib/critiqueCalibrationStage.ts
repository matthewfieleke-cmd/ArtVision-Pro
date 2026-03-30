import { CRITERIA_ORDER, RATING_LEVELS, type RatingLevelLabel } from '../shared/criteria.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';

const CALIBRATION_SCHEMA = {
  name: 'painting_critique_calibration',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['overallRead', 'calibrationFlags', 'criterionCaps'],
    properties: {
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
  overallRead: string;
  calibrationFlags: string[];
  criterionCaps: Array<{
    criterion: (typeof CRITERIA_ORDER)[number];
    maxLevel: RatingLevelLabel;
    reason: string;
  }>;
};

function buildCalibrationPrompt(style: string, medium: string, evidence: CritiqueEvidenceDTO): string {
  return `You are a calibration gate for a painting-critique system.

Your job is NOT to write the critique. Your job is to decide whether the visible evidence suggests that the work should be capped at lower rating bands before the critic writes.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

Calibration rules:
- Be conservative about giving high caps to work that looks childlike, naive, rudimentary, or clearly early-stage.
- Do NOT confuse crude simplification, undeveloped feature placement, symbolic facial shorthand, weak value grouping, or basic mark-making with successful Expressionism or successful Abstract Art.
- Bold outlines, strange proportions, or flat shapes are NOT sufficient evidence of advanced stylization.
- If the picture reads like an early learner made it, cap most criteria at Beginner; at most allow selective Intermediate caps where the evidence truly supports them.
- Use only the evidence JSON below.
- maxLevel means the writer stage must not rate that criterion above this level.

Evidence JSON:
${JSON.stringify(evidence)}

Return JSON only matching the schema.`;
}

export async function runCritiqueCalibrationStage(
  apiKey: string,
  model: string,
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO
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
  if (!Array.isArray(parsed.criterionCaps) || parsed.criterionCaps.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid calibration response');
  }
  return parsed;
}
