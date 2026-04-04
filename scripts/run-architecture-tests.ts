import assert from 'node:assert/strict';

import {
  applyCritiqueGuardrails,
  critiqueNeedsFreshEvidenceRead,
  // eslint-disable-next-line import/named
} from '../lib/critiqueAudit.js';
import { evaluateCritiqueQuality } from '../lib/critiqueEval.ts';
import { buildEditPrompt } from '../lib/openaiPreviewEdit.ts';
import { splitNumberedSteps } from '../lib/numberedSteps.ts';
import { buildHighDetailImageMessage } from '../lib/openaiVisionContent.js';
import { buildEvidenceStagePrompt } from '../lib/critiqueEvidenceStage.js';
import { buildEvidenceRepairNote } from '../lib/openaiCritique.ts';
import { CritiqueRetryExhaustedError, serializeCritiquePipelineError } from '../lib/critiqueErrors.js';
import { migrateLegacySimpleFeedback, validateCritiqueResult } from '../lib/critiqueValidation.js';
import { buildWritingPrompt } from '../lib/critiqueWritingStage.ts';
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
import { finalizeCritiqueResult } from '../src/critiqueCoach.ts';
import { runPreviewResizeTests } from './test-preview-resize.js';
import { formatRubricForPrompt, getCriterionRubric } from '../shared/masterCriteriaRubric.js';
import {
  voiceAStageResultSchema,
  voiceBStageResultSchema,
  voiceBPlanSchema,
  voiceBStepSchema,
  anchorSchema,
  editPlanSchema,
  VOICE_A_OPENAI_SCHEMA,
  VOICE_B_OPENAI_SCHEMA,
  EVIDENCE_OPENAI_SCHEMA,
} from '../lib/critiqueZodSchemas.ts';
import { CRITERIA_ORDER } from '../shared/criteria.js';

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

function testCritiqueGuardrails(): void {
  const base = applyCritiqueGuardrails({
    summary:
      'The seated figure and left window strip hold the room together, but the foreground chair back still interrupts the first read.',
    simpleFeedback: {
      studioAnalysis: {
        whatWorks:
          'The bright left window strip and the seated figure already establish a clear interior structure.',
        whatCouldImprove:
          'The foreground chair back still competes too strongly with the face for first attention.',
      },
      studioChanges: [
        {
          text: 'Soften the interior bars of the foreground chair back so the seated face keeps priority.',
          previewCriterion: 'Edge and focus control',
        },
        {
          text: 'Keep the left window strip intact so the room preserves its current light scaffold.',
          previewCriterion: 'Value and light structure',
        },
      ],
    },
    categories: [
      {
        criterion: 'Composition and shape structure',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'In the foreground chair back, dark vertical bars cross the seated figure near the center-left of the rectangle. A bright window strip runs down the far left edge, and the figure\'s shirt forms a second light shape against the darker wall. The chair, shirt, and window make three distinct vertical bands.',
        },
        phase2: {
          criticsAnalysis:
            'In the foreground chair back, the dark vertical bars interrupt the route to the seated figure. The window strip at left and the bright shirt already create a strong scaffold. The issue is not the whole arrangement but that this one passage pulls too loudly.',
        },
        phase3: {
          teacherNextSteps:
            '1. In the foreground chair back, soften the interior bars while keeping the outer silhouette intact. 2. Leave the bright window strip alone so the room keeps its current lateral pull.',
        },
        confidence: 'high',
        evidenceSignals: ['The chair back crosses the figure in the foreground.', 'The left window strip is the clearest light shape.'],
        preserve: 'Keep the window strip and the shirt-to-wall contrast.',
        nextTarget: 'Push composition and shape structure toward Master.',
        anchor: {
          areaSummary: 'the foreground chair back',
          evidencePointer: 'its dark vertical bars compete with the seated figure for first attention',
          region: { x: 0.18, y: 0.22, width: 0.24, height: 0.46 },
        },
        editPlan: {
          targetArea: 'the foreground chair back',
          preserveArea: 'the bright window strip and the shirt-to-wall contrast',
          issue: 'its dark interior bars pull as strongly as the face',
          intendedChange: 'soften the interior chair bars while preserving the outer silhouette',
          expectedOutcome: 'the figure regains priority without changing the room structure',
          editability: 'yes',
        },
        subskills: [
          { label: 'Focal hierarchy', score: 0.72, level: 'Advanced' },
          { label: 'Eye path control', score: 0.69, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Value and light structure',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The clearest light mass sits in the left window strip, which runs from the upper-left corner down most of the canvas height. The shirt on the seated figure lands one step darker than that strip and brighter than the wall behind the head. The surrounding wall stays in a compressed dark family around the figure.',
        },
        phase2: {
          criticsAnalysis:
            'The left window strip and the shirt already establish a clear light pattern. Around the seated head, the surrounding dark wall compresses value effectively. This axis is reading strongly overall.',
        },
        phase3: {
          teacherNextSteps:
            '1. Keep the left window strip and its window-to-shirt value pattern; it is already doing the structural work.',
        },
        confidence: 'medium',
        evidenceSignals: ['The window strip is the clearest light shape.', 'The shirt sits against a darker wall.'],
        preserve: 'Preserve the main light-dark grouping across window, shirt, and wall.',
        nextTarget: 'Push value and light structure toward Master.',
        anchor: {
          areaSummary: 'the left window strip',
          evidencePointer: 'it establishes the painting\'s clearest light mass',
          region: { x: 0.0, y: 0.0, width: 0.16, height: 0.78 },
        },
        editPlan: {
          targetArea: 'the left window strip',
          preserveArea: 'the shirt-to-wall relationship around the figure',
          issue: 'the main light scaffold already reads clearly',
          intendedChange: 'preserve the existing light mass and avoid unnecessary revision',
          expectedOutcome: 'the value structure stays intact',
          editability: 'no',
        },
        subskills: [
          { label: 'Light-dark grouping', score: 0.74, level: 'Advanced' },
          { label: 'Range control', score: 0.7, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Color relationships',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'At the lower-left floor-to-wall turn, the floor reads slightly warmer than the cooler wall. Most of the room stays inside a muted drawing palette without high-chroma accents. The warm floor band, cooler wall, and neutral shirt create a restrained temperature sequence.',
        },
        phase2: {
          criticsAnalysis:
            'Muted drawing values remain disciplined in one family. The slight warmth of the floor against the cooler wall is enough to separate zones without forcing color. That restraint is working.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current value-led palette discipline in the floor and wall.',
        },
        confidence: 'medium',
        evidenceSignals: ['The floor reads slightly warmer than the wall.', 'Most passages stay within a muted drawing palette.'],
        preserve: 'Keep the restrained palette world.',
        nextTarget: 'Push color relationships toward Master.',
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
        subskills: [
          { label: 'Palette harmony', score: 0.68, level: 'Advanced' },
          { label: 'Temperature control', score: 0.66, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The seated figure tilts back in the middle-right area, and the side table legs angle onto the floor plane below. Chair bars cross the torso from the foreground without breaking the larger body placement. The table and figure occupy a shared room space with readable overlap and angle shifts.',
        },
        phase2: {
          criticsAnalysis:
            'The seated figure\'s tilt and the table legs hold together believably. The chair bars crossing the body are intentionally awkward but still spatially coherent. This criterion is strong.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current spatial drawing in the seated figure and table legs.',
        },
        confidence: 'medium',
        evidenceSignals: ['The seated figure tilts back convincingly.', 'The table legs sit on the floor plane with readable angle shifts.'],
        preserve: 'Preserve the figure tilt and the table-leg spacing.',
        nextTarget: 'Push drawing, proportion, and spatial form toward Master.',
        anchor: {
          areaSummary: 'the seated figure and side table',
          evidencePointer: 'their tilt and spacing establish a believable room structure',
          region: { x: 0.36, y: 0.16, width: 0.47, height: 0.55 },
        },
        editPlan: {
          targetArea: 'the seated figure and side table',
          preserveArea: 'the current figure tilt and table-leg spacing',
          issue: 'the spatial drawing already reads convincingly',
          intendedChange: 'preserve the present drawing relationships',
          expectedOutcome: 'the room structure remains coherent',
          editability: 'no',
        },
        subskills: [
          { label: 'Shape placement', score: 0.73, level: 'Advanced' },
          { label: 'Spatial construction', score: 0.71, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        phase1: {
          visualInventory:
            'Inside the foreground chair back, the interior verticals are nearly as crisp and dark as the face passage behind them. The seated head and shirt sit slightly right of center and are meant to win the first read. The outer silhouette of the chair stays clearer than some of its interior bars.',
        },
        phase2: {
          criticsAnalysis:
            'In the foreground chair back, the interior verticals stay almost as insistent as the face. The seated head and shirt should win the first read, but the chair interrupts that hierarchy. The problem is specific and local rather than global.',
        },
        phase3: {
          teacherNextSteps:
            '1. In the foreground chair back, soften the interior verticals so they stop competing with the face. 2. Keep the outer chair silhouette crisp enough to retain the obstruction. 3. Leave the head-and-shirt edge contrast intact so the figure keeps priority.',
        },
        confidence: 'high',
        evidenceSignals: ['The chair bars cross in front of the figure.', 'The head and shirt are the intended focal passage.'],
        preserve: 'Preserve the outer chair silhouette and the head-to-shirt contrast.',
        nextTarget: 'Push edge and focus control toward Advanced.',
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
        subskills: [
          { label: 'Edge hierarchy', score: 0.51, level: 'Intermediate' },
          { label: 'Focus placement', score: 0.55, level: 'Intermediate' },
        ],
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The wall is built with broad even hatching, while the floor uses a different directional stroke family below it. The chair back shows tighter linear marks than the wall field. The figure\'s shirt is laid in more smoothly than the surrounding hatched room.',
        },
        phase2: {
          criticsAnalysis:
            'The drawing strokes stay economical and directional. The chair, wall, and floor all use distinct mark families without fuss. The surface handling is already disciplined.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current mark economy in the wall, floor, and chair.',
        },
        confidence: 'medium',
        evidenceSignals: ['The wall is built with broad, even hatching.', 'The floor uses directional strokes distinct from the wall.'],
        preserve: 'Preserve the distinct mark families between wall and floor.',
        nextTarget: 'Push surface and medium handling toward Master.',
        anchor: {
          areaSummary: 'the wall and floor hatching',
          evidencePointer: 'their distinct mark families keep the room organized without overworking the drawing',
          region: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
        },
        editPlan: {
          targetArea: 'the wall and floor hatching',
          preserveArea: 'the directional differences between wall and floor marks',
          issue: 'the surface handling already supports the room clearly',
          intendedChange: 'preserve the current mark economy',
          expectedOutcome: 'the drawing keeps its controlled surface rhythm',
          editability: 'no',
        },
        subskills: [
          { label: 'Mark economy', score: 0.72, level: 'Advanced' },
          { label: 'Surface character', score: 0.69, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The chair obstruction cuts in front of the seated figure through the center-left and center of the composition. The room remains quiet and compressed from the dark wall to the table and chair. The blocked figure, side table, and left window all belong to one interior setup rather than separate incidents.',
        },
        phase2: {
          criticsAnalysis:
            'The figure, chair obstruction, and side table all belong to one observed interior problem. The awkwardness feels chosen rather than accidental. Most decisions answer to the same quiet, compressed world.',
        },
        phase3: {
          teacherNextSteps:
            '1. Keep the present tension between the chair obstruction and the seated figure; it belongs to the painting\'s logic.',
        },
        confidence: 'medium',
        evidenceSignals: ['The chair obstruction and figure belong to the same pictorial problem.', 'The room stays quiet and compressed throughout.'],
        preserve: 'Preserve the quiet compression of the room and the obstructed figure setup.',
        nextTarget: 'Push intent and necessity toward Master.',
        anchor: {
          areaSummary: 'the blocked view of the seated figure through the chair',
          evidencePointer: 'the obstruction feels intentional and belongs to the picture\'s quiet interior logic',
          region: { x: 0.18, y: 0.2, width: 0.5, height: 0.5 },
        },
        editPlan: {
          targetArea: 'the blocked view of the seated figure through the chair',
          preserveArea: 'the quiet compression of the room',
          issue: 'the obstruction already feels necessary to the image logic',
          intendedChange: 'preserve the current obstruction logic',
          expectedOutcome: 'the picture keeps its necessary internal tension',
          editability: 'no',
        },
        subskills: [
          { label: 'Coherence of aim', score: 0.72, level: 'Advanced' },
          { label: 'Support from formal choices', score: 0.7, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The seated figure\'s head and upper torso tilt inward just right of center, partly screened by the chair back in front. The viewpoint sits behind the chair rather than directly in front of the figure. The gaze aims down toward the table instead of outward to the viewer.',
        },
        phase2: {
          criticsAnalysis:
            'The seated figure has a quiet inwardness, and the room feels inhabited rather than staged. The specific viewpoint from behind the chair contributes to that pressure. The painting has real presence.',
        },
        phase3: {
          teacherNextSteps:
            '1. Keep the current inward pressure around the seated figure and the obstructed viewpoint.',
        },
        confidence: 'medium',
        evidenceSignals: ['The seated figure reads as inward and absorbed.', 'The viewpoint from behind the chair feels deliberate.'],
        preserve: 'Preserve the figure\'s inwardness and the obstructed viewpoint.',
        nextTarget: 'Push presence, point of view, and human force toward Master.',
        anchor: {
          areaSummary: 'the seated figure\'s head and upper torso',
          evidencePointer: 'their inward tilt carries the painting\'s quiet human pressure',
          region: { x: 0.46, y: 0.12, width: 0.22, height: 0.3 },
        },
        editPlan: {
          targetArea: 'the seated figure\'s head and upper torso',
          preserveArea: 'the inward tilt and obstructed viewpoint',
          issue: 'the human pressure is already convincing',
          intendedChange: 'preserve the current inward pressure',
          expectedOutcome: 'the picture keeps its authored presence',
          editability: 'no',
        },
        subskills: [
          { label: 'Atmospheric force', score: 0.71, level: 'Advanced' },
          { label: 'Point of view', score: 0.73, level: 'Advanced' },
        ],
      },
    ],
    overallSummary: {
      analysis: 'Using the Drawing lens, the seated figure, foreground chair back, and bright left window already form a persuasive interior structure. The main remaining issue is local: the interior chair bars compete with the face more than they should.',
      topPriorities: ['Soften the interior bars of the foreground chair back so the face keeps priority.'],
    },
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
    suggestedPaintingTitles: [
      { category: 'formalist', title: 'Interior with Seated Figure and Foreground Chair', rationale: 'Composition reads at Advanced with the chair-figure obstruction as the dominant structural element.' },
      { category: 'tactile', title: 'Study in Window Light and Compressed Wall Tone', rationale: 'Surface handling reads at Advanced in drawing with economical hatching mark families.' },
      { category: 'intent', title: 'Chair Back and Face: Drawing After Vermeer', rationale: 'Intent reads at Advanced with the obstruction feeling necessary to the quiet interior logic.' },
    ],
  });

  assert.equal(critiqueNeedsFreshEvidenceRead(base), false);
  assert.equal(applyCritiqueGuardrails(base), base);

  const vagueCategory = {
    ...base,
    categories: base.categories.map((category) =>
      category.criterion === 'Edge and focus control'
        ? {
            ...category,
            phase2: {
              criticsAnalysis: 'The focus could be stronger in places.',
            },
            phase3: {
              teacherNextSteps: '1. Improve the focus where needed.',
            },
          }
        : category
    ),
  };

  assert.equal(critiqueNeedsFreshEvidenceRead(vagueCategory), true);

  const vagueSummary = {
    ...base,
    summary: 'A strong painting with one area to improve.',
  };
  assert.equal(critiqueNeedsFreshEvidenceRead(vagueSummary), true);

  const vagueOverallAnalysis = {
    ...base,
    overallSummary: {
      ...base.overallSummary!,
      analysis: 'Using the Drawing lens, the painting shows clear strengths and a few modest issues.',
    },
  };
  assert.equal(critiqueNeedsFreshEvidenceRead(vagueOverallAnalysis), true);

  const vagueTopPriority = {
    ...base,
    overallSummary: {
      ...base.overallSummary!,
      topPriorities: ['Improve the main focal area.'],
    },
  };
  assert.equal(critiqueNeedsFreshEvidenceRead(vagueTopPriority), true);

  const vagueStudioAnalysis = {
    ...base,
    simpleFeedback: {
      ...base.simpleFeedback!,
      studioAnalysis: {
        whatWorks: 'Several passages are already working well together.',
        whatCouldImprove: 'One area still needs clearer development.',
      },
      studioChanges: base.simpleFeedback!.studioChanges,
    },
  };
  assert.equal(critiqueNeedsFreshEvidenceRead(vagueStudioAnalysis), true);

  const vagueVoiceB = {
    ...base,
    simpleFeedback: {
      ...base.simpleFeedback!,
      studioChanges: [
        {
          text: 'Define certain edges more clearly to enhance the focus hierarchy.',
          previewCriterion: 'Edge and focus control',
        },
        {
          text: 'Smooth out abrupt color transitions to enhance the realism of the painting.',
          previewCriterion: 'Color relationships',
        },
      ],
    },
  };
  assert.equal(evaluateCritiqueQuality(vagueVoiceB).genericNextSteps, true);

  const specificVoiceB = {
    ...base,
    simpleFeedback: {
      ...base.simpleFeedback!,
      studioChanges: [
        {
          text: 'Maintain the contrast between the blue headscarf and warm skin tones to keep the focus on the subject.',
          previewCriterion: 'Color relationships',
        },
        {
          text: 'Ensure that the focus on the eyes and lips remains sharp to draw attention to the expression.',
          previewCriterion: 'Edge and focus control',
        },
      ],
    },
  };
  assert.equal(evaluateCritiqueQuality(specificVoiceB).genericNextSteps, false);

  const rewrittenVoiceB = applyCritiqueGuardrails(vagueVoiceB as any);
  assert.match(
    rewrittenVoiceB.categories.find((category) => category.criterion === 'Edge and focus control')!.phase3
      .teacherNextSteps,
    /foreground chair back|interior chair bars|face/i
  );
  assert.match(
    rewrittenVoiceB.categories.find((category) => category.criterion === 'Edge and focus control')!.phase3
      .teacherNextSteps,
    /soften|sharpen|preserve|keep|separate/i
  );
  assert.match(
    rewrittenVoiceB.simpleFeedback!.studioChanges[0]!.text,
    /foreground chair back|interior chair bars|face/i
  );
  assert.match(rewrittenVoiceB.simpleFeedback!.studioChanges[0]!.text, /soften|sharpen|preserve|keep|separate/i);

  const inlineNumbered = {
    ...base,
    categories: base.categories.map((category) =>
      category.criterion === 'Composition and shape structure'
        ? {
            ...category,
            phase3: {
              teacherNextSteps:
                '1. Preserve the circular arrangement of figures around the table, as it effectively guides the viewer’s eye. 2. Slightly adjust the spacing between figures to reduce visual competition and enhance clarity. 3. Ensure that the integration of background and foreground continues to support the depth of the composition.',
            },
          }
        : category
    ),
  };
  const normalizedInline = applyCritiqueGuardrails(inlineNumbered as any);
  assert.ok(splitNumberedSteps(normalizedInline.categories[1]!.phase3.teacherNextSteps).length >= 1);
  assert.doesNotMatch(
    normalizedInline.categories[1]!.phase3.teacherNextSteps,
    /1\..*2\..*3\..*\n2\./s
  );

  const weakStructuredVoiceB = {
    ...base,
    categories: base.categories.map((category) =>
      category.criterion === 'Color relationships'
        ? {
            ...category,
            anchor: {
              areaSummary: 'background color transitions',
              evidencePointer: 'some color transitions in the background are abrupt',
              region: { x: 0.4, y: 0.1, width: 0.45, height: 0.4 },
            },
            editPlan: {
              targetArea: 'background color transitions',
              preserveArea: 'the lively atmosphere',
              issue: 'some color transitions could be more gradual',
              intendedChange: 'soften abrupt color transitions in the background',
              expectedOutcome: 'the visual flow is more cohesive',
              editability: 'yes',
            },
            phase3: {
              teacherNextSteps:
                '1. Smooth transitions between colors in the background to enhance harmony. 2. Keep the lively atmosphere intact.',
            },
          }
        : category
    ),
    simpleFeedback: {
      ...base.simpleFeedback!,
      studioChanges: [
        {
          text: 'Smooth out abrupt color transitions to enhance the realism of the painting.',
          previewCriterion: 'Color relationships',
        },
      ],
    },
  };
  const guardedWeakStructured = applyCritiqueGuardrails(weakStructuredVoiceB as any);
  const guardedColorCategory = guardedWeakStructured.categories.find(
    (category) => category.criterion === 'Color relationships'
  );
  assert.ok(guardedColorCategory);
  assert.match(
    guardedColorCategory!.phase3.teacherNextSteps,
    /Smooth transitions between colors in the background to enhance harmony|Keep the lively atmosphere intact/
  );
  assert.doesNotMatch(
    guardedColorCategory!.phase3.teacherNextSteps,
    /so the visual flow is more cohesive, enhancing the painting's mood|the depth is enhanced with smoother transitions|one specific, local adjustment that this criterion can actually see/i
  );
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

function testWritingPromptDemandsConcreteAnchors(): void {
  const prompt = buildWritingPrompt(
    'Realism',
    'Oil on Canvas',
    {
      intentHypothesis: 'A quiet interior focused on obstruction and looking.',
      strongestVisibleQualities: ['The left window strip establishes a clear light mass.', 'The chair obstruction creates a strong foreground screen.'],
      mainTensions: ['The chair bars compete with the face.', 'Some room transitions stay compressed.'],
      completionRead: {
        state: 'likely_finished',
        confidence: 'high',
        cues: ['resolved edges', 'consistent finish'],
        rationale: 'Most passages read presentation-ready rather than blocked in.',
      },
      photoQualityRead: {
        level: 'good',
        summary: 'Good photo.',
        issues: [],
      },
      comparisonObservations: [],
      criterionEvidence: [
        {
          criterion: 'Intent and necessity',
          visibleEvidence: [
            'The chair obstruction and figure belong to one interior problem.',
            'The room stays quiet and compressed.',
            'The left window strip against the dim wall reads as the clearest light anchor.',
            'The seated figure’s posture tilts away from the viewer toward the table.',
          ],
          strengthRead: 'The obstruction feels intentional.',
          tensionRead: 'A few accents compete with the central inwardness.',
          preserve: 'Keep the obstruction logic.',
          confidence: 'high',
        },
        {
          criterion: 'Composition and shape structure',
          visibleEvidence: [
            'The chair back crosses the figure in the foreground.',
            'The left window strip is the clearest light shape.',
            'The table edge in the lower third brackets the seated figure’s space.',
            'The dark wall behind the head compresses the figure into a vertical band.',
          ],
          strengthRead: 'The room has a strong scaffold.',
          tensionRead: 'The chair bars interrupt the route to the figure.',
          preserve: 'Keep the window strip and shirt contrast.',
          confidence: 'high',
        },
        {
          criterion: 'Value and light structure',
          visibleEvidence: [
            'The left window strip is the clearest light shape.',
            'The shirt sits against a darker wall.',
            'The floor plane reads a step darker than the shirt but lighter than the rear wall.',
            'The chair interior bars hold a mid-dark value close to the shadowed wall.',
          ],
          strengthRead: 'The main light-dark grouping is readable.',
          tensionRead: 'Some compression remains in secondary passages.',
          preserve: 'Keep the main window-to-shirt grouping.',
          confidence: 'high',
        },
        {
          criterion: 'Color relationships',
          visibleEvidence: [
            'The floor reads slightly warmer than the wall.',
            'Most passages stay within a muted palette.',
            'The window’s cool light contrasts with the warm wood floor strip.',
            'The shirt’s neutral sits between the cooler window and warmer floor.',
          ],
          strengthRead: 'The palette holds together.',
          tensionRead: 'The floor/wall turn could separate a little more cleanly.',
          preserve: 'Keep the muted palette world.',
          confidence: 'medium',
        },
        {
          criterion: 'Drawing, proportion, and spatial form',
          visibleEvidence: [
            'The seated figure tilts back convincingly.',
            'The table legs sit on the floor plane.',
            'The chair legs align with the floor perspective toward the back corner.',
            'The tabletop’s near edge parallels the picture plane while the far edge tucks under.',
          ],
          strengthRead: 'The room drawing is persuasive.',
          tensionRead: 'The obstruction complicates some local reads.',
          preserve: 'Keep the figure tilt and table-leg spacing.',
          confidence: 'medium',
        },
        {
          criterion: 'Edge and focus control',
          visibleEvidence: [
            'The chair bars cross in front of the figure.',
            'The head and shirt are the intended focal passage.',
            'The outer chair silhouette stays sharper than the interior slats.',
            'The window mullions stay crisp against the bright pane.',
          ],
          strengthRead: 'The focal passage is evident.',
          tensionRead: 'The interior bars still compete with the face.',
          preserve: 'Keep the outer chair silhouette and head-to-shirt contrast.',
          confidence: 'high',
        },
        {
          criterion: 'Surface and medium handling',
          visibleEvidence: [
            'The wall is built with broad, even hatching.',
            'The floor uses directional strokes distinct from the wall.',
            'The chair back shows tighter linear marks than the wall field.',
            'The figure’s shirt uses smoother value laying than the hatched wall.',
          ],
          strengthRead: 'The mark economy is disciplined.',
          tensionRead: 'Some transitions could be integrated more subtly.',
          preserve: 'Keep the wall-floor mark-family distinction.',
          confidence: 'medium',
        },
        {
          criterion: 'Presence, point of view, and human force',
          visibleEvidence: [
            'The seated figure reads as inward and absorbed.',
            'The viewpoint from behind the chair feels deliberate.',
            'The figure’s gaze aims down toward the table, not at the viewer.',
            'The chair’s bulk frames the figure like a partial screen.',
          ],
          strengthRead: 'The room has real inward pressure.',
          tensionRead: 'A few local accents interrupt that quiet pressure.',
          preserve: 'Keep the inwardness and obstructed viewpoint.',
          confidence: 'medium',
        },
      ],
    },
    undefined
  );
  assert.match(
    prompt,
    /Bad: "left side of the painting", "color transitions in clothing and background", "circular arrangement of figures around the table"\./
  );
  assert.match(prompt, /Better: "the leftmost seated woman’s face against the dark hedge"/);
  assert.match(prompt, /Bad: "needs more depth", "some shadow areas could be more defined", "improve realism"\./);
  assert.match(
    prompt,
    /Better: "the shadow behind the left cheek merges too evenly into the jacket so the head loses separation"\./
  );
  assert.match(prompt, /Voice B planning structure \(required for all eight categories\):/);
  assert.match(prompt, /categories\[\]\.voiceBPlan is Voice B's teacher note to self/);
  assert.match(prompt, /categories\[\]\.actionPlanSteps must contain exactly 1 high-leverage step/);
  assert.match(
    prompt,
    /Make categories\[\]\.phase3\.teacherNextSteps one polished paragraph derived from categories\[\]\.actionPlanSteps/
  );
  assert.match(prompt, /one paragraph and one primary move only/);
}

function testEvidencePromptDemandsConcreteSurfaceAnchors(): void {
  const prompt = buildEvidenceStagePrompt('Realism', 'Oil on Canvas');
  assert.match(
    prompt,
    /Anchor-to-evidence alignment rule: for EACH criterion, at least one visibleEvidence line must explicitly reuse the same concrete nouns from the anchor/
  );
  assert.match(
    prompt,
    /\*\*Surface and medium handling:\*\* Name \*\*actual\*\* mark behavior .* The anchor must STILL name one locatable mark-bearing passage or boundary in the painting, not a medium label\./
  );
  assert.match(
    prompt,
    /Bad anchors: "brushwork", "paint handling", "surface quality", "the paint surface"\./
  );
  assert.match(
    prompt,
    /Better anchors: "the wall hatching where it meets the smoother shirt passage", "the dry scumble across the cheek turning into the green shadow under the eye", "the loaded highlight stroke on the vase rim against the dark table\."/
  );
  assert.match(
    prompt,
    /visibleEvidence must support the anchor directly: at least one line must name that same passage again with the same concrete nouns/
  );
}

function testEvidenceRepairNoteDemandsAnchorSupport(): void {
  const repair = buildEvidenceRepairNote(
    new Error('Visible evidence does not support anchor for Composition and shape structure')
  );
  assert.match(
    repair,
    /Critical anchor-support fix for Composition and shape structure:/
  );
  assert.match(
    repair,
    /at least one visibleEvidence line MUST repeat the same concrete nouns from the anchor/
  );
  assert.match(
    repair,
    /If the anchor names a grouping, overlap, scaffold, gap, band, or junction, one visibleEvidence line must name that same grouping, overlap, scaffold, gap, band, or junction again/
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

function testStructuredVoiceBPlanFlow(): void {
  const raw = {
    summary: 'A focused interior with one competing obstruction.',
    overallSummary: {
      analysis:
        'Using the Drawing lens, the foreground chair back and seated figure establish a clear interior tension.',
      topPriorities: ['Soften the interior bars of the foreground chair back so the face keeps priority.'],
    },
    studioAnalysis: {
      whatWorks: 'The left window strip and seated figure already give the room a persuasive scaffold.',
      whatCouldImprove: 'The foreground chair back still competes with the face.',
    },
    studioChanges: [
      {
        text: 'Soften the interior bars of the foreground chair back so the seated face keeps priority.',
        previewCriterion: 'Edge and focus control',
      },
      {
        text: 'Keep the left window strip intact so the room preserves its current light scaffold.',
        previewCriterion: 'Value and light structure',
      },
    ],
    comparisonNote: null,
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    suggestedPaintingTitles: [
      { category: 'formalist', title: 'Interior with Chair Back', rationale: 'Composition at Advanced with the chair-figure scaffold.' },
      { category: 'tactile', title: 'Window Light Study', rationale: 'Surface handling at Advanced with economical hatching.' },
      { category: 'intent', title: 'Figure Behind the Chair', rationale: 'Intent at Advanced with deliberate obstruction.' },
    ],
    categories: [
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The blocked figure sits behind the chair in the middle of the room, with the chair structure cutting through the central view. The room stays compressed from the left window strip to the darker rear wall. The figure, obstruction, and table read as one setup rather than scattered parts.',
        },
        phase2: {
          criticsAnalysis: 'The obstruction and figure belong to one coherent interior problem.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the present tension between the chair obstruction and the seated figure.',
        },
        actionPlanSteps: [
          {
            area: 'the blocked view of the seated figure through the chair',
            currentRead: 'the obstruction already feels necessary to the image logic',
            move: 'keep the obstruction logic intact while simplifying any competing secondary accent',
            expectedRead: 'the picture keeps its necessary internal tension',
            preserve: 'the quiet compression of the room',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The obstruction already contributes to the picture logic.',
          mainStrength: 'The quiet compression of the room already belongs to the image.',
          bestNextMove: 'Preserve the obstruction logic while removing one competing accent.',
          expectedRead: 'The picture keeps its internal tension without added noise.',
        },
        confidence: 'medium',
        evidenceSignals: ['The chair obstruction and figure belong to the same pictorial problem.'],
        preserve: 'Preserve the quiet compression of the room.',
        nextTarget: 'Push intent and necessity toward Master.',
        anchor: {
          areaSummary: 'the blocked view of the seated figure through the chair',
          evidencePointer: 'the obstruction feels intentional and belongs to the picture’s quiet interior logic',
          region: { x: 0.18, y: 0.2, width: 0.5, height: 0.5 },
        },
        editPlan: {
          targetArea: 'the blocked view of the seated figure through the chair',
          preserveArea: 'the quiet compression of the room',
          issue: 'the obstruction already feels necessary to the image logic',
          intendedChange: 'preserve the current obstruction logic',
          expectedOutcome: 'the picture keeps its necessary internal tension',
          editability: 'no',
        },
        subskills: [
          { label: 'Coherence of aim', score: 0.72, level: 'Advanced' },
          { label: 'Support from formal choices', score: 0.7, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Composition and shape structure',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The chair back occupies the center-left and crosses the seated figure behind it. A bright vertical window strip sits along the left edge, while the seated figure and shirt hold the center-right. These three vertical passages establish the room scaffold.',
        },
        phase2: {
          criticsAnalysis: 'The chair back and seated figure already give the room a strong scaffold.',
        },
        phase3: {
          teacherNextSteps: '',
        },
        actionPlanSteps: [
          {
            area: 'the chair back crossing the seated figure',
            currentRead: 'the dark interior bars interrupt the route to the seated figure',
            move: 'soften the interior chair bars while keeping the outer silhouette intact',
            expectedRead: 'the figure regains priority without changing the room structure',
            preserve: 'the bright window strip and the shirt-to-wall contrast',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The room scaffold is strong, but one foreground passage pulls too hard.',
          mainProblem: 'The chair bars interrupt the route to the figure.',
          mainStrength: 'The left window strip and shirt contrast already anchor the room.',
          bestNextMove: 'Soften the interior chair bars while keeping the silhouette intact.',
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: 'The figure regains priority without losing the obstruction logic.',
          storyIfRelevant: '',
        },
        confidence: 'high',
        evidenceSignals: ['The chair back crosses the figure in the foreground.', 'The left window strip is the clearest light shape.'],
        preserve: 'Keep the window strip and the shirt-to-wall contrast.',
        nextTarget: 'Push composition and shape structure toward Master.',
        anchor: {
          areaSummary: 'the chair back crossing the seated figure',
          evidencePointer: 'its dark vertical bars compete with the seated figure for first attention',
          region: { x: 0.18, y: 0.22, width: 0.24, height: 0.46 },
        },
        editPlan: {
          targetArea: 'the chair back crossing the seated figure',
          preserveArea: 'the bright window strip and the shirt-to-wall contrast',
          issue: 'its dark interior bars pull as strongly as the face',
          intendedChange: 'soften the interior chair bars while preserving the outer silhouette',
          expectedOutcome: 'the figure regains priority without changing the room structure',
          editability: 'yes',
        },
        subskills: [
          { label: 'Focal hierarchy', score: 0.72, level: 'Advanced' },
          { label: 'Eye path control', score: 0.69, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Value and light structure',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The left window strip is the lightest vertical passage in the picture. The shirt sits just below that brightness and against a darker wall around the seated figure. The wall behind the head and the chair bars share a compressed darker range.',
        },
        phase2: {
          criticsAnalysis: 'The left window strip and shirt already establish a clear light pattern.',
        },
        phase3: {
          teacherNextSteps:
            '1. Keep the left window strip and its window-to-shirt value pattern; it is already doing the structural work.',
        },
        actionPlanSteps: [
          {
            area: 'the left window strip',
            currentRead: 'the current window-to-shirt value pattern is already doing the structural work',
            move: 'keep the left window strip and its window-to-shirt value pattern intact',
            expectedRead: 'the room keeps its main light scaffold',
            preserve: 'the shirt-to-wall relationship around the figure',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The main light scaffold is already convincing.',
          mainProblem: '',
          mainStrength: 'The left window strip and shirt establish the room light clearly.',
          bestNextMove: 'Protect the existing window-to-shirt value pattern.',
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: 'The value structure stays intact and legible.',
          storyIfRelevant: '',
        },
        confidence: 'medium',
        evidenceSignals: ['The window strip is the clearest light shape.'],
        preserve: 'Preserve the main light-dark grouping across window, shirt, and wall.',
        nextTarget: 'Push value and light structure toward Master.',
        anchor: {
          areaSummary: 'the left window strip',
          evidencePointer: 'it establishes the painting’s clearest light mass',
          region: { x: 0, y: 0, width: 0.16, height: 0.78 },
        },
        editPlan: {
          targetArea: 'the left window strip',
          preserveArea: 'the shirt-to-wall relationship around the figure',
          issue: 'the main light scaffold already reads clearly',
          intendedChange: 'preserve the existing light mass and avoid unnecessary revision',
          expectedOutcome: 'the value structure stays intact',
          editability: 'no',
        },
        subskills: [
          { label: 'Light-dark grouping', score: 0.74, level: 'Advanced' },
          { label: 'Range control', score: 0.7, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Color relationships',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'At the lower-left transition, the floor carries a slight warmth against the cooler wall. The rest of the room remains in a muted palette with small temperature shifts rather than saturated hue jumps. The neutral shirt sits between the cooler window light and warmer floor note.',
        },
        phase2: {
          criticsAnalysis: 'The floor-to-wall warmth shift is enough to separate zones without forcing color.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current value-led palette discipline in the floor and wall.',
        },
        actionPlanSteps: [
          {
            area: 'the floor-to-wall transition at lower left',
            currentRead: 'the slight warmth shift already separates the room planes',
            move: 'preserve the present warmth shift rather than adding more color',
            expectedRead: 'the room planes stay distinct without forcing hue',
            preserve: 'the muted palette world across the room',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The palette separation is already doing enough work in this passage.',
          mainProblem: '',
          mainStrength: 'The slight floor-to-wall warmth shift keeps the room planes distinct.',
          bestNextMove: 'Preserve the present warmth shift rather than adding color.',
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: 'The room stays harmonious and the planes remain separated.',
          storyIfRelevant: '',
        },
        confidence: 'medium',
        evidenceSignals: ['The floor reads slightly warmer than the wall.'],
        preserve: 'Keep the restrained palette world.',
        nextTarget: 'Push color relationships toward Master.',
        anchor: {
          areaSummary: 'the floor-to-wall transition at lower left',
          evidencePointer: 'the slight warmth shift separates the room planes without breaking the drawing medium',
          region: { x: 0, y: 0.55, width: 0.35, height: 0.33 },
        },
        editPlan: {
          targetArea: 'the floor-to-wall transition at lower left',
          preserveArea: 'the muted palette world across the room',
          issue: 'the current value-led separation is already convincing',
          intendedChange: 'preserve the present warmth shift rather than adding color',
          expectedOutcome: 'the room planes stay distinct without forcing hue',
          editability: 'no',
        },
        subskills: [
          { label: 'Palette harmony', score: 0.68, level: 'Advanced' },
          { label: 'Temperature control', score: 0.66, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The seated figure leans back in the mid-right area, and the side table holds its angle on the floor plane below. Chair elements overlap the body in front without collapsing the main figure placement. The room furniture and figure share a coherent spatial setup.',
        },
        phase2: {
          criticsAnalysis: 'The seated figure’s tilt and the table legs hold together believably.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current spatial drawing in the seated figure and table legs.',
        },
        actionPlanSteps: [
          {
            area: 'the seated figure and side table',
            currentRead: 'the figure tilt and table spacing already establish a believable room structure',
            move: 'preserve the present drawing relationships there',
            expectedRead: 'the room structure remains coherent',
            preserve: 'the current figure tilt and table-leg spacing',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The spatial drawing is already persuasive in the main figure-and-table passage.',
          mainProblem: '',
          mainStrength: 'The tilt and spacing hold together believably.',
          bestNextMove: 'Keep the current spatial drawing in the seated figure and table legs.',
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: 'The room structure remains coherent and convincing.',
          storyIfRelevant: '',
        },
        confidence: 'medium',
        evidenceSignals: ['The seated figure tilts back convincingly.'],
        preserve: 'Preserve the figure tilt and the table-leg spacing.',
        nextTarget: 'Push drawing, proportion, and spatial form toward Master.',
        anchor: {
          areaSummary: 'the seated figure and side table',
          evidencePointer: 'their tilt and spacing establish a believable room structure',
          region: { x: 0.36, y: 0.16, width: 0.47, height: 0.55 },
        },
        editPlan: {
          targetArea: 'the seated figure and side table',
          preserveArea: 'the current figure tilt and table-leg spacing',
          issue: 'the spatial drawing already reads convincingly',
          intendedChange: 'preserve the present drawing relationships',
          expectedOutcome: 'the room structure remains coherent',
          editability: 'no',
        },
        subskills: [
          { label: 'Shape placement', score: 0.73, level: 'Advanced' },
          { label: 'Spatial construction', score: 0.71, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        phase1: {
          visualInventory:
            'The interior verticals in the chair back crossing the figure are close in sharpness to the face behind them. The head and shirt passage sits slightly right of center and is meant to hold focus. The chair silhouette reads more clearly than some of the interior slats.',
        },
        phase2: {
          criticsAnalysis:
            'In the chair back crossing the seated figure, the interior verticals stay almost as insistent as the face.',
        },
        phase3: {
          teacherNextSteps:
            '1. In the chair back crossing the seated figure, soften the interior verticals so they stop competing with the face.',
        },
        actionPlanSteps: [
          {
            area: 'the chair back crossing the seated figure',
            currentRead: 'the interior verticals stay almost as insistent as the face',
            move: 'soften the interior verticals so they stop competing with the face',
            expectedRead: 'the face regains priority',
            preserve: 'the outer chair silhouette and the head-to-shirt contrast',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The focal passage is clear, but the chair bars compete with it.',
          mainProblem: 'The interior verticals interrupt the focus hierarchy.',
          mainStrength: '',
          bestNextMove: 'Soften the interior verticals while keeping the silhouette intact.',
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: 'The face wins the first read more clearly.',
          storyIfRelevant: '',
        },
        confidence: 'high',
        evidenceSignals: ['The chair bars cross in front of the figure.'],
        preserve: 'Preserve the outer chair silhouette and the head-to-shirt contrast.',
        nextTarget: 'Push edge and focus control toward Advanced.',
        anchor: {
          areaSummary: 'the chair back crossing the seated figure',
          evidencePointer: 'its interior verticals compete with the face instead of supporting it',
          region: { x: 0.18, y: 0.22, width: 0.24, height: 0.46 },
        },
        editPlan: {
          targetArea: 'the chair back crossing the seated figure',
          preserveArea: 'the outer chair silhouette and the head-to-shirt contrast',
          issue: 'the interior chair bars pull too strongly relative to the face',
          intendedChange: 'soften the interior chair bars while preserving the silhouette',
          expectedOutcome: 'the face regains the first read',
          editability: 'yes',
        },
        subskills: [
          { label: 'Edge hierarchy', score: 0.51, level: 'Intermediate' },
          { label: 'Focus placement', score: 0.55, level: 'Intermediate' },
        ],
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'Broad even hatching builds the wall, while the floor uses a different directional stroke below. The chair carries tighter linear marks than the wall field. The shirt handling is smoother than the surrounding room hatching.',
        },
        phase2: {
          criticsAnalysis: 'The drawing strokes stay economical and directional.',
        },
        phase3: {
          teacherNextSteps: '1. Keep the current mark economy in the wall, floor, and chair.',
        },
        actionPlanSteps: [
          {
            area: 'the wall and floor hatching',
            currentRead: 'the mark families are already economical and organized',
            move: 'preserve the current mark economy in the wall, floor, and chair',
            expectedRead: 'the drawing keeps its controlled surface rhythm',
            preserve: 'the directional differences between wall and floor marks',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The mark economy is already supporting the room clearly.',
          mainStrength: 'The wall and floor hatching stay distinct without fuss.',
          bestNextMove: 'Protect the current mark economy instead of adding more surface activity.',
          expectedRead: 'The drawing keeps its controlled surface rhythm.',
        },
        confidence: 'medium',
        evidenceSignals: ['The wall is built with broad, even hatching.'],
        preserve: 'Preserve the distinct mark families between wall and floor.',
        nextTarget: 'Push surface and medium handling toward Master.',
        anchor: {
          areaSummary: 'the wall and floor hatching',
          evidencePointer: 'their distinct mark families keep the room organized without overworking the drawing',
          region: { x: 0, y: 0, width: 1, height: 1 },
        },
        editPlan: {
          targetArea: 'the wall and floor hatching',
          preserveArea: 'the directional differences between wall and floor marks',
          issue: 'the surface handling already supports the room clearly',
          intendedChange: 'preserve the current mark economy',
          expectedOutcome: 'the drawing keeps its controlled surface rhythm',
          editability: 'no',
        },
        subskills: [
          { label: 'Mark economy', score: 0.72, level: 'Advanced' },
          { label: 'Surface character', score: 0.69, level: 'Advanced' },
        ],
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Advanced',
        phase1: {
          visualInventory:
            'The seated figure\'s head and torso tilt inward on the right half of the painting. The chair screens part of the body from a viewpoint set behind it. The figure\'s attention stays directed toward the table rather than outward.',
        },
        phase2: {
          criticsAnalysis:
            'The seated figure has a quiet inwardness, and the room feels inhabited rather than staged.',
        },
        phase3: {
          teacherNextSteps:
            '1. Keep the current inward pressure around the seated figure and the obstructed viewpoint.',
        },
        actionPlanSteps: [
          {
            area: 'the seated figure’s head and upper torso',
            currentRead: 'the inward tilt already carries quiet human pressure',
            move: 'keep the current inward pressure around the seated figure and the obstructed viewpoint',
            expectedRead: 'the picture keeps its authored presence',
            preserve: 'the inward tilt and obstructed viewpoint',
            priority: 'primary',
          },
        ],
        voiceBPlan: {
          currentRead: 'The point of view already feels inhabited and specific.',
          mainStrength: 'The inward tilt gives the figure quiet human force.',
          bestNextMove: 'Preserve the current inward pressure and obstructed viewpoint.',
          expectedRead: 'The picture keeps its authored presence.',
        },
        confidence: 'medium',
        evidenceSignals: ['The seated figure reads as inward and absorbed.'],
        preserve: 'Preserve the figure’s inwardness and the obstructed viewpoint.',
        nextTarget: 'Push presence, point of view, and human force toward Master.',
        anchor: {
          areaSummary: 'the seated figure’s head and upper torso',
          evidencePointer: 'their inward tilt carries the painting’s quiet human pressure',
          region: { x: 0.46, y: 0.12, width: 0.22, height: 0.3 },
        },
        editPlan: {
          targetArea: 'the seated figure’s head and upper torso',
          preserveArea: 'the inward tilt and obstructed viewpoint',
          issue: 'the human pressure is already convincing',
          intendedChange: 'preserve the current inward pressure',
          expectedOutcome: 'the picture keeps its authored presence',
          editability: 'no',
        },
        subskills: [
          { label: 'Atmospheric force', score: 0.71, level: 'Advanced' },
          { label: 'Point of view', score: 0.73, level: 'Advanced' },
        ],
      },
    ],
  } as const;

  const validated = validateCritiqueResult(raw);
  const composition = validated.categories[1]!;
  assert.equal(composition.actionPlanSteps?.length, 1);
  assert.equal(composition.voiceBPlan?.bestNextMove, 'Soften the interior chair bars while keeping the silhouette intact.');

  const finalized = finalizeCritiqueResult(validated as unknown as CritiqueResult, {
    photoQuality: validated.photoQuality,
  });
  const finalizedComposition = finalized.categories[1]!;
  assert.match(finalizedComposition.phase3.teacherNextSteps, /1\. In the chair back crossing the seated figure/i);
  assert.match(finalizedComposition.phase3.teacherNextSteps, /soften|interior chair bars/i);
  assert.doesNotMatch(finalizedComposition.phase3.teacherNextSteps, /2\./i);
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

  // Verify Zod field names match what validateVoiceBPlan and validateCritiqueResult expect
  const mockMergedCategories = CRITERIA_ORDER.map((criterion) => ({
    criterion,
    level: 'Intermediate',
    phase1: {
      visualInventory: `Literal visual inventory for ${criterion} centered on the chair back crossing the seated figure.`,
    },
    phase2: {
      criticsAnalysis: `Feedback for ${criterion} grounded in the chair back crossing the seated figure.`,
    },
    phase3: {
      teacherNextSteps: `1. In the chair back crossing the seated figure, soften the interior bars so the face regains priority.`,
    },
    actionPlanSteps: [mockStep],
    voiceBPlan: mockPlan,
    confidence: 'medium',
    evidenceSignals: ['The chair bars cross the figure.', 'The head is the intended focal passage.'],
    preserve: 'Preserve the outer silhouette.',
    nextTarget: `Push ${criterion.toLowerCase()} toward Advanced.`,
    anchor: mockAnchor,
    editPlan: mockEditPlan,
    subskills: [
      { label: 'Sub A', score: 0.5, level: 'Intermediate' },
      { label: 'Sub B', score: 0.48, level: 'Intermediate' },
    ],
  }));

  const mockMerged = {
    summary: 'A focused interior with one competing obstruction at the chair back crossing the seated figure.',
    suggestedPaintingTitles: [
      { category: 'formalist', title: 'Interior Study', rationale: 'Composition at Intermediate with the chair back as dominant structure.' },
      { category: 'tactile', title: 'Chair and Figure', rationale: 'Surface at Intermediate with the chair back as key physical element.' },
      { category: 'intent', title: 'Window Light Drawing', rationale: 'Intent at Intermediate with the chair back as core psychological weight.' },
    ],
    overallSummary: {
      analysis: 'The chair back and seated figure create a clear interior tension.',
      topPriorities: ['Soften the interior bars at the chair back crossing the seated figure.'],
    },
    studioAnalysis: {
      whatWorks: 'The chair back and window strip establish a strong scaffold.',
      whatCouldImprove: 'The chair back still competes with the face.',
    },
    studioChanges: [
      { text: 'Soften the interior bars at the chair back crossing the seated figure.', previewCriterion: 'Edge and focus control' },
      { text: 'Keep the left window strip intact.', previewCriterion: 'Value and light structure' },
    ],
    comparisonNote: null,
    overallConfidence: 'medium',
    photoQuality: { level: 'good', summary: 'Good.', issues: [], tips: [] },
    categories: mockMergedCategories,
  };

  const validated = validateCritiqueResult(mockMerged);
  assert.ok(validated, 'Zod-shaped mock should pass validateCritiqueResult');
  assert.equal(
    validated.categories[0]!.phase1.visualInventory,
    'Literal visual inventory for Intent and necessity centered on the chair back crossing the seated figure.'
  );
  assert.equal(validated.categories[0]!.voiceBPlan?.expectedRead, 'The face separates from the jacket.');
  assert.equal(validated.categories[0]!.actionPlanSteps?.length, 1);
  assert.equal(validated.categories[0]!.anchor?.areaSummary, 'the chair back crossing the seated figure');
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
  testCritiqueGuardrails();
  testCriterionBandRubric();
  testEvidencePromptDemandsConcreteSurfaceAnchors();
  testEvidenceRepairNoteDemandsAnchorSupport();
  testSerializedPipelineErrorIncludesDebugMetadata();
  testValidationErrorDetailsAreHumanized();
  testRequestErrorCarriesDebugTrace();
  testDebugLogPayloadSanitization();
  testWritingPromptDemandsConcreteAnchors();
  testPreviewEditPromptAlignment();
  testStructuredVoiceBPlanFlow();
  testZodSchemaRoundTrip();
  testVisionImagePayloadShape();
  await runPreviewResizeTests();
  console.log('Architecture tests passed.');
}

void main();
