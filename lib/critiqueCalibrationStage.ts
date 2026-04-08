import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import { withOpenAIRetries } from './openaiRetry.js';
import { CRITERIA_ORDER, RATING_LEVELS, type RatingLevelLabel } from '../shared/criteria.js';
import type { CritiqueCategory, VoiceBStep } from '../shared/critiqueContract.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';
import {
  CRITIQUE_CHANGE_VERB_PATTERN,
  CRITIQUE_DONT_CHANGE_PATTERN,
  CRITIQUE_PRESERVE_VERB_PATTERN,
  normalizeWhitespace,
} from './critiqueTextRules.js';

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

function validateCriterionCaps(
  criterionCaps: CritiqueCalibrationDTO['criterionCaps']
): CritiqueCalibrationDTO['criterionCaps'] {
  if (!Array.isArray(criterionCaps) || criterionCaps.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid calibration response');
  }

  const seen = new Set<string>();
  for (const criterion of CRITERIA_ORDER) {
    const match = criterionCaps.find((cap) => cap.criterion === criterion);
    if (!match) throw new Error(`Missing calibration cap for ${criterion}`);
    if (seen.has(match.criterion)) throw new Error(`Duplicate calibration cap for ${criterion}`);
    if (!RATING_LEVELS.includes(match.maxLevel)) {
      throw new Error(`Invalid calibration maxLevel for ${criterion}`);
    }
    if (typeof match.reason !== 'string' || match.reason.trim().length < 8) {
      throw new Error(`Invalid calibration reason for ${criterion}`);
    }
    seen.add(match.criterion);
  }

  return CRITERIA_ORDER.map((criterion) => criterionCaps.find((cap) => cap.criterion === criterion)!);
}

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
- When reasoning about control, keep medium in mind (watercolor reserve vs oil rework) so you do not mistake medium-typical behavior for novice weakness.
- Do not output rubric jargon in reasons (no "band", "criterion label", "subskill"); write plain calibration notes the writer can follow.

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
  return withOpenAIRetries('calibration', async () => {
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
    const criterionCaps = validateCriterionCaps(parsed.criterionCaps);
    return {
      ...parsed,
      criterionCaps,
    };
  });
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

function nextTargetForLevel(criterion: string, level: RatingLevelLabel): string {
  if (level === 'Beginner') return `Push ${criterion.toLowerCase()} toward Intermediate.`;
  if (level === 'Intermediate') return `Push ${criterion.toLowerCase()} toward Advanced.`;
  if (level === 'Advanced') return `Push ${criterion.toLowerCase()} toward Master.`;
  return `Preserve the current ${criterion.toLowerCase()} authority.`;
}

function normalizeCalibrationText(
  text: string,
  fromLevel: RatingLevelLabel,
  toLevel: RatingLevelLabel
): string {
  let normalized = normalizeWhitespace(text);
  if (!normalized) return normalized;
  if (fromLevel === toLevel) return normalized;

  if (toLevel !== 'Master' && CRITIQUE_DONT_CHANGE_PATTERN.test(normalized)) {
    normalized = normalized.replace(CRITIQUE_DONT_CHANGE_PATTERN, '').trim();
  }

  if (toLevel === 'Master') {
    if (!CRITIQUE_DONT_CHANGE_PATTERN.test(normalized)) {
      normalized = `Don't change a thing. ${normalized}`;
    }
    return normalized;
  }

  if (CRITIQUE_PRESERVE_VERB_PATTERN.test(normalized) && !CRITIQUE_CHANGE_VERB_PATTERN.test(normalized)) {
    return normalized.replace(
      CRITIQUE_PRESERVE_VERB_PATTERN,
      fromLevel === 'Master' ? 'Refine' : 'Adjust'
    );
  }

  return normalized;
}

function calibratedOverallConfidence(
  current: CritiqueResultDTO['overallConfidence'],
  overallClass: CritiqueCalibrationDTO['overallClass']
): CritiqueResultDTO['overallConfidence'] {
  if (overallClass === 'novice_like') return 'low';
  if (overallClass === 'developing') return current === 'high' ? 'medium' : current;
  return current;
}

function calibratedCategoryConfidence(
  current: CritiqueResultDTO['categories'][number]['confidence'],
  overallClass: CritiqueCalibrationDTO['overallClass']
): CritiqueResultDTO['categories'][number]['confidence'] {
  if (overallClass === 'novice_like') return 'low';
  if (overallClass === 'developing' && current === 'high') return 'medium';
  return current;
}

function calibratedOverallAnalysis(
  critique: CritiqueResultDTO,
  calibration: CritiqueCalibrationDTO
): CritiqueResultDTO['overallSummary'] {
  if (!critique.overallSummary) return critique.overallSummary;
  if (calibration.overallClass === 'novice_like') {
    return {
      ...critique.overallSummary,
      analysis:
        'Using the chosen style and medium lens, this work still reads as early-stage rather than as mature expressive stylization. The forms are rudimentary, the spatial logic is unstable, and the mark-making does not yet show the control needed for higher ratings.',
    };
  }
  if (calibration.overallClass === 'developing') {
    return {
      ...critique.overallSummary,
      analysis:
        'Using the chosen style and medium lens, this work shows developing intent with a few credible local strengths, but the control is uneven. Several criteria still read student-level, so the painting should be judged as mixed and in-progress rather than as uniformly competent.',
    };
  }
  return critique.overallSummary;
}

export function applyCalibrationToCritique(
  critique: CritiqueResultDTO,
  calibration: CritiqueCalibrationDTO
): CritiqueResultDTO {
  const criterionCaps = validateCriterionCaps(calibration.criterionCaps);
  const capMap = new Map(criterionCaps.map((cap) => [cap.criterion, cap.maxLevel] as const));
  const categories: CritiqueCategory[] = critique.categories.map((category) => {
    const maxLevel = capMap.get(category.criterion);
    if (!maxLevel || !category.level) return category;
    const currentLevel = category.level;
    const nextLevel = clampLevel(currentLevel, maxLevel);
    if (nextLevel === category.level) return category;
    const actionPlanSteps = category.actionPlanSteps?.map((step, index): VoiceBStep =>
      index === 0
        ? {
            ...step,
            move: normalizeCalibrationText(step.move, currentLevel, nextLevel),
          }
        : step
    );
    return {
      ...category,
      level: nextLevel,
      confidence: calibratedCategoryConfidence(category.confidence, calibration.overallClass),
      nextTarget: nextTargetForLevel(category.criterion, nextLevel),
      phase3: {
        teacherNextSteps: normalizeCalibrationText(category.phase3.teacherNextSteps, currentLevel, nextLevel),
      },
      ...(actionPlanSteps ? { actionPlanSteps } : {}),
      voiceBPlan: category.voiceBPlan
        ? {
            ...category.voiceBPlan,
            bestNextMove: normalizeCalibrationText(
              category.voiceBPlan.bestNextMove,
              currentLevel,
              nextLevel
            ),
          }
        : category.voiceBPlan,
      editPlan: category.editPlan
        ? {
            ...category.editPlan,
            intendedChange: normalizeCalibrationText(
              category.editPlan.intendedChange,
              currentLevel,
              nextLevel
            ),
            editability: nextLevel === 'Master' ? 'no' : 'yes',
          }
        : category.editPlan,
    };
  });

  return {
    ...critique,
    categories,
    overallConfidence: calibratedOverallConfidence(critique.overallConfidence, calibration.overallClass),
    overallSummary: calibratedOverallAnalysis(critique, calibration),
  };
}
