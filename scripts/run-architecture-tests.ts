import assert from 'node:assert/strict';

import { buildEditPrompt } from '../lib/openaiPreviewEdit.ts';
import { buildHighDetailImageMessage } from '../lib/openaiVisionContent.js';
import { buildEvidenceStagePrompt } from '../lib/critiqueEvidenceStage.js';
import {
  CRITERION_JSON_SCHEMA,
  PARALLEL_CRITERIA_SYSTEM_MESSAGE,
} from '../lib/critiqueParallelCriteria.js';
import { CritiqueRetryExhaustedError, serializeCritiquePipelineError } from '../lib/critiqueErrors.js';
import {
  applyCorsHeaders,
  handleApiRequest,
  resolveApiRoute,
} from '../lib/apiHandlers.js';
import {
  createCritiqueRequestError,
  normalizeCritiqueRequestError,
} from '../src/critiqueRequestError.ts';
import {
  backFromCapture,
  backFromResults,
  beginAnalysis,
  canContinueFromSetup,
  chooseMedium,
  chooseStyle,
  clearClassifySource,
  completeAnalysis,
  createNewFlow,
  createResubmitFlow,
  enterCapture,
  isCritiqueFlow,
  switchToAutoStyle,
  switchToManualStyle,
} from '../src/critiqueFlow.js';
import type { CritiqueResult, SavedPainting } from '../src/types.js';
import { runPreviewResizeTests } from './test-preview-resize.js';
import { formatRubricForPrompt, getCriterionRubric } from '../shared/masterCriteriaRubric.js';
import {
  voiceBPlanSchema,
  voiceBStepSchema,
  anchorSchema,
  editPlanSchema,
  VOICE_A_OPENAI_SCHEMA,
  VOICE_B_OPENAI_SCHEMA,
  EVIDENCE_OPENAI_SCHEMA,
} from '../lib/critiqueZodSchemas.ts';

function makeCritiqueResult(): CritiqueResult {
  return {
    summary: 'Solid structure with one weak edge hierarchy.',
    categories: [
      {
        criterion: 'Composition and shape structure',
        level: 'Advanced',
        phase1: { visualInventory: 'Large shapes are organized into a stable scaffold across the rectangle.' },
        phase2: { criticsAnalysis: 'The composition already reads as coherent and controlled.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Value and light structure',
        level: 'Advanced',
        phase1: { visualInventory: 'The light-dark grouping is readable across the main masses.' },
        phase2: { criticsAnalysis: 'The value structure is holding together convincingly.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Color relationships',
        level: 'Advanced',
        phase1: { visualInventory: 'Color families stay in a coherent palette world.' },
        phase2: { criticsAnalysis: 'Color relationships are already functioning with control.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Advanced',
        phase1: { visualInventory: 'The main forms sit in space with believable placement.' },
        phase2: { criticsAnalysis: 'The drawing and spatial form read as persuasive.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        phase1: { visualInventory: 'Some secondary edges compete too strongly with the intended focal passage.' },
        phase2: { criticsAnalysis: 'The focus hierarchy is weaker here than in the other criteria.' },
        phase3: { teacherNextSteps: '1. Quiet the background edges.' },
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        phase1: { visualInventory: 'Mark families remain controlled and medium-appropriate.' },
        phase2: { criticsAnalysis: 'Surface handling reads as confident and economical.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        phase1: { visualInventory: 'The major decisions support one readable pictorial aim.' },
        phase2: { criticsAnalysis: 'Intent reads as coherent rather than accidental.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Advanced',
        phase1: { visualInventory: 'The point of view creates a stable sense of presence.' },
        phase2: { criticsAnalysis: 'The work carries a persuasive human pressure.' },
        phase3: { teacherNextSteps: '1. Keep going.' },
      },
    ],
  };
}

function makeSavedPainting(): SavedPainting {
  return {
    id: 'painting-1',
    title: 'Harbor Morning',
    style: 'Realism',
    medium: 'Oil on Canvas',
    versions: [
      {
        id: 'version-1',
        imageDataUrl: 'data:image/png;base64,abc',
        createdAt: '2026-03-26T00:00:00.000Z',
        critique: makeCritiqueResult(),
      },
    ],
  };
}

async function testCritiqueFlow(): Promise<void> {
  let flow = createNewFlow();
  assert.equal(flow.step, 'setup');
  assert.equal(canContinueFromSetup(flow, false), false);

  flow = chooseStyle(flow, 'Realism');
  flow = chooseMedium(flow, 'Oil on Canvas');
  assert.equal(canContinueFromSetup(flow, false), true);

  const captureFlow = enterCapture(flow);
  assert.ok(captureFlow);
  assert.equal(captureFlow.step, 'capture');

  const backToSetup = backFromCapture(captureFlow);
  assert.ok(backToSetup);
  assert.equal(backToSetup.step, 'setup');

  let autoFlow = switchToAutoStyle(flow);
  assert.equal(autoFlow.styleMode, 'auto');
  assert.equal(autoFlow.style, null);

  autoFlow = {
    ...autoFlow,
    style: 'Impressionism',
    classifySourceImageDataUrl: 'data:image/png;base64,classified',
    styleClassifyMeta: { rationale: 'Looks impressionist', source: 'local' },
  };
  const clearedClassify = clearClassifySource(autoFlow);
  assert.equal(clearedClassify.classifySourceImageDataUrl, undefined);
  assert.equal(switchToManualStyle(clearedClassify).styleMode, 'manual');

  const analyzingFlow = beginAnalysis(captureFlow, 'data:image/png;base64,raw');
  assert.ok(analyzingFlow);
  assert.equal(analyzingFlow.step, 'analyzing');

  const result = makeCritiqueResult();
  const resultsFlow = completeAnalysis(analyzingFlow, {
    imageDataUrl: 'data:image/png;base64,compressed',
    critique: result,
    critiqueSource: 'api',
  });
  assert.equal(resultsFlow.step, 'results');
  assert.ok(isCritiqueFlow(resultsFlow));

  const backToCaptureFromResults = backFromResults(resultsFlow);
  assert.equal(backToCaptureFromResults.step, 'capture');

  const resubmitFlow = createResubmitFlow(makeSavedPainting());
  assert.equal(resubmitFlow.mode, 'resubmit');
  assert.equal(backFromCapture(resubmitFlow), null);
}

async function testApiHelpers(): Promise<void> {
  const corsHeaders = new Map<string, string>();
  applyCorsHeaders((name, value) => corsHeaders.set(name, value), 'https://example.com');
  assert.equal(corsHeaders.get('Access-Control-Allow-Origin'), 'https://example.com');
  assert.equal(resolveApiRoute('/api/critique'), 'critique');
  assert.equal(resolveApiRoute('/api/critique?debug=1'), 'critique');
  assert.equal(resolveApiRoute('/api/nope'), null);

  const optionsResponse = await handleApiRequest({
    route: 'critique',
    method: 'OPTIONS',
    apiKey: undefined,
    body: {},
  });
  assert.equal(optionsResponse.status, 200);

  const notFound = await handleApiRequest({
    route: null,
    method: 'POST',
    apiKey: 'key',
    body: {},
  });
  assert.equal(notFound.status, 404);

  const methodNotAllowed = await handleApiRequest({
    route: 'classify-style',
    method: 'GET',
    apiKey: 'key',
    body: {},
  });
  assert.equal(methodNotAllowed.status, 405);

  const missingKey = await handleApiRequest({
    route: 'preview-edit',
    method: 'POST',
    apiKey: undefined,
    body: {},
  });
  assert.equal(missingKey.status, 503);

  const invalidCritiqueBody = await handleApiRequest({
    route: 'critique',
    method: 'POST',
    apiKey: 'key',
    body: { style: 'Realism', medium: 'Oil on Canvas' },
  });
  assert.equal(invalidCritiqueBody.status, 400);

  const invalidClassifyBody = await handleApiRequest({
    route: 'classify-style',
    method: 'POST',
    apiKey: 'key',
    body: {},
  });
  assert.equal(invalidClassifyBody.status, 400);
}

function testCriterionBandRubric(): void {
  const realismEdgeRubric = getCriterionRubric('Realism', 'Edge and focus control');
  assert.ok(realismEdgeRubric);
  assert.ok(realismEdgeRubric!.genericBands.Beginner.visibleSignals.length > 0);
  assert.ok(realismEdgeRubric!.genericBands.Intermediate.visibleSignals.length > 0);
  assert.ok(realismEdgeRubric!.genericBands.Advanced.visibleSignals.length > 0);
  assert.ok(realismEdgeRubric!.genericBands.Master.visibleSignals.length > 0);
  assert.ok(realismEdgeRubric!.stylizationGuardrails.length > 0);

  const promptBlock = formatRubricForPrompt('Expressionism');
  assert.match(promptBlock, /Composition and shape structure:/);
  assert.match(promptBlock, /- Beginner:/);
  assert.match(promptBlock, /- Intermediate:/);
  assert.match(promptBlock, /- Advanced:/);
  assert.match(promptBlock, /- Master:/);
  assert.match(promptBlock, /Stylization guardrails:/);
  assert.match(promptBlock, /Style-aware signals for Expressionism:/);
}

function testEvidencePromptDemandsConcreteSurfaceAnchors(): void {
  // The observation-bank (vision) stage prompt carries the painting-level
  // invariants: passage grammar, medium-specific rules, no artist names,
  // painting-agnostic passage examples. Per-criterion anchor discipline
  // now lives in the per-criterion writer system message (see next test).
  const observationPrompt = buildEvidenceStagePrompt('Realism', 'Oil on Canvas');

  // Medium-specific rules must thread through for the declared medium.
  assert.match(observationPrompt, /Medium-specific evidence rules for Oil on Canvas/);

  // Passage grammar is named and carrier-grammar examples are present so
  // the observation bank produces pointable passages, not scene summaries.
  assert.match(observationPrompt, /carrier grammar/i);

  // Painting-agnostic passage examples (figurative + landscape + abstract)
  // are baked into the hard rules so the observation bank does not narrow
  // toward any single painting mode.
  assert.match(observationPrompt, /jaw edge/);
  assert.match(observationPrompt, /cadmium strip|olive field/i);
  assert.match(observationPrompt, /ridge line|impasto cluster/i);

  // The no-artist-names ban is load-bearing for both the observation stage
  // and the writer stage.
  assert.match(observationPrompt, /Never name any critic, teacher, artist/);

  // Per-criterion writer invariants now live on the CRITERION_JSON_SCHEMA
  // descriptions (prescriptive, load-bearing) plus the writer system
  // message (register + panels + anchor-region rules + painting-agnostic
  // examples). Probe both.
  const writerSchemaText = JSON.stringify(CRITERION_JSON_SCHEMA);
  const writerSys = PARALLEL_CRITERIA_SYSTEM_MESSAGE;

  // First visibleEvidence line must reuse the anchor's nouns — downstream
  // consumers (the AI-edit prompt, the stage-lighting overlay, legacy
  // saved-critique fallbacks) depend on this echo.
  assert.match(
    writerSchemaText,
    /The FIRST line MUST reuse the concrete nouns from anchor\.areaSummary/
  );

  // The writer's anchor must fit grammatically after "in", so downstream
  // prose can write "In [areaSummary], …". If this line goes away the
  // anchor drifts to predicate-shaped mini-sentences.
  assert.match(
    writerSchemaText,
    /Must fit grammatically after \\"in\\"|grammatically after "in"/
  );

  // Painting-agnostic example passages span figurative + abstract +
  // mark-level so the writer does not gravitate toward figurative language
  // regardless of what it is actually looking at — they live in the schema
  // descriptions AND in the system message, so every reader sees them.
  assert.match(writerSchemaText, /jaw edge/);
  assert.match(writerSchemaText, /cadmium strip|olive field/i);
  assert.match(writerSys, /jaw edge/);
  assert.match(writerSys, /cadmium strip|olive field/i);

  // editPlan is emitted for every criterion so every criterion has a
  // concrete AI-edit suggestion tied to the critique text.
  assert.ok(
    writerSchemaText.includes('"editPlan"'),
    'CRITERION_JSON_SCHEMA must declare a required editPlan field per criterion'
  );
}

function testSerializedPipelineErrorIncludesDebugMetadata(): void {
  const error = new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', 3, {
    stage: 'evidence',
    details: ['Visible evidence does not support anchor for Composition and shape structure'],
    debug: {
      attempts: [
        {
          attempt: 1,
          error: 'Evidence stage validation failed.',
          details: ['Visible evidence does not support anchor for Composition and shape structure'],
          rawPreview: '{"criterionEvidence":[{"criterion":"Composition and shape structure"}]}',
        },
      ],
    },
  });
  const serialized = serializeCritiquePipelineError(error);
  assert.equal(serialized.attempts, 3);
  assert.deepEqual(serialized.debug, {
    attempts: [
      {
        attempt: 1,
        error: 'Evidence stage validation failed.',
        details: ['Visible evidence does not support anchor for Composition and shape structure'],
        rawPreview: '{"criterionEvidence":[{"criterion":"Composition and shape structure"}]}',
      },
    ],
  });
}

function testValidationErrorDetailsAreHumanized(): void {
  const normalized = normalizeCritiqueRequestError(
    createCritiqueRequestError({
      operation: 'critique',
      kind: 'validation',
      technicalMessage: 'Voice B schema validation failed.',
      stage: 'voice_b',
      details: [
        '[{"origin":"string","code":"invalid_format","format":"regex","path":["categories",0,"actionPlanSteps",0,"move"],"message":"Invalid string: must match pattern /^\\\\s*(soften|group|separate|darken|quiet)/"}]',
        'Composition and shape structure: non-Master actionPlanSteps[0].move must be a true change instruction.',
      ],
      backendErrorName: 'CritiqueValidationError',
    }),
    'critique'
  );
  assert.equal(normalized.kind, 'validation');
  const renderedDetails = normalized.details.map((detail) => {
    const trimmed = detail.trim();
    if (!trimmed) return 'The critique response did not pass validation.';
    if (trimmed.startsWith('[{') || trimmed.startsWith('[')) {
      if (
        trimmed.includes('actionPlanSteps[0].move') ||
        (trimmed.includes('"path":["categories",0,"actionPlanSteps",0,"move"]') &&
          trimmed.includes('"invalid_format"'))
      ) {
        return 'The teaching-plan move was not a concrete change instruction for that criterion.';
      }
      if (
        trimmed.includes('bestNextMove') ||
        (trimmed.includes('"path":["categories",0,"voiceBPlan","bestNextMove"]') &&
          trimmed.includes('"invalid_format"'))
      ) {
        return 'The teaching-plan next move was not a concrete change instruction for that criterion.';
      }
      if (
        trimmed.includes('intendedChange') ||
        (trimmed.includes('"path":["categories",0,"editPlan","intendedChange"]') &&
          trimmed.includes('"invalid_format"'))
      ) {
        return 'The edit plan did not specify a concrete change instruction for that criterion.';
      }
      return 'The critique response did not match the required schema.';
    }
    return trimmed;
  });
  assert.deepEqual(renderedDetails, [
    'The teaching-plan move was not a concrete change instruction for that criterion.',
    'Composition and shape structure: non-Master actionPlanSteps[0].move must be a true change instruction.',
  ]);
}

function testRequestErrorCarriesDebugTrace(): void {
  const normalized = normalizeCritiqueRequestError(
    createCritiqueRequestError({
      operation: 'critique',
      kind: 'retry_exhausted',
      technicalMessage: 'Evidence stage exhausted retries.',
      stage: 'evidence',
      attempts: 3,
      details: ['Visible evidence does not support anchor for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence does not support anchor for Intent and necessity'],
            repairNotePreview: 'Previous evidence attempt failed...',
          },
        ],
      },
      backendErrorName: 'CritiqueRetryExhaustedError',
    }),
    'critique'
  );
  assert.deepEqual(normalized.debug, {
    attempts: [
      {
        attempt: 1,
        error: 'Evidence stage validation failed.',
        details: ['Visible evidence does not support anchor for Intent and necessity'],
        repairNotePreview: 'Previous evidence attempt failed...',
      },
    ],
  });
}

function testDebugLogPayloadSanitization(): void {
  const stringifySafe = (value: unknown): string => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  const truncateForLog = (value: unknown, maxLength: number = 320): string => {
    const text = typeof value === 'string' ? value : stringifySafe(value);
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
  };

  const circular: { name: string; self?: unknown } = { name: 'circular' };
  circular.self = circular;
  assert.equal(truncateForLog(circular), '[object Object]');

  const longText = 'x'.repeat(400);
  assert.equal(truncateForLog(longText, 10), `${'x'.repeat(10)}…`);
}

function testPreviewEditPromptAlignment(): void {
  const prompt = buildEditPrompt({
    imageDataUrl: 'data:image/png;base64,abc',
    style: 'Realism',
    medium: 'Oil on Canvas',
    target: {
      criterion: 'Edge and focus control',
      level: 'Intermediate',
      phase1: {
        visualInventory:
          'The foreground chair back crosses the face passage, and the interior verticals are close in sharpness to the head behind them.',
      },
      phase2: {
        criticsAnalysis:
          'In the foreground chair back, the interior verticals stay almost as insistent as the face.',
      },
      phase3: {
        teacherNextSteps:
          '1. In the foreground chair back, soften the interior verticals so they stop competing with the face.',
      },
      anchor: {
        areaSummary: 'the foreground chair back',
        evidencePointer: 'its interior verticals compete with the face instead of supporting it',
        region: { x: 0.18, y: 0.22, width: 0.24, height: 0.46 },
      },
      editPlan: {
        targetArea: 'the foreground chair back',
        preserveArea: 'the outer chair silhouette and the head-to-shirt contrast',
        issue: 'the interior chair bars pull too strongly relative to the face',
        intendedChange: 'soften the interior chair bars while preserving the silhouette',
        expectedOutcome: 'the face regains the first read',
        editability: 'yes',
      },
      studioChangeRecommendation:
        'Soften the interior bars of the foreground chair back so the seated face keeps priority.',
    },
  });
  assert.match(prompt, /Focus ONLY on: "Edge and focus control"/);
  assert.match(prompt, /Canonical edit brief for this selected criterion/);
  assert.match(prompt, /- Area to revise: the foreground chair back/);
  assert.match(prompt, /- Current issue in that passage: the interior chair bars pull too strongly relative to the face/);
  assert.match(prompt, /- Exact move to make: soften the interior chair bars while preserving the silhouette/);
  assert.match(prompt, /- Expected read after the move: the face regains the first read/);
  assert.match(
    prompt,
    /- Voice B line to honor if aligned: Soften the interior bars of the foreground chair back so the seated face keeps priority\./
  );
  assert.doesNotMatch(prompt, /What to address — specific change to implement on this canvas/);

  const unalignedPrompt = buildEditPrompt({
    imageDataUrl: 'data:image/png;base64,abc',
    style: 'Realism',
    medium: 'Oil on Canvas',
    target: {
      criterion: 'Color relationships',
      level: 'Advanced',
      phase1: {
        visualInventory:
          'At the lower-left floor-to-wall turn, the floor stays slightly warmer than the cooler wall while the rest of the room remains muted.',
      },
      phase2: {
        criticsAnalysis:
          'Muted drawing values remain disciplined in one family. The slight warmth of the floor against the cooler wall is enough to separate zones without forcing color.',
      },
      phase3: {
        teacherNextSteps:
          '1. Keep the current value-led palette discipline in the floor and wall.',
      },
      anchor: {
        areaSummary: 'the floor-to-wall transition at lower left',
        evidencePointer: 'the slight warmth shift separates the room planes without breaking the drawing medium',
        region: { x: 0.0, y: 0.55, width: 0.35, height: 0.33 },
      },
      editPlan: {
        targetArea: 'the floor-to-wall transition at lower left',
        preserveArea: 'the muted palette world across the room',
        issue: 'the current value-led separation is already convincing',
        intendedChange: 'preserve the present warmth shift rather than adding color',
        expectedOutcome: 'the room planes stay distinct without forcing hue',
        editability: 'no',
      },
      studioChangeRecommendation:
        'Ensure that the focus on the eyes and lips remains sharp to draw attention to the expression.',
    },
  });
  assert.match(
    unalignedPrompt,
    /Voice B line to honor if aligned: Keep the current value-led palette discipline in the floor and wall\./
  );
  assert.doesNotMatch(
    unalignedPrompt,
    /Ensure that the focus on the eyes and lips remains sharp to draw attention to the expression\./
  );
}

function testZodSchemaRoundTrip(): void {
  // Verify OpenAI schemas are well-formed
  assert.equal(VOICE_A_OPENAI_SCHEMA.strict, true);
  assert.equal(VOICE_A_OPENAI_SCHEMA.name, 'painting_critique_voice_a');
  assert.equal(VOICE_A_OPENAI_SCHEMA.schema.type, 'object');
  assert.ok(VOICE_A_OPENAI_SCHEMA.schema.additionalProperties === false);

  assert.equal(VOICE_B_OPENAI_SCHEMA.strict, true);
  assert.equal(VOICE_B_OPENAI_SCHEMA.name, 'painting_critique_voice_b');
  assert.equal(VOICE_B_OPENAI_SCHEMA.schema.type, 'object');
  assert.ok(VOICE_B_OPENAI_SCHEMA.schema.additionalProperties === false);

  assert.equal(EVIDENCE_OPENAI_SCHEMA.strict, true);
  assert.equal(EVIDENCE_OPENAI_SCHEMA.name, 'painting_critique_evidence');

  // Verify Voice B JSON schema has expectedRead, NOT intendedRead
  const voiceBProps = VOICE_B_OPENAI_SCHEMA.schema.properties as Record<string, unknown>;
  const catItems = (voiceBProps.categories as Record<string, unknown>).items as Record<string, unknown>;
  const catProps = catItems.properties as Record<string, unknown>;
  const planProps = (catProps.voiceBPlan as Record<string, unknown>).properties as Record<string, unknown>;
  assert.ok('expectedRead' in planProps, 'voiceBPlan must have expectedRead in JSON schema');
  assert.ok(!('intendedRead' in planProps), 'voiceBPlan must NOT have intendedRead in JSON schema');

  // Round-trip: mock Voice B plan through Zod parse
  const mockPlan = {
    currentRead: 'The passage currently reads flat.',
    mainProblem: 'The values compress too evenly.',
    mainStrength: 'The edge at the jaw is already clean.',
    bestNextMove: 'Darken the jacket side of the cheek-jacket junction.',
    optionalSecondMove: '',
    avoidDoing: 'Do not sharpen the ear contour.',
    expectedRead: 'The face separates from the jacket.',
    storyIfRelevant: '',
  };
  const planResult = voiceBPlanSchema.safeParse(mockPlan);
  assert.ok(planResult.success, `voiceBPlan round-trip failed: ${planResult.error?.message}`);
  assert.equal(planResult.data.expectedRead, 'The face separates from the jacket.');
  assert.equal(planResult.data.bestNextMove, 'Darken the jacket side of the cheek-jacket junction.');

  // Round-trip: mock Voice B step through Zod parse
  const mockStep = {
    area: 'the chair back crossing the seated figure',
    currentRead: 'interior bars compete with the face',
    move: 'soften the interior bars',
    expectedRead: 'the face regains priority',
    preserve: 'the outer silhouette',
    priority: 'primary' as const,
  };
  const stepResult = voiceBStepSchema.safeParse(mockStep);
  assert.ok(stepResult.success, `voiceBStep round-trip failed: ${stepResult.error?.message}`);

  // Round-trip: mock anchor through Zod parse
  const mockAnchor = {
    areaSummary: 'the chair back crossing the seated figure',
    evidencePointer: 'its interior verticals compete with the face',
    region: { x: 0.18, y: 0.22, width: 0.24, height: 0.46 },
  };
  const anchorResult = anchorSchema.safeParse(mockAnchor);
  assert.ok(anchorResult.success, `anchor round-trip failed: ${anchorResult.error?.message}`);

  // Round-trip: mock edit plan through Zod parse
  const mockEditPlan = {
    targetArea: 'the chair back crossing the seated figure',
    preserveArea: 'the outer chair silhouette',
    issue: 'the interior bars pull too strongly',
    intendedChange: 'soften the interior bars while preserving the silhouette',
    expectedOutcome: 'the face regains the first read',
    editability: 'yes' as const,
  };
  const editResult = editPlanSchema.safeParse(mockEditPlan);
  assert.ok(editResult.success, `editPlan round-trip failed: ${editResult.error?.message}`);

  // Negative test: intendedRead in voiceBPlan should fail
  const badPlan = { ...mockPlan, intendedRead: mockPlan.expectedRead };
  delete (badPlan as Record<string, unknown>).expectedRead;
  const badResult = voiceBPlanSchema.safeParse(badPlan);
  assert.ok(!badResult.success, 'voiceBPlan with intendedRead instead of expectedRead should fail');
}

function testVisionImagePayloadShape(): void {
  const msg = buildHighDetailImageMessage('data:image/jpeg;base64,abc123');
  assert.deepEqual(msg, {
    type: 'image_url',
    image_url: {
      url: 'data:image/jpeg;base64,abc123',
      detail: 'high',
    },
  });
}

async function main(): Promise<void> {
  await testCritiqueFlow();
  await testApiHelpers();
  testCriterionBandRubric();
  testEvidencePromptDemandsConcreteSurfaceAnchors();
  testSerializedPipelineErrorIncludesDebugMetadata();
  testValidationErrorDetailsAreHumanized();
  testRequestErrorCarriesDebugTrace();
  testDebugLogPayloadSanitization();
  testPreviewEditPromptAlignment();
  testZodSchemaRoundTrip();
  testVisionImagePayloadShape();
  await runPreviewResizeTests();
  console.log('Architecture tests passed.');
}

void main();
