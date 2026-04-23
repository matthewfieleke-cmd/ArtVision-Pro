import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';
import { buildOpenAIMaxTokensParam, buildOpenAISamplingParam } from './openaiModels.js';
import { errorMessage } from './critiqueErrors.js';
import {
  CRITIQUE_AUDIENCE_FRAMING,
  VOICE_A_COMPOSITE_EXPERTS,
  VOICE_A_PARAGRAPH_SHAPE,
  VOICE_B_COMPOSITE_TEACHERS,
  VOICE_B_PARAGRAPH_SHAPE,
} from '../shared/critiqueVoiceA.js';

/**
 * Result for a single criterion's dual-voice pass, emitted by the parallel
 * criterion stage. Shape is intentionally minimal: the UI now reads only the
 * critic prose, the instructor prose, a preserve hint, and a confidence tag.
 * The critique synthesis stage re-aggregates these into overall summary /
 * studio changes downstream.
 */
export type CriterionWritingResult = {
  criterion: CriterionLabel;
  voiceACritique: string;
  voiceBSuggestions: string;
  preserve: string;
  confidence: 'low' | 'medium' | 'high';
};

/**
 * Strict JSON schema for a single criterion's output. We rely entirely on
 * OpenAI Structured Outputs (strict: true, additionalProperties: false) to
 * guarantee shape, so there is no custom Zod validator and no retry path in
 * the new pipeline. If the model returns something off-schema the upstream
 * fetch throws and the fallback composer handles the degraded path.
 */
const CRITERION_JSON_SCHEMA = {
  name: 'painting_criterion_critique',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['voiceACritique', 'voiceBSuggestions', 'preserve', 'confidence'],
    properties: {
      voiceACritique: {
        type: 'string',
        description:
          'Objective, structural art-historian critique grounded in visible evidence. 2-4 sentences. No introductory filler.',
      },
      voiceBSuggestions: {
        type: 'string',
        description:
          'Master instructor actionable technical improvements tied to Voice A findings. 2-4 sentences. No filler.',
      },
      preserve: {
        type: 'string',
        description: 'One short sentence naming what to protect.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
    },
  },
} as const;

/**
 * One system message for every parallel criterion call. The job of this
 * message is to lock in a SINGLE house voice across the eight concurrent
 * calls — otherwise the critic / teacher outputs drift stylistically and
 * the synthesis stage has to smooth them over.
 *
 * It sets, in order:
 *   1. The reader we are writing for (serious hobbyist / art student).
 *   2. The composite-critic panel that Voice A synthesizes.
 *   3. The composite-teacher panel that Voice B synthesizes.
 *   4. The four-beat paragraph shape for each voice.
 *   5. Hard rules shared by both voices (no name-dropping, stay on this
 *      painting, etc.).
 */
export const PARALLEL_CRITERIA_SYSTEM_MESSAGE = [
  'You write BOTH a critic paragraph (Voice A) and a teacher paragraph (Voice B) for one criterion of one painting. You produce one unified product voice across both.',
  '',
  CRITIQUE_AUDIENCE_FRAMING,
  '',
  VOICE_A_COMPOSITE_EXPERTS,
  '',
  VOICE_A_PARAGRAPH_SHAPE,
  '',
  VOICE_B_COMPOSITE_TEACHERS,
  '',
  VOICE_B_PARAGRAPH_SHAPE,
  '',
  'Hard rules for both voices:',
  '- Ground every claim in the anchored passage and the visibleEvidence the user message gives you. Do not invent passages that are not in the evidence.',
  '- Never name any critic, teacher, artist, famous artwork, or art-historical movement. The expert panels are for your reasoning only; the reader never sees them.',
  '- Never use filler openings ("This painting…", "In this work…", "Overall, the composition…"). Start inside the anchored passage.',
  '- Do not re-teach basic studio vocabulary; the reader already has it.',
  '- If you use a less common term, the sentence around it must make the meaning self-evident from what is visible.',
  '- Confidence goes in the confidence field only, not in hedging words in the prose.',
].join('\n');

export function buildCriterionPrompt(args: {
  criterion: CriterionLabel;
  style: string;
  medium: string;
  userTitle?: string;
  evidence: CritiqueEvidenceDTO;
}): string {
  const { criterion, style, medium, userTitle, evidence } = args;
  const entry = evidence.criterionEvidence.find((e) => e.criterion === criterion);

  const titleLine = userTitle ? ` The artist titled this work: "${userTitle}".` : '';

  const evidenceBlock = entry
    ? [
        `Evidence already gathered for ${criterion}:`,
        `- Anchor (the specific visible passage to reference): ${entry.anchor}`,
        `- Strength read: ${entry.strengthRead}`,
        `- Tension read: ${entry.tensionRead}`,
        `- Visible evidence lines:`,
        ...entry.visibleEvidence.map((line) => `    • ${line}`),
        `- Preserve hint (seed for your preserve field): ${entry.preserve}`,
        `- Visible-evidence confidence seed: ${entry.confidence}`,
      ].join('\n')
    : `Evidence for ${criterion}: (no dedicated evidence block was gathered; work from the overall context below).`;

  return [
    `Write Voice A (critic) and Voice B (teacher) for ONE criterion of ONE painting: ${criterion}.`,
    `Style: ${style}. Medium: ${medium}.${titleLine}`,
    '',
    evidenceBlock,
    '',
    `Painting-wide context from the vision pass:`,
    `- Intent hypothesis: ${evidence.intentHypothesis}`,
    `- Strongest visible qualities: ${evidence.strongestVisibleQualities.join('; ') || '(none recorded)'}`,
    `- Main tensions: ${evidence.mainTensions.join('; ') || '(none recorded)'}`,
    '',
    'Output a JSON object with exactly these fields: voiceACritique, voiceBSuggestions, preserve, confidence.',
    '',
    `**voiceACritique** — follow the Voice A paragraph shape described in the system message. 2–4 sentences. Open inside the anchored passage. Make ONE structural claim a critic would sign their name to, supported by the visibleEvidence above. Do not paraphrase the evidence neutrally.`,
    '',
    `**voiceBSuggestions** — follow the Voice B paragraph shape described in the system message (where → what now → what to try → what you should see afterward). 2–4 sentences. ONE primary move, imperative voice, starting with a concrete studio verb tied to a named form / edge / value / color in the anchored passage. If Voice A says this criterion is already working at the highest level, replace the move with "Leave this alone — …" and say WHY it is working. Respect the declared medium (${medium}); do not recommend moves the medium would fight.`,
    '',
    '**preserve** — one short sentence naming a specific visible strength in or near the anchored passage that the artist should protect while they make the move.',
    '',
    '**confidence** — how well the visible evidence supports your critique: "low", "medium", or "high". Do not put hedging language in the prose; put it here.',
    '',
    'Reminders:',
    '- Stay on THIS painting. No studio-generic advice, no textbook definitions, no "paintings in general".',
    '- Never name critics, teachers, artists, famous artworks, or art-historical movements in the text you emit.',
    '- If the vision evidence genuinely shows nothing unresolved on this axis, say so plainly in Voice A and have Voice B preserve rather than invent a problem.',
  ].join('\n');
}

type OpenAIChatCompletion = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string };
};

async function callCriterionStage(args: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<CriterionWritingResult['voiceACritique'] extends string ? unknown : never> {
  const body = {
    model: args.model,
    messages: [
      { role: 'system', content: PARALLEL_CRITERIA_SYSTEM_MESSAGE },
      { role: 'user', content: args.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: CRITERION_JSON_SCHEMA,
    },
    // Per-criterion calls don't have the image and only need to turn the
    // vision-stage evidence into 2-4 sentences of prose per voice. `medium`
    // reasoning is plenty and keeps fan-out cost/latency in check.
    ...buildOpenAISamplingParam(args.model, { temperature: 0.2, reasoningEffort: 'medium' }),
    ...buildOpenAIMaxTokensParam(args.model, 1200),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI criterion stage error ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAIChatCompletion;
  if (json.error?.message) {
    throw new Error(`OpenAI criterion stage error: ${json.error.message}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenAI criterion stage returned empty content.');
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(
      `OpenAI criterion stage returned non-JSON content: ${errorMessage(parseError)}; preview=${content.slice(0, 200)}`
    );
  }
}

function normaliseConfidence(value: unknown): 'low' | 'medium' | 'high' {
  return value === 'high' || value === 'medium' ? value : 'low';
}

/**
 * Run all eight criterion critiques concurrently. Every call is independent;
 * failures in a single criterion do not cancel the others, but a failed call
 * produces a low-confidence placeholder derived from the vision evidence so
 * the downstream assembler always has a complete criterion set. This keeps
 * the pipeline "no retries" while still being resilient to a single-call
 * timeout or structural-output glitch.
 */
export async function runParallelCriteriaStage(args: {
  apiKey: string;
  model: string;
  style: string;
  medium: string;
  userTitle?: string;
  evidence: CritiqueEvidenceDTO;
}): Promise<{
  results: CriterionWritingResult[];
  failedCriteria: Array<{ criterion: CriterionLabel; reason: string }>;
}> {
  const start = Date.now();
  console.log(
    `[critique parallel criteria] launching ${CRITERIA_ORDER.length} concurrent calls (model=${args.model})`
  );

  const settled = await Promise.allSettled(
    CRITERIA_ORDER.map(async (criterion) => {
      const prompt = buildCriterionPrompt({
        criterion,
        style: args.style,
        medium: args.medium,
        userTitle: args.userTitle,
        evidence: args.evidence,
      });
      const raw = await callCriterionStage({
        apiKey: args.apiKey,
        model: args.model,
        prompt,
      });
      const r = raw as Record<string, unknown>;
      return {
        criterion,
        voiceACritique: typeof r.voiceACritique === 'string' ? r.voiceACritique.trim() : '',
        voiceBSuggestions:
          typeof r.voiceBSuggestions === 'string' ? r.voiceBSuggestions.trim() : '',
        preserve: typeof r.preserve === 'string' ? r.preserve.trim() : '',
        confidence: normaliseConfidence(r.confidence),
      } satisfies CriterionWritingResult;
    })
  );

  const results: CriterionWritingResult[] = [];
  const failedCriteria: Array<{ criterion: CriterionLabel; reason: string }> = [];
  settled.forEach((outcome, index) => {
    const criterion = CRITERIA_ORDER[index]!;
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
      return;
    }
    const reason = errorMessage(outcome.reason);
    console.warn(`[critique parallel criteria] ${criterion} failed: ${reason}`);
    failedCriteria.push({ criterion, reason });
    const entry = args.evidence.criterionEvidence.find((e) => e.criterion === criterion);
    results.push({
      criterion,
      voiceACritique: entry
        ? `${entry.strengthRead} ${entry.tensionRead}`.replace(/\s+/g, ' ').trim()
        : `Based on visible evidence, ${criterion.toLowerCase()} reads as present but partially resolved.`,
      voiceBSuggestions: entry
        ? `Focus on ${entry.anchor}: revisit the relationship described in "${entry.tensionRead}" and restate it so the passage carries its weight without flattening the surrounding read.`
        : `Identify the weakest visible passage tied to ${criterion.toLowerCase()} and restate it with one clear value or edge adjustment.`,
      preserve: entry?.preserve ?? 'Keep the current broad arrangement while refining execution in the targeted passage.',
      confidence: 'low',
    });
  });

  const elapsed = Date.now() - start;
  console.log(
    `[critique parallel criteria] ${CRITERIA_ORDER.length} calls complete in ${(elapsed / 1000).toFixed(1)}s (longest-call bound; ${failedCriteria.length} fell back to evidence-derived prose)`
  );

  return { results, failedCriteria };
}
