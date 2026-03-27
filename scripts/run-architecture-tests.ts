import assert from 'node:assert/strict';

import { applyCritiqueGuardrails } from '../lib/critiqueAudit.js';
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
  const guarded = applyCritiqueGuardrails({
    summary: 'Strong painting.',
    simpleFeedback: {
      intent: 'A quiet, atmospheric watercolor landscape with soft transitions and a calm mood.',
      working: ['The softness supports the atmosphere.', 'The composition already feels settled.'],
      mainIssue: 'The painting needs a stronger focal point and more cohesion.',
      nextSteps: [
        'Increase contrast to create more depth.',
        'Experiment with different textures to see how they interact with the existing composition.',
        'Maintain the current balance while refining the edges.',
      ],
      preserve: 'Preserve the soft, tranquil atmosphere and the watercolor bloom in the sky.',
    },
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.match(
    guarded.simpleFeedback?.mainIssue ?? '',
    /not simply that the painting needs more focus|not a lack of drama/i
  );
  assert.match(guarded.simpleFeedback?.nextSteps?.[0] ?? '', /Keep the current value compression/i);
  assert.match(
    guarded.simpleFeedback?.nextSteps?.[2] ?? '',
    /keep the current balance while refining the edges/i
  );

  const drawingGuarded = applyCritiqueGuardrails({
    summary: 'Strong drawing.',
    simpleFeedback: {
      intent: 'A graphite drawing focused on solitude and strong chiaroscuro.',
      working: ['The line work is expressive.', 'The contrast creates mood.'],
      mainIssue: 'The drawing could use more depth.',
      nextSteps: [
        'Experiment with subtle color variations in the background to enhance depth.',
        'Maintain the dramatic effect.',
      ],
      preserve: 'Preserve the graphite line work and monochrome mood.',
    },
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.doesNotMatch(drawingGuarded.simpleFeedback?.nextSteps?.[0] ?? '', /color variations/i);
  assert.match(drawingGuarded.simpleFeedback?.nextSteps?.[0] ?? '', /pressure|edge weight|value grouping/i);

  const weakActionGuarded = applyCritiqueGuardrails({
    summary: 'An advanced landscape study with one unresolved foreground/background relationship.',
    simpleFeedback: {
      intent: 'An atmospheric oil landscape with a bright field against a softer mountain backdrop.',
      working: ['The church remains a clear anchor.', 'The atmosphere is convincing.'],
      mainIssue: 'The bright foreground may overpower the softer background.',
      nextSteps: [
        'Maintain the current balance between the foreground and the background.',
        'Continue exploring the atmospheric effect in the distance.',
      ],
      preserve: 'Preserve the atmospheric softness in the mountains and the calm overall mood.',
    },
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.doesNotMatch(
    weakActionGuarded.simpleFeedback?.nextSteps?.[0] ?? '',
    /maintain the current balance/i
  );
  assert.match(
    weakActionGuarded.simpleFeedback?.nextSteps?.[0] ?? '',
    /on the next pass|temperature shift|foreground|background/i
  );
  assert.doesNotMatch(
    weakActionGuarded.simpleFeedback?.nextSteps?.[1] ?? '',
    /continue exploring/i
  );
  assert.match(
    weakActionGuarded.simpleFeedback?.nextSteps?.[1] ?? '',
    /softening one background edge|smaller temperature or value shift|deepen the distance/i
  );

  const belowMasterSpecificityGuarded = applyCritiqueGuardrails({
    summary: 'A student watercolor with several unresolved structural relationships.',
    simpleFeedback: {
      intent: 'A simple watercolor scene with bright local color and childlike spacing.',
      working: ['The mood is cheerful.', 'The main shapes are easy to read.'],
      mainIssue: 'The work could be stronger overall.',
      nextSteps: [
        'Maintain the cheerful feeling.',
        'Continue exploring the composition.',
        'Consider adding more variety.',
      ],
      preserve: 'Preserve the cheerful mood and the readable big shapes.',
    },
    categories: [
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Composition and shape structure',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Value and light structure',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Color relationships',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        feedback: 'Good.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Intermediate',
        feedback: 'Needs work.',
        actionPlan: '1. Keep going.',
      },
    ],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.doesNotMatch(
    belowMasterSpecificityGuarded.simpleFeedback?.nextSteps?.[0] ?? '',
    /maintain the cheerful feeling/i
  );
  assert.match(
    belowMasterSpecificityGuarded.simpleFeedback?.nextSteps?.[0] ?? '',
    /adjust|simplifying|separating|clearer value|edge decision/i
  );
  assert.match(
    belowMasterSpecificityGuarded.simpleFeedback?.nextSteps?.[1] ?? '',
    /quiet|soften|group/i
  );
}

async function main(): Promise<void> {
  await testCritiqueFlow();
  await testApiHelpers();
  testCritiqueGuardrails();
  console.log('Architecture tests passed.');
}

void main();
