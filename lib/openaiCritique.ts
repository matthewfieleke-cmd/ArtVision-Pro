import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import { runCritiqueCalibrationStage } from './critiqueCalibrationStage.js';
import { buildEvidenceStagePrompt } from './critiqueEvidenceStage.js';
import {
  buildHighDetailImageMessage,
  type VisionUserMessagePart,
} from './openaiVisionContent.js';
import { EVIDENCE_OPENAI_SCHEMA } from './critiqueZodSchemas.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';
import { validateCritiqueResult, validateEvidenceResult } from './critiqueValidation.js';
import { runCritiqueWritingStage } from './critiqueWritingStage.js';

async function runCritiqueEvidenceStage(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<ReturnType<typeof validateEvidenceResult>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.15,
      response_format: {
        type: 'json_schema',
        json_schema: EVIDENCE_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: buildEvidenceStagePrompt(args.style, args.medium),
        },
        {
          role: 'user',
          content: args.userContent,
        },
      ],
    }),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${response.status}`);
  }

  const choices = json.choices as Array<{
    message?: { content?: string };
    finish_reason?: string;
  }> | undefined;
  const choice = choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Evidence response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty model response');

  try {
    return validateEvidenceResult(JSON.parse(text));
  } catch {
    throw new Error('Model returned invalid evidence JSON');
  }
}

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
  const trimmedUserTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  const titleLine =
    trimmedUserTitle.length > 0
      ? ` The artist titled this work: "${trimmedUserTitle}". Use that title when referring to the piece in summary and feedback where natural.`
      : '';

  const titleSuggestionLine =
    trimmedUserTitle.length === 0
      ? ` The artist has not supplied a title. You must still output suggestedPaintingTitles: exactly three categorized title objects. One "formalist" (from Composition, Value, Color, Drawing criteria—name the dominant structural element), one "tactile" (from Style, Medium, Surface, Edge criteria—name the physical execution), one "intent" (from Intent and Presence criteria—name the mood/psychology). Each { category, title, rationale }. Title Case, no quotes, no cliché. Rationale: 1–2 sentences explaining how the specific criterion data generated this title.`
      : '';

  const userContent: VisionUserMessagePart[] = [
    {
      type: 'text',
      text: `Analyze this painting for studio use. Style: ${body.style}. Medium: ${body.medium}.${titleLine}${titleSuggestionLine}

Ground every criterion in what is visible in the photo. Prefer "in the ___ area of the painting" over abstract wording.${
        body.previousCritique && body.previousImageDataUrl
          ? '\n\nA previous photo of the same painting is attached second, followed by the prior critique JSON.'
          : ''
      }`,
    },
    buildHighDetailImageMessage(body.imageDataUrl),
  ];

  if (body.previousImageDataUrl && body.previousCritique) {
    userContent.push(buildHighDetailImageMessage(body.previousImageDataUrl));
    userContent.push({
      type: 'text',
      text: `Prior critique JSON (for comparison only):\n${JSON.stringify(body.previousCritique)}`,
    });
  }

  let evidence = await runCritiqueEvidenceStage(apiKey, {
    model,
    style: body.style,
    medium: body.medium,
    userContent,
  });
  let calibration = await runCritiqueCalibrationStage(
    apiKey,
    model,
    body.style,
    body.medium,
    evidence,
    userContent
  );

  let parsed = await runCritiqueWritingStage(apiKey, model, body.style, body, evidence, calibration);
  let base = validateCritiqueResult(parsed);
  let withCompletion = {
    ...base,
    completionRead: {
      state: evidence.completionRead.state,
      confidence: evidence.completionRead.confidence,
      cues: evidence.completionRead.cues,
      rationale: evidence.completionRead.rationale,
    },
  };

  if (critiqueNeedsFreshEvidenceRead(withCompletion)) {
    evidence = await runCritiqueEvidenceStage(apiKey, {
      model,
      style: body.style,
      medium: body.medium,
      userContent,
    });
    calibration = await runCritiqueCalibrationStage(
      apiKey,
      model,
      body.style,
      body.medium,
      evidence,
      userContent
    );
    parsed = await runCritiqueWritingStage(apiKey, model, body.style, body, evidence, calibration);
    base = validateCritiqueResult(parsed);
    withCompletion = {
      ...base,
      completionRead: {
        state: evidence.completionRead.state,
        confidence: evidence.completionRead.confidence,
        cues: evidence.completionRead.cues,
        rationale: evidence.completionRead.rationale,
      },
    };
  }

  const validated = applyCritiqueGuardrails(withCompletion);
  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...validated, paintingTitle: trimmedTitle } : validated;
}
