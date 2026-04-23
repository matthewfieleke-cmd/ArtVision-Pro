import { buildHighDetailImageMessage } from './openaiVisionContent.js';
import { buildOpenAISamplingParam, resolveOpenAIModel } from './openaiModels.js';

const STYLE_ENUM = [
  'Realism',
  'Impressionism',
  'Expressionism',
  'Abstract Art',
] as const;

export type ClassifyStyleResult = {
  style: (typeof STYLE_ENUM)[number];
  rationale: string;
};

const SCHEMA = {
  name: 'style_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['style', 'rationale'],
    properties: {
      style: { type: 'string', enum: [...STYLE_ENUM] },
      rationale: { type: 'string' },
    },
  },
} as const;

const STYLE_GUIDE = `Classify this painting into exactly ONE of:

Realism — Accurate everyday / observable subjects; natural proportions and perspective; detailed surfaces; believable light/shadow; minimal idealization or distortion.

Impressionism — Light, atmosphere, the moment; visible loose brushwork; broken color / optical mixing; softer detail and edges; often outdoor or changing light.

Expressionism — Emotion over accuracy; distorted forms, exaggerated color; bold lines and dramatic contrast; subjective psychological mood; tense, raw, or symbolic feeling.

Abstract Art — Away from direct representation; emphasis on shape, color, line, texture, composition; may simplify, distort, or abandon recognizable subject; design, rhythm, visual relationships; meaning interpretive not literal.

Pick the single best fit. If multiple apply, choose the dominant intent visible in the work.`;

const NOVICE_GUARDRAIL = `Important calibration rule:
- Do not confuse childlike, novice, or underdeveloped work with successful Expressionism or Abstract Art merely because it is simplified, distorted, high-contrast, or bold.
- Successful stylization still shows deliberate control, internal coherence, and repeatable visual logic.
- Rudimentary anatomy, arbitrary placement, elementary symbol-making, or very limited value/edge control are evidence of beginner execution, not proof of expressive mastery.
- If the image looks like an early-stage or childlike drawing, say so plainly in the rationale instead of dressing it up as expert stylization.`;

export async function runOpenAIClassifyStyle(
  apiKey: string,
  imageDataUrl: string,
  options?: { model?: string }
): Promise<ClassifyStyleResult> {
  const model = resolveOpenAIModel('classification', options?.model);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      // Style classification is a tight enum + rationale; `low` reasoning is
      // enough on gpt-5 and keeps this fast. Non-reasoning chat models still
      // get the old temperature.
      ...buildOpenAISamplingParam(model, { temperature: 0.2, reasoningEffort: 'low' }),
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [
        {
          role: 'system',
          content: `You are an art historian. ${STYLE_GUIDE}

${NOVICE_GUARDRAIL}

Respond with JSON only matching the schema. rationale: 3–4 sentences. Name where on the canvas the evidence appears (e.g. upper area, focal figure, foreground); cite brushwork, edges, color temperature, space, or subject treatment—not vague style labels alone.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Which style category fits this painting best?' },
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
  const parsed = JSON.parse(text) as ClassifyStyleResult;
  if (!STYLE_ENUM.includes(parsed.style)) throw new Error('Invalid style in response');
  if (typeof parsed.rationale !== 'string') throw new Error('Invalid rationale');
  return parsed;
}
