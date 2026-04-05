import { buildHighDetailImageMessage } from './openaiVisionContent.js';
import { resolveOpenAIModel } from './openaiModels.js';

const MEDIUM_ENUM = [
  'Oil on Canvas',
  'Acrylic',
  'Pastel',
  'Drawing',
  'Watercolor',
] as const;

export type ClassifyMediumResult = {
  medium: (typeof MEDIUM_ENUM)[number];
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
};

const SCHEMA = {
  name: 'medium_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['medium', 'confidence', 'rationale'],
    properties: {
      medium: { type: 'string', enum: [...MEDIUM_ENUM] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      rationale: { type: 'string' },
    },
  },
} as const;

const MEDIUM_GUIDE = `Classify this artwork into exactly ONE of:

Oil on Canvas — visible oil handling, scumble/glaze/opaque contrast, slower blended transitions, loaded or dragged paint, canvas-based paint film.

Acrylic — flatter opaque passages, sharper quick-drying edge decisions, layered corrections, crisp graphic passes, less oily blending behavior.

Pastel — powdery tooth, layered dry color, velvety transitions, visible pastel drag, breathable dusty surface.

Drawing — graphite/charcoal/ink/crayon/dry drawing marks dominate; value and line do most of the work rather than wet paint behavior.

Watercolor — transparent washes, paper reserve, blooms/backruns, wet-into-wet diffusion, luminous paper whites.

Pick the single best fit. If uncertain, choose the best-supported answer and lower confidence.`;

export async function runOpenAIClassifyMedium(
  apiKey: string,
  imageDataUrl: string,
  options?: { model?: string }
): Promise<ClassifyMediumResult> {
  const model = resolveOpenAIModel('classification', options?.model);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [
        {
          role: 'system',
          content: `You are an expert studio observer. ${MEDIUM_GUIDE}

Respond with JSON only matching the schema. rationale: 2–4 sentences. Name visible handling evidence on the artwork surface, not generic guesses.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Which medium category best fits this artwork?' },
            buildHighDetailImageMessage(imageDataUrl),
          ],
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
  if (!text || typeof text !== 'string') throw new Error('Empty model response');
  const parsed = JSON.parse(text) as ClassifyMediumResult;
  if (!MEDIUM_ENUM.includes(parsed.medium)) throw new Error('Invalid medium in response');
  if (!(['low', 'medium', 'high'] as const).includes(parsed.confidence)) {
    throw new Error('Invalid medium confidence');
  }
  if (typeof parsed.rationale !== 'string') throw new Error('Invalid rationale');
  return parsed;
}
