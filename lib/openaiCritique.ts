import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from './critiqueAudit.js';
import { runCritiqueCalibrationStage } from './critiqueCalibrationStage.js';
import { applyCalibrationToCritique } from './critiqueCalibrationStage.js';
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
  CritiquePipelineError,
  CritiqueGroundingError,
  CritiqueRuntimeEvalError,
  CritiqueRetryExhaustedError,
  CritiqueValidationError,
  type CritiqueCriterionEvidencePreview,
  type CritiqueDebugPayload,
  type CritiqueDebugInfo,
  errorDetails,
  errorMessage,
} from './critiqueErrors.js';
import { assertCritiqueQualityGate } from './critiqueEval.js';
import {
  createCritiqueInstrumenter,
  critiqueInstrumentEnabled,
  noopCritiqueInstrumenter,
} from './critiqueInstrumentation.js';
import { weakWorkCompositionRepairExamples, weakWorkRepairExamples } from './critiqueWeakWorkContracts.js';

const EVIDENCE_MAX_TOKENS = 3600;

function summarizeRawForLog(raw: unknown): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) return '[unserializable raw payload]';
    return serialized.length > 4000 ? `${serialized.slice(0, 4000)}…[truncated]` : serialized;
  } catch {
    return '[unserializable raw payload]';
  }
}

function extractCriterionEvidencePreview(raw: unknown): Array<{
  criterion: string;
  anchor?: string;
  visibleEvidencePreview?: string[];
}> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const criterionEvidence = (raw as { criterionEvidence?: unknown }).criterionEvidence;
  if (!Array.isArray(criterionEvidence)) return undefined;
  return criterionEvidence
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      criterion: typeof entry.criterion === 'string' ? entry.criterion : '[missing criterion]',
      ...(typeof entry.anchor === 'string' ? { anchor: entry.anchor } : {}),
      ...(Array.isArray(entry.visibleEvidence)
        ? {
            visibleEvidencePreview: entry.visibleEvidence
              .filter((line): line is string => typeof line === 'string')
              .slice(0, 4),
          }
        : {}),
    }));
}

function criterionEvidencePreviewFromError(error: unknown): CritiqueCriterionEvidencePreview[] {
  if (!(error instanceof CritiquePipelineError)) return [];
  const previews = error.debug?.attempts?.[0]?.criterionEvidencePreview;
  return Array.isArray(previews) ? previews : [];
}

function formatCriterionEvidencePreview(
  previews: CritiqueCriterionEvidencePreview[],
  criteria: string[],
  heading: string
): string {
  const blocks = criteria
    .map((criterion) => previews.find((preview) => preview.criterion === criterion))
    .filter((preview): preview is CritiqueCriterionEvidencePreview => Boolean(preview))
    .map((preview) => {
      const evidenceLines = (preview.visibleEvidencePreview ?? []).map((line) => `  - "${line}"`).join('\n');
      return `${heading} ${preview.criterion}:${preview.anchor ? `\n- Previous anchor: "${preview.anchor}"` : ''}${evidenceLines ? `\n- Previous visibleEvidence lines to rewrite:\n${evidenceLines}` : ''}`;
    });
  return blocks.length > 0 ? `\n\n${blocks.join('\n')}` : '';
}

function logEvidenceAttemptFailure(
  context: { attempt: number; repairNote?: string },
  error: unknown,
  raw?: unknown
): void {
  const errorDebug =
    error instanceof CritiqueValidationError || error instanceof CritiqueRetryExhaustedError
      ? error.debug?.attempts?.[0]
      : undefined;
  const payload = {
    stage: 'evidence',
    attempt: context.attempt,
    error: errorMessage(error),
    details: errorDetails(error),
    ...(context.repairNote ? { repairNotePreview: context.repairNote.slice(0, 1200) } : {}),
    ...(raw !== undefined
      ? {
          rawPreview: summarizeRawForLog(raw),
          criterionEvidencePreview: extractCriterionEvidencePreview(raw),
        }
      : errorDebug
        ? {
            ...(errorDebug.rawPreview ? { rawPreview: errorDebug.rawPreview } : {}),
            ...(errorDebug.criterionEvidencePreview
              ? { criterionEvidencePreview: errorDebug.criterionEvidencePreview }
              : {}),
          }
      : {}),
  };
  console.error('[critique evidence attempt failed]', payload);
}

function logQualityGateFailure(critique: CritiqueResultDTO): void {
  console.error('[critique quality gate payload]', {
    topPriorities: critique.overallSummary?.topPriorities ?? [],
    studioChanges: critique.simpleFeedback?.studioChanges ?? [],
    categories: critique.categories.map((category) => ({
      criterion: category.criterion,
      level: category.level,
      teacherNextSteps: category.phase3.teacherNextSteps,
      anchor: category.anchor?.areaSummary,
      editTarget: category.editPlan?.targetArea,
      intendedChange: category.editPlan?.intendedChange,
    })),
  });
}

function logGroundingGateFailure(critique: CritiqueResultDTO): void {
  console.error('[critique grounding gate payload]', {
    summary: critique.summary,
    analysis: critique.overallSummary?.analysis ?? '',
    whatWorks: critique.simpleFeedback?.studioAnalysis.whatWorks ?? '',
    whatCouldImprove: critique.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '',
    topPriorities: critique.overallSummary?.topPriorities ?? [],
    studioChanges: critique.simpleFeedback?.studioChanges ?? [],
    categories: critique.categories.map((category) => ({
      criterion: category.criterion,
      anchorArea: category.anchor?.areaSummary,
      anchorPointer: category.anchor?.evidencePointer,
      critic: category.phase2.criticsAnalysis,
      teacher: category.phase3.teacherNextSteps,
      editTarget: category.editPlan?.targetArea,
    })),
  });
}

function buildEvidenceAttemptDebugInfo(args: {
  attempt: number;
  error: unknown;
  repairNote?: string;
  raw?: unknown;
}): CritiqueDebugInfo {
  return {
    attempt: args.attempt,
    error: errorMessage(args.error),
    details: errorDetails(args.error),
    ...(args.repairNote ? { repairNotePreview: args.repairNote.slice(0, 1200) } : {}),
    ...(args.raw !== undefined
      ? {
          rawPreview: summarizeRawForLog(args.raw),
          criterionEvidencePreview: extractCriterionEvidencePreview(args.raw),
        }
      : {}),
  };
}

function singleAttemptDebugPayload(args: {
  attempt: number;
  error: unknown;
  repairNote?: string;
  raw?: unknown;
}): CritiqueDebugPayload {
  return {
    attempts: [buildEvidenceAttemptDebugInfo(args)],
  };
}

async function runCritiqueEvidenceStage(
  apiKey: string,
  args: {
    attempt: number;
    model: string;
    style: string;
    medium: string;
    userContent: VisionUserMessagePart[];
    repairNote?: string;
    allowLenientValidation?: boolean;
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
    const raw = JSON.parse(text);
    try {
      return validateEvidenceResult(raw);
    } catch (error) {
      if (args.allowLenientValidation) {
        const message = error instanceof Error ? error.message : '';
        const canUseLenientFallback =
          /Evidence intentHypothesis is too flattering or style-biased for weak work|Evidence strongestVisibleQualities are too flattering or style-biased for weak work|Visible evidence is too generic for|strengthRead is too generic for|preserve is too generic for|Visible evidence does not support anchor for|Conceptual evidence anchor is too soft for/.test(
            message
          );
        if (canUseLenientFallback) {
          return validateEvidenceResult(raw, { mode: 'lenient' });
        }
      }
      throw error;
    }
  } catch (error) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }
    if (error instanceof Error && error.message !== 'Model returned invalid evidence JSON') {
      const debug = singleAttemptDebugPayload({
        attempt: args.attempt,
        error,
        repairNote: args.repairNote,
        raw,
      });
      throw new CritiqueValidationError('Evidence stage validation failed.', {
        stage: 'evidence',
        details: [error.message],
        cause: error,
        debug,
      });
    }
    const debug = singleAttemptDebugPayload({
      attempt: args.attempt,
      error,
      repairNote: args.repairNote,
      raw,
    });
    throw new CritiqueValidationError('Model returned invalid evidence JSON', {
      stage: 'evidence',
      cause: error,
      debug,
    });
  }
}

const MAX_STAGE_ATTEMPTS = 3;

export function buildEvidenceRepairNote(error: unknown): string {
  const details = errorDetails(error);
  const criterionPreviews = criterionEvidencePreviewFromError(error);
  const weakWorkExamples = weakWorkRepairExamples().map((rule) => `- ${rule}`).join('\n');
  const weakWorkCompositionExamples = weakWorkCompositionRepairExamples()
    .map((rule) => `- ${rule}`)
    .join('\n');
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
  const genericEvidenceCriteria = Array.from(
    new Set(
      details
        .map((detail) => detail.match(/^(?:Visible evidence|strengthRead|preserve) is too generic for (.+)$/)?.[1]?.trim())
        .filter((criterion): criterion is string => Boolean(criterion))
    )
  );
  const topLevelToneFailure = details.some((detail) =>
    /(?:Evidence )?intentHypothesis is too flattering or style-biased(?: for weak work)?|(?:Evidence )?strongestVisibleQualities are too flattering or style-biased(?: for weak work)?|(?:Evidence )?comparisonObservations are too flattering or style-biased(?: for weak work)?/.test(
      detail
    )
  );
  const genericEvidencePreviewBlock = formatCriterionEvidencePreview(
    criterionPreviews,
    genericEvidenceCriteria,
    'Previous evidence preview for'
  );
  const unsupportedAnchorPreviewBlock = formatCriterionEvidencePreview(
    criterionPreviews,
    unsupportedAnchorCriteria,
    'Previous anchor-support preview for'
  );

  return `Previous evidence attempt failed: ${errorMessage(error)}\n${errorDetails(error)
    .map((detail) => `- ${detail}`)
    .join('\n')}\nRegenerate the full evidence JSON. Use one concrete anchor per criterion, keep every claim visible, and do not change the schema.

Critical anchor rule:
- Every criterion anchor must name one physical passage or junction on the canvas, not a painting-wide abstraction.
- For Intent and necessity or Presence, point of view, and human force, anchor to the visible carrier of that intent or force: a face against a wall, a path into an opening, a hand against cloth, a silhouette against ground.
- On object studies or architecture, conceptual anchors still need a physical carrier passage: a pump head against a bottle neck, a floral label on the bottle, a red door under a lit window, or a roofline against the night sky.
- Replace abstract anchors like "the overall mood", "the composition overall", "the story", or "the emotional tone" with a single locatable passage the user could point to.
- Do NOT use flattering anchor labels such as "the arrangement of flowers", "the cozy house", "the vibrant garden", "the idyllic setting", or "the narrative journey of the path". Name the visible object pair or junction instead.
- Do NOT use object-summary anchors like "the beauty of the bottle", "the elegance of the object", "the festive house", "the decorated house", or "the holiday mood". Name the visible carrier passage instead.
- Do NOT use house-scene summaries like "the welcoming house", "the festive mood", "the holiday atmosphere", or "the warmth inside". Name the door/window/roofline carrier passage instead.
- For weak landscapes or garden scenes, prefer anchors shaped like "the path bend under the red house", "the roof edge against the blue wash", "the flower patch where it meets the path edge", or "the fence post against the foliage".
- For cafe or street scenes, prefer anchors shaped like "the cafe tables with yellow umbrellas", "the seated figures under the yellow umbrellas", "the path narrowing into the cafe tables", or "the nearest building arch behind the cafe tables".${unsupportedAnchorCriteria.length > 0
    ? `

Critical anchor-support fix for ${unsupportedAnchorCriteria.join(', ')}:
- For each listed criterion, at least one visibleEvidence line MUST repeat the same concrete nouns from the anchor and then describe what is visibly happening in that exact passage.
- Do not anchor to one relationship and then list only nearby but differently named passages.
- If the anchor names a grouping, overlap, scaffold, gap, band, or junction, one visibleEvidence line must name that same grouping, overlap, scaffold, gap, band, or junction again using the same objects or zones.
- For weak landscape anchors, repeat BOTH sides of the relationship in one evidence line. Example: if the anchor is "the purple flower patch where it meets the path edge", one visibleEvidence line must mention both the purple flower patch and the path edge again in the same sentence.${unsupportedAnchorPreviewBlock}`
    : ''}${genericEvidenceCriteria.length > 0
    ? `

Critical generic-language fix for ${genericEvidenceCriteria.join(', ')}:
- For Intent and necessity or Presence, point of view, and human force, do NOT use phrases like "narrative journey", "inviting atmosphere", "idyllic setting", "warmth", "life and activity", or "sense of story" unless the same sentence also names the exact visible carrier relationship that creates that read.
- Do NOT write "the path leading to the house" or "the smoke from the chimney" as sufficient conceptual evidence on a weak landscape. Prefer "the path bend where it meets the house shadow" or "the chimney smoke against the blue wash."
- Do NOT write "the outdoor seating area", "the cafe atmosphere", or "the path leading through the scene" as sufficient conceptual evidence on a cafe or street scene. Prefer "the cafe tables with yellow umbrellas", "the seated figures under the yellow umbrellas", or "the nearest building arch behind the cafe tables."
- Do NOT write object-study summaries like "the bottle feels elegant", "the object blends nature and technology", "the house feels festive", or "the windows create warmth" as sufficient conceptual evidence. Prefer "the floral label on the glass bottle", "the pump head against the bottle neck", "the red door under the lit window", or "the lit window against the dark facade."
- Do NOT write house-scene summaries like "the house feels welcoming", "the festive mood reads clearly", "the holiday atmosphere comes through", or "the windows create warmth" as sufficient conceptual evidence or strengthRead language. Prefer "the red door under the lit window", "the lit window against the dark facade", or "the roofline above the window stack."
- strengthRead and preserve must also name that same visible carrier passage, not a mood summary. If the criterion is conceptual, reuse the anchor nouns directly in strengthRead and preserve.
- For Composition and shape structure, do NOT use stock phrases like "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact path bend, roof edge, fence post, flower band, or other structural passage creating that effect.
- For Composition and shape structure in cafe or street scenes, replace summaries like "the path guides the eye", "the tables create rhythm", or "the umbrellas create a focal point" with event language such as "the path narrowing into the cafe tables leaves a wider ground shape on one side" or "the nearest building arch lands behind the tables and repeats their curve higher up the wall."
- For Composition and shape structure, write a shape event, not a verdict: what narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, or tilts in that exact passage.
- For Composition and shape structure on object studies or architecture, do NOT stop at verdicts like "the bottle is centered", "the house is well-balanced", or "the roof creates structure". Write the visible event instead: what aligns, tilts, lands, repeats, leaves a wider side, or steps against a neighboring passage.
- On seascapes, harbors, or other strong paintings, the same rule still applies: prefer "the reflection cuts through the harbor bands", "the boat silhouette sits left of the reflection", or "the masts echo that vertical above the horizon" over verdicts like "the reflection organizes the composition" or "the boat creates balance."
- If one visibleEvidence line is already concrete, keep it and rewrite the generic filler lines so the full list stays at junction/event level.
- Rewrite the quoted lines below instead of paraphrasing the same generic idea again.${genericEvidencePreviewBlock}
${weakWorkCompositionExamples}`
    : ''}${topLevelToneFailure
    ? `

Critical top-level tone fix:
- intentHypothesis, strongestVisibleQualities, and comparisonObservations must stay provisional and evidence-led for weak work.
- Do NOT open with "whimsical charm", "idyllic rural life", "lively atmosphere", or artist praise like "Monet's garden scenes" unless the criterion evidence already proves unusually strong control.
- Describe what is visibly happening in plain terms before making any flattering style comparison.
- Safe rewrite pattern for weak work:
  - intentHypothesis = "The painting appears to organize the scene around [visible things]."
  - strongestVisibleQualities = plain statements about path / house / flower band / sky wash / edge contrast, not mood praise.
  - comparisonObservations = omit artist-name praise unless the criterion evidence clearly shows exceptional control.
${weakWorkExamples}`
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
  const attemptDebug: CritiqueDebugInfo[] = [];

  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
    try {
      return await runCritiqueEvidenceStage(apiKey, {
        attempt,
        ...args,
        repairNote,
        allowLenientValidation: attempt === MAX_STAGE_ATTEMPTS,
      });
    } catch (error) {
      lastError = error;
      const debug =
        error instanceof CritiqueValidationError && error.debug?.attempts?.[0]
          ? error.debug.attempts[0]
          : buildEvidenceAttemptDebugInfo({
              attempt,
              error,
              repairNote,
            });
      attemptDebug.push(debug);
      logEvidenceAttemptFailure({ attempt, repairNote }, error);
      if (attempt === MAX_STAGE_ATTEMPTS) {
        throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', attempt, {
          stage: 'evidence',
          details: errorDetails(error),
          debug: { attempts: attemptDebug },
          cause: error,
        });
      }
      repairNote = buildEvidenceRepairNote(error);
    }
  }

  throw new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', MAX_STAGE_ATTEMPTS, {
    stage: 'evidence',
    details: errorDetails(lastError),
    debug: { attempts: attemptDebug },
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

  const instrumenter = critiqueInstrumentEnabled()
    ? createCritiqueInstrumenter(true)
    : noopCritiqueInstrumenter;

  const evidence = await instrumenter.time('evidence', () =>
    runCritiqueEvidenceStageWithRetries(apiKey, {
      model,
      style: body.style,
      medium: body.medium,
      userContent,
    })
  );
  const calibration = await instrumenter.time('calibration', () =>
    runCritiqueCalibrationStage(apiKey, model, body.style, body.medium, evidence, userContent)
  );

  const base = await runCritiqueWritingStage(
    apiKey,
    model,
    body.style,
    body,
    evidence,
    calibration,
    instrumenter
  );
  const calibrated = applyCalibrationToCritique(base, calibration);
  const withCompletion = {
    ...calibrated,
    completionRead: {
      state: evidence.completionRead.state,
      confidence: evidence.completionRead.confidence,
      cues: evidence.completionRead.cues,
      rationale: evidence.completionRead.rationale,
    },
  };

  const guarded = applyCritiqueGuardrails(withCompletion, instrumenter);

  if (critiqueNeedsFreshEvidenceRead(guarded)) {
    if (instrumenter.enabled) {
      logGroundingGateFailure(guarded);
    }
    throw new CritiqueGroundingError('Critique drifted from its evidence anchors after generation.', {
      stage: 'final',
      details: [
        'The final critique no longer stayed aligned to the anchored evidence passages.',
        'A fresh retry would risk degrading silently, so the pipeline failed closed.',
      ],
    });
  }

  try {
    assertCritiqueQualityGate(guarded);
  } catch (error) {
    if (instrumenter.enabled && error instanceof CritiqueRuntimeEvalError) {
      logQualityGateFailure(guarded);
    }
    throw error;
  }
  instrumenter.logSummary({ model });

  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...guarded, paintingTitle: trimmedTitle } : guarded;
}
