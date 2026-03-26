import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import type { CritiqueRequestBody } from './critiqueTypes.js';
import { CRITIQUE_JSON_SCHEMA, buildCritiqueSchemaInstruction } from './critiqueSchemas.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';

function isStyleKey(s: string): s is StyleKey {
  return Object.prototype.hasOwnProperty.call(ARTISTS_BY_STYLE, s);
}

export function buildWritingPrompt(style: string): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  return `You are stage 2 of a painting critique system.

You are now writing the critique from already extracted evidence.

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Do not invent visible claims that are not supported by the evidence.
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Your usefulness comes from precision, not from forced criticism.

Benchmarks for what "Master" means in this style: ${benchmarks}

Anti-pattern examples:
- Bad: "The painting needs a stronger focal point."
- Better: "The eye already moves through several active areas. Keep that distributed attention, but quiet the one competing accent that interrupts the painting's main rhythm."

- Bad: "Increase contrast to create more depth."
- Better: "The compressed value range is part of the mood. Keep that compression, but separate one important shape from its neighbor with a smaller value and temperature shift."

- Bad: "Refine the edges to improve clarity."
- Better: "Most of the softness is doing useful atmospheric work. Keep the broad soft passages, but sharpen only the one edge that truly needs to hold the eye."

- Bad: "Make the composition more dynamic."
- Better: "The stillness is part of the work's effect. Instead of forcing more drama, adjust one directional cue so the eye moves more naturally through the existing calm."

- Bad: "Harmonize the colors."
- Better: "Do not flatten the color differences that give the painting life. Keep the vivid accents, but quiet the one passage that breaks the painting's color world."

Return JSON only matching the schema.`;
}

export async function runCritiqueWritingStage(
  apiKey: string,
  model: string,
  style: string,
  body: CritiqueRequestBody,
  evidence: CritiqueEvidenceDTO
): Promise<unknown> {
  const writingRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.22,
      max_tokens: 4500,
      response_format: {
        type: 'json_schema',
        json_schema: CRITIQUE_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: buildWritingPrompt(style) },
        {
          role: 'user',
          content: `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\n${buildCritiqueSchemaInstruction()}`,
        },
      ],
    }),
  });

  const json = (await writingRes.json()) as Record<string, unknown>;
  if (!writingRes.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${writingRes.status}`);
  }

  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty model response');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Model returned non-JSON');
  }
}
