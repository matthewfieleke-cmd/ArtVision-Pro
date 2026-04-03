import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import { runCritiqueCalibrationStage } from './critiqueCalibrationStage.js';
import { buildEvidenceStagePrompt } from './critiqueEvidenceStage.js';
import {
  buildHighDetailImageMessage,
  type VisionUserMessagePart,
} from './openaiVisionContent.js';
import { EVIDENCE_OPENAI_SCHEMA } from './critiqueZodSchemas.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';
import { validateEvidenceResult } from './critiqueValidation.js';
import { runCritiqueWritingStage } from './critiqueWritingStage.js';
import {
  CritiqueGroundingError,
  CritiqueRetryExhaustedError,
  CritiqueValidationError,
  errorDetails,
  errorMessage,
} from './critiqueErrors.js';
import { assertCritiqueQualityGate } from './critiqueEval.js';

const EVIDENCE_MAX_TOKENS = 3600;

async function runCritiqueEvidenceStage(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
    repairNote?: string;
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
      max_tokens: EVIDENCE_MAX_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: EVIDENCE_OPENAI_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: args.repairNote
            ? `${buildEvidenceStagePrompt(args.style, args.medium)}\n\nCorrection required on retry:\n${args.repairNote}`
            : buildEvidenceStagePrompt(args.style, args.medium),
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
  } catch (error) {
    if (error instanceof Error && error.message !== 'Model returned invalid evidence JSON') {
      throw new CritiqueValidationError('Evidence stage validation failed.', {
        stage: 'evidence',
        details: [error.message],
        cause: error,
      });
    }
    throw new CritiqueValidationError('Model returned invalid evidence JSON', {
      stage: 'evidence',
      cause: error,
    });
  }
}

const MAX_STAGE_ATTEMPTS = 3;

export function buildEvidenceRepairNote(error: unknown): string {
  const details = errorDetails(error);
  const surfaceAnchorFailure = details.some((detail) =>
    /Invalid evidence anchor for Surface and medium handling|Visible evidence does not support anchor for Surface and medium handling/.test(
      detail
    )
  );
  const unsupportedAnchorCriteria = Array.from(
    new Set(
      details
        .map((detail) => detail.match(/^Visible evidence does not support anchor for (.+)$/)?.[1]?.trim())
        .filter((criterion): criterion is string => Boolean(criterion))
    )
  );

  return `Previous evidence attempt failed: ${errorMessage(error)}\n${errorDetails(error)
    .map((detail) => `- ${detail}`)
    .join('\n')}\nRegenerate the full evidence JSON. Use one concrete anchor per criterion, keep every claim visible, and do not change the schema.

Critical anchor rule:
- Every criterion anchor must name one physical passage or junction on the canvas, not a painting-wide abstraction.
- For Intent and necessity or Presence, point of view, and human force, anchor to the visible carrier of that intent or force: a face against a wall, a path into an opening, a hand against cloth, a silhouette against ground.
- Replace abstract anchors like "the overall mood", "the composition overall", "the story", or "the emotional tone" with a single locatable passage the user could point to.${unsupportedAnchorCriteria.length > 0
    ? `

Critical anchor-support fix for ${unsupportedAnchorCriteria.join(', ')}:
- For each listed criterion, at least one visibleEvidence line MUST repeat the same concrete nouns from the anchor and then describe what is visibly happening in that exact passage.
- Do not anchor to one relationship and then list only nearby but differently named passages.
- If the anchor names a grouping, overlap, scaffold, gap, band, or junction, one visibleEvidence line must name that same grouping, overlap, scaffold, gap, band, or junction again using the same objects or zones.`
    : ''}${surfaceAnchorFailure
    ? `

Critical repair for Surface and medium handling:
- Do NOT use anchors like "brushwork", "paint handling", "surface quality", or any painting-wide surface label.
- Choose one locatable mark-bearing passage instead, such as a hatch field against a smoother shirt passage, a loaded highlight stroke against a darker rim, or a dry scumble crossing a shadow.
- At least one visibleEvidence line for Surface and medium handling must repeat the same concrete nouns from that anchor and then describe the mark behavior visible there.`
    : ''}`;
}

async function runCritiqueEvidenceStageWithRetries(
  apiKey: string,
  args: {
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
  }
): Promise<ReturnType<typeof validateEvidenceResult>> {
  let repairNote: string | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
    try {
      return await runCritiqueEvidenceStage(apiKey, {
        ...args,
        repairNote,
      });
    } catch (error) {
      lastError = error;
      if (attempt === MAX_STAGE_ATTEMPTS) {
        throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', attempt, {
          stage: 'evidence',
          details: errorDetails(error),
          cause: error,
        });
      }
      repairNote = buildEvidenceRepairNote(error);
    }
  }

  throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', MAX_STAGE_ATTEMPTS, {
    stage: 'evidence',
    details: errorDetails(lastError),
    cause: lastError,
  });
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

  const evidence = await runCritiqueEvidenceStageWithRetries(apiKey, {
    model,
    style: body.style,
    medium: body.medium,
    userContent,
  });
  const calibration = await runCritiqueCalibrationStage(
    apiKey,
    model,
    body.style,
    body.medium,
    evidence,
    userContent
  );

  const base = await runCritiqueWritingStage(apiKey, model, body.style, body, evidence, calibration);
  const withCompletion = {
    ...base,
    completionRead: {
      state: evidence.completionRead.state,
      confidence: evidence.completionRead.confidence,
      cues: evidence.completionRead.cues,
      rationale: evidence.completionRead.rationale,
    },
  };

  const guarded = applyCritiqueGuardrails(withCompletion);

  if (critiqueNeedsFreshEvidenceRead(guarded)) {
    throw new CritiqueGroundingError('Critique drifted from its evidence anchors after generation.', {
      stage: 'final',
      details: [
        'The final critique no longer stayed aligned to the anchored evidence passages.',
        'A fresh retry would risk degrading silently, so the pipeline failed closed.',
      ],
    });
  }

  assertCritiqueQualityGate(guarded);
  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...guarded, paintingTitle: trimmedTitle } : guarded;
}
