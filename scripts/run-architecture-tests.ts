import assert from 'node:assert/strict';

import { applyCritiqueGuardrails, critiqueNeedsFreshEvidenceRead } from '../lib/critiqueAudit.js';
import { evaluateCritiqueQuality } from '../lib/critiqueEval.ts';
import { migrateLegacySimpleFeedback } from '../lib/critiqueValidation.js';
import {
  applyCorsHeaders,
  handleApiRequest,
  resolveApiRoute,
} from '../lib/apiHandlers.js';
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

function makeCritiqueResult(): CritiqueResult {
  return {
    summary: 'Solid structure with one weak edge hierarchy.',
    categories: [
      {
        criterion: 'Composition and shape structure',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Value and light structure',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Color relationships',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        feedback: 'Needs better hierarchy.',
        actionPlan: '1. Quiet the background edges.',
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
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
        feedback:
          'In the foreground chair back, the dark vertical bars interrupt the route to the seated figure. The window strip at left and the bright shirt already create a strong scaffold. The issue is not the whole arrangement but that this one passage pulls too loudly.',
        actionPlan:
          '1. In the foreground chair back, soften the interior bars while keeping the outer silhouette intact. 2. Leave the bright window strip alone so the room keeps its current lateral pull.',
        confidence: 'high',
        evidenceSignals: ['The chair back crosses the figure in the foreground.', 'The left window strip is the clearest light shape.'],
        preserve: 'Keep the window strip and the shirt-to-wall contrast.',
        practiceExercise: 'Do two thumbnail studies of the chair against the figure.',
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
        feedback:
          'The left window strip and the shirt already establish a clear light pattern. Around the seated head, the surrounding dark wall compresses value effectively. This axis is reading strongly overall.',
        actionPlan:
          '1. Keep the left window strip and its window-to-shirt value pattern; it is already doing the structural work.',
        confidence: 'medium',
        evidenceSignals: ['The window strip is the clearest light shape.', 'The shirt sits against a darker wall.'],
        preserve: 'Preserve the main light-dark grouping across window, shirt, and wall.',
        practiceExercise: 'Squint studies of the room in 3 values.',
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
        feedback: 'Muted drawing values remain disciplined in one family. The slight warmth of the floor against the cooler wall is enough to separate zones without forcing color. That restraint is working.',
        actionPlan: '1. Keep the current value-led palette discipline in the floor and wall.',
        confidence: 'medium',
        evidenceSignals: ['The floor reads slightly warmer than the wall.', 'Most passages stay within a muted drawing palette.'],
        preserve: 'Keep the restrained palette world.',
        practiceExercise: 'Do a graphite temperature map using only value notation.',
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
        feedback: 'The seated figure\'s tilt and the table legs hold together believably. The chair bars crossing the body are intentionally awkward but still spatially coherent. This criterion is strong.',
        actionPlan: '1. Keep the current spatial drawing in the seated figure and table legs.',
        confidence: 'medium',
        evidenceSignals: ['The seated figure tilts back convincingly.', 'The table legs sit on the floor plane with readable angle shifts.'],
        preserve: 'Preserve the figure tilt and the table-leg spacing.',
        practiceExercise: 'Quick line studies of figure plus foreground obstruction.',
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
        feedback:
          'In the foreground chair back, the interior verticals stay almost as insistent as the face. The seated head and shirt should win the first read, but the chair interrupts that hierarchy. The problem is specific and local rather than global.',
        actionPlan:
          '1. In the foreground chair back, soften the interior verticals so they stop competing with the face. 2. Keep the outer chair silhouette crisp enough to retain the obstruction. 3. Leave the head-and-shirt edge contrast intact so the figure keeps priority.',
        confidence: 'high',
        evidenceSignals: ['The chair bars cross in front of the figure.', 'The head and shirt are the intended focal passage.'],
        preserve: 'Preserve the outer chair silhouette and the head-to-shirt contrast.',
        practiceExercise: 'Do a hard/soft edge chart from the chair against the figure.',
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
        feedback: 'The drawing strokes stay economical and directional. The chair, wall, and floor all use distinct mark families without fuss. The surface handling is already disciplined.',
        actionPlan: '1. Keep the current mark economy in the wall, floor, and chair.',
        confidence: 'medium',
        evidenceSignals: ['The wall is built with broad, even hatching.', 'The floor uses directional strokes distinct from the wall.'],
        preserve: 'Preserve the distinct mark families between wall and floor.',
        practiceExercise: 'One-page mark-family study from the room.',
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
        feedback: 'The figure, chair obstruction, and side table all belong to one observed interior problem. The awkwardness feels chosen rather than accidental. Most decisions answer to the same quiet, compressed world.',
        actionPlan: '1. Keep the present tension between the chair obstruction and the seated figure; it belongs to the painting\'s logic.',
        confidence: 'medium',
        evidenceSignals: ['The chair obstruction and figure belong to the same pictorial problem.', 'The room stays quiet and compressed throughout.'],
        preserve: 'Preserve the quiet compression of the room and the obstructed figure setup.',
        practiceExercise: 'Thumbnail studies of obstruction as intent.',
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
        feedback: 'The seated figure has a quiet inwardness, and the room feels inhabited rather than staged. The specific viewpoint from behind the chair contributes to that pressure. The painting has real presence.',
        actionPlan: '1. Keep the current inward pressure around the seated figure and the obstructed viewpoint.',
        confidence: 'medium',
        evidenceSignals: ['The seated figure reads as inward and absorbed.', 'The viewpoint from behind the chair feels deliberate.'],
        preserve: 'Preserve the figure\'s inwardness and the obstructed viewpoint.',
        practiceExercise: 'Short studies of viewpoint and mood through obstruction.',
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
      'Interior with Seated Figure and Foreground Chair',
      'Study in Window Light and Compressed Wall Tone',
      'Chair Back and Face: Drawing After Vermeer',
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
            feedback: 'The focus could be stronger in places.',
            actionPlan: '1. Improve the focus where needed.',
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

async function main(): Promise<void> {
  await testCritiqueFlow();
  await testApiHelpers();
  testCritiqueGuardrails();
  testCriterionBandRubric();
  await runPreviewResizeTests();
  console.log('Architecture tests passed.');
}

void main();
