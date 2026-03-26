import { applyCritiqueGuardrails } from './critiqueAudit.js';
import { parseDataUrl, runEvidenceStage } from './critiqueEvidenceStage.js';
import { CRITIQUE_JSON_SCHEMA } from './critiqueSchemas.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';
import { buildCritiqueSchemaInstruction, validateResult } from './critiqueValidation.js';
import { buildWritingPrompt, runWritingStage } from './critiqueWritingStage.js';

export async function runOpenAICritique(
  apiKey: string,
  body: CritiqueRequestBody,
  options?: { model?: string }
): Promise<CritiqueResultDTO> {
  const model =
    options?.model ??
    process.env.OPENAI_CRITIQUE_MODEL ??
    process.env.OPENAI_MODEL ??
    'gpt-4o';
  const { mime, base64 } = parseDataUrl(body.imageDataUrl);

  const titleLine =
    typeof body.paintingTitle === 'string' && body.paintingTitle.trim().length > 0
      ? ` The artist titled this work: "${body.paintingTitle.trim()}". Use that title when referring to the piece in summary and feedback where natural.`
      : '';

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } }
  > = [
    {
      type: 'text',
      text: `Analyze this painting for studio use. Style: ${body.style}. Medium: ${body.medium}.${titleLine}

Ground every criterion in what is visible in the photo. Prefer "in the ___ area of the painting" over abstract wording.${
        body.previousCritique && body.previousImageDataUrl
          ? '\n\nA previous photo of the same painting is attached second, followed by the prior critique JSON.'
          : ''
      }`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' },
    },
  ];

  if (body.previousImageDataUrl && body.previousCritique) {
    const prev = parseDataUrl(body.previousImageDataUrl);
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${prev.mime};base64,${prev.base64}`, detail: 'high' },
    });
    userContent.push({
      type: 'text',
      text: `Prior critique JSON (for comparison only):\n${JSON.stringify(body.previousCritique)}`,
    });
  }

  const evidence = await runEvidenceStage(apiKey, {
    model,
    style: body.style,
    medium: body.medium,
    userContent,
  });

  const parsed = await runWritingStage(apiKey, {
    model,
    style: body.style,
    evidence,
    jsonSchema: CRITIQUE_JSON_SCHEMA,
    schemaInstruction: buildCritiqueSchemaInstruction(),
    writingPrompt: buildWritingPrompt(body.style),
  });

  const validated = applyCritiqueGuardrails(validateResult(parsed));
  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...validated, paintingTitle: trimmedTitle } : validated;
}
