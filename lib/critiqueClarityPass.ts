import { z } from 'zod';
import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import { critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import { toOpenAIJsonSchema } from './critiqueZodSchemas.js';
import { errorMessage } from './critiqueErrors.js';
import { withOpenAIRetries } from './openaiRetry.js';
import { CLARITY_SUBSTANCE_GUIDANCE } from './critiquePipelineGuidance.js';

const CRIT_ENUM = CRITERIA_ORDER as unknown as [CriterionLabel, ...CriterionLabel[]];

const clarityCategorySchema = z.object({
  criterion: z.enum(CRIT_ENUM),
  phase1: z.object({
    visualInventory: z.string(),
  }),
  phase2: z.object({
    criticsAnalysis: z.string(),
  }),
  phase3: z.object({
    teacherNextSteps: z.string(),
  }),
  preserve: z.string().optional(),
});

const suggestedTitleSchema = z.object({
  category: z.enum(['formalist', 'tactile', 'intent']),
  title: z.string(),
  rationale: z.string(),
});

const clarityResponseSchema = z.object({
  summary: z.string(),
  overallSummary: z.object({
    analysis: z.string(),
    topPriorities: z.array(z.string()).min(1).max(3),
  }),
  simpleFeedback: z.object({
    studioAnalysis: z.object({
      whatWorks: z.string(),
      whatCouldImprove: z.string(),
    }),
    studioChanges: z.array(
      z.object({
        text: z.string(),
        previewCriterion: z.enum(CRIT_ENUM),
      })
    ),
  }),
  categories: z.array(clarityCategorySchema).length(CRITERIA_ORDER.length),
  suggestedPaintingTitles: z.array(suggestedTitleSchema).length(3),
  comparisonNote: z.string().nullable(),
});

export type ClarityResponse = z.infer<typeof clarityResponseSchema>;

const CLARITY_OPENAI_SCHEMA = toOpenAIJsonSchema('critique_clarity_pass', clarityResponseSchema);

const CLARITY_SYSTEM_PROMPT = `You rewrite painting-critique text for a serious adult learner.

Rules (non-negotiable):
- Keep every factual claim and judgment the same: do not invent new observations, new problems, or new praise.
- Do not change ratings, criterion names, or which criterion each paragraph belongs to.
- Every rewritten paragraph must still name or clearly imply the same anchored passages as the input (same concrete nouns and relationships: "X against Y", "where A meets B", etc.).
- Use short, direct sentences. Prefer one idea per sentence.
- Sound like natural studio speech: a critic for diagnosis, a teacher for next steps—not a rubric checklist.
- Avoid insider jargon unless plain: do not use "human pressure"; say presence, focus of attention, emotional weight, or similar plain painter language.
- Do not add artist names, art history, or museum talk unless the input already had them.
- Preserve the meaning of numbered or listed steps; keep the same count of top priorities and studio changes.

${CLARITY_SUBSTANCE_GUIDANCE}

Output must match the JSON schema exactly. Only rewrite string fields; criterion labels in the JSON must match the input exactly.`;

const CLARITY_MAX_TOKENS = 8192;

export function isClarityPassEnabled(): boolean {
  const v = process.env.OPENAI_CLARITY_PASS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function clarityPassEligible(critique: CritiqueResultDTO): boolean {
  if (critique.analysisSource === 'fallback') return false;
  if (critique.categories.length !== CRITERIA_ORDER.length) return false;
  if (!critique.simpleFeedback?.studioAnalysis) return false;
  if (!critique.overallSummary) return false;
  if (!critique.suggestedPaintingTitles || critique.suggestedPaintingTitles.length !== 3) return false;
  return true;
}

export function extractClarityPayload(critique: CritiqueResultDTO): Record<string, unknown> {
  return {
    summary: critique.summary,
    overallSummary: critique.overallSummary!,
    simpleFeedback: critique.simpleFeedback!,
    categories: critique.categories.map((c) => ({
      criterion: c.criterion,
      phase1: { visualInventory: c.phase1.visualInventory },
      phase2: { criticsAnalysis: c.phase2.criticsAnalysis },
      phase3: { teacherNextSteps: c.phase3.teacherNextSteps },
      ...(typeof c.preserve === 'string' && c.preserve.trim() ? { preserve: c.preserve } : {}),
    })),
    suggestedPaintingTitles: critique.suggestedPaintingTitles ?? [],
    comparisonNote: critique.comparisonNote ?? null,
  };
}

export function mergeClarityResponse(original: CritiqueResultDTO, parsed: ClarityResponse): CritiqueResultDTO {
  const mergedTitles = original.suggestedPaintingTitles!.map((orig, i) => ({
    ...orig,
    title: parsed.suggestedPaintingTitles[i]!.title,
    rationale: parsed.suggestedPaintingTitles[i]!.rationale,
  }));

  return {
    ...original,
    summary: parsed.summary,
    overallSummary: {
      analysis: parsed.overallSummary.analysis,
      topPriorities: parsed.overallSummary.topPriorities,
    },
    simpleFeedback: {
      studioAnalysis: {
        whatWorks: parsed.simpleFeedback.studioAnalysis.whatWorks,
        whatCouldImprove: parsed.simpleFeedback.studioAnalysis.whatCouldImprove,
      },
      studioChanges: parsed.simpleFeedback.studioChanges.map((ch, i) => ({
        text: ch.text,
        previewCriterion: original.simpleFeedback!.studioChanges[i]!.previewCriterion,
      })),
    },
    categories: original.categories.map((cat, i) => {
      const row = parsed.categories[i]!;
      return {
        ...cat,
        phase1: { visualInventory: row.phase1.visualInventory },
        phase2: { criticsAnalysis: row.phase2.criticsAnalysis },
        phase3: { teacherNextSteps: row.phase3.teacherNextSteps },
        ...(typeof row.preserve === 'string' && row.preserve.trim()
          ? { preserve: row.preserve }
          : typeof cat.preserve === 'string'
            ? { preserve: cat.preserve }
            : {}),
      };
    }),
    suggestedPaintingTitles: mergedTitles,
    comparisonNote:
      parsed.comparisonNote !== undefined ? parsed.comparisonNote : original.comparisonNote ?? null,
  };
}

export function validateClarityMerge(before: CritiqueResultDTO, after: CritiqueResultDTO): boolean {
  if (after.categories.length !== before.categories.length) return false;
  for (let i = 0; i < before.categories.length; i++) {
    const a = before.categories[i]!;
    const b = after.categories[i]!;
    if (a.criterion !== b.criterion) return false;
    if (a.level !== b.level) return false;
    if (JSON.stringify(a.anchor) !== JSON.stringify(b.anchor)) return false;
    if (JSON.stringify(a.plan) !== JSON.stringify(b.plan)) return false;
    if (JSON.stringify(a.editPlan) !== JSON.stringify(b.editPlan)) return false;
    if (JSON.stringify(a.voiceBPlan) !== JSON.stringify(b.voiceBPlan)) return false;
    if (JSON.stringify(a.actionPlanSteps) !== JSON.stringify(b.actionPlanSteps)) return false;
    if (JSON.stringify(a.subskills) !== JSON.stringify(b.subskills)) return false;
  if (JSON.stringify(a.evidenceSignals) !== JSON.stringify(b.evidenceSignals)) return false;
  if (a.confidence !== b.confidence) return false;
  if (a.nextTarget !== b.nextTarget) return false;
  }

  const titlesBefore = before.suggestedPaintingTitles ?? [];
  const titlesAfter = after.suggestedPaintingTitles ?? [];
  if (titlesBefore.length !== titlesAfter.length) return false;
  for (let i = 0; i < titlesBefore.length; i++) {
    if (titlesBefore[i]!.category !== titlesAfter[i]!.category) return false;
  }

  const scBefore = before.simpleFeedback?.studioChanges ?? [];
  const scAfter = after.simpleFeedback?.studioChanges ?? [];
  if (scBefore.length !== scAfter.length) return false;
  for (let i = 0; i < scBefore.length; i++) {
    if (scBefore[i]!.previewCriterion !== scAfter[i]!.previewCriterion) return false;
  }

  const tpBefore = before.overallSummary?.topPriorities ?? [];
  const tpAfter = after.overallSummary?.topPriorities ?? [];
  if (tpBefore.length !== tpAfter.length) return false;

  if (critiqueNeedsFreshEvidenceRead(after)) return false;

  return true;
}

async function callClarityModel(apiKey: string, model: string, userPayload: string): Promise<string> {
  return withOpenAIRetries('clarity', async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: CLARITY_MAX_TOKENS,
        response_format: {
          type: 'json_schema',
          json_schema: CLARITY_OPENAI_SCHEMA,
        },
        messages: [
          { role: 'system', content: CLARITY_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Rewrite only the prose in this JSON for clarity and fluency. Keep structure and criterion labels identical.\n\n${userPayload}`,
          },
        ],
      }),
    });

    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err = json.error as { message?: string } | undefined;
      throw new Error(err?.message ?? `OpenAI clarity pass error ${response.status}`);
    }

    const choices = json.choices as Array<{
      message?: { content?: string };
      finish_reason?: string;
    }> | undefined;
    const choice = choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new Error('Clarity pass response truncated (token limit reached)');
    }
    const text = choice?.message?.content;
    if (!text || typeof text !== 'string') throw new Error('Empty clarity pass response');

    return text;
  });
}

/**
 * Optional post-pipeline prose pass. Returns `critique` unchanged on any failure or validation miss.
 */
export async function runClarityPass(
  apiKey: string,
  model: string,
  critique: CritiqueResultDTO
): Promise<CritiqueResultDTO> {
  if (!clarityPassEligible(critique)) return critique;

  let rawText: string;
  try {
    rawText = await callClarityModel(apiKey, model, JSON.stringify(extractClarityPayload(critique)));
  } catch (e) {
    console.warn('[critique clarity pass]', errorMessage(e));
    return critique;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    console.warn('[critique clarity pass]', 'Non-JSON response');
    return critique;
  }

  const parsed = clarityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[critique clarity pass]', parsed.error.message);
    return critique;
  }

  const merged = mergeClarityResponse(critique, parsed.data);
  if (!validateClarityMerge(critique, merged)) {
    console.warn('[critique clarity pass]', 'Rejected: grounding or structural drift after polish');
    return critique;
  }

  return merged;
}
