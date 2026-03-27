import assert from 'node:assert/strict';

import { applyCritiqueGuardrails } from '../lib/critiqueAudit.js';
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
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'A quiet, atmospheric watercolor landscape with soft transitions and a calm mood.',
      working: ['The softness supports the atmosphere.', 'The composition already feels settled.'],
      mainIssue: 'The painting needs a stronger focal point and more cohesion.',
      nextSteps: [
        'Increase contrast to create more depth.',
        'Experiment with different textures to see how they interact with the existing composition.',
        'Maintain the current balance while refining the edges.',
      ],
      preserve: 'Preserve the soft, tranquil atmosphere and the watercolor bloom in the sky.',
    }),
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.match(
    guarded.simpleFeedback?.studioAnalysis.whatCouldImprove ?? '',
    /not simply that the painting needs more focus|not a lack of drama/i
  );
  assert.match(guarded.simpleFeedback?.studioChanges[0]?.text ?? '', /Keep the current value compression/i);
  assert.match(
    guarded.simpleFeedback?.studioChanges[2]?.text ?? '',
    /keep the current balance while refining the edges/i
  );

  const drawingGuarded = applyCritiqueGuardrails({
    summary: 'Strong drawing.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'A graphite drawing focused on solitude and strong chiaroscuro.',
      working: ['The line work is expressive.', 'The contrast creates mood.'],
      mainIssue: 'The drawing could use more depth.',
      nextSteps: [
        'Experiment with subtle color variations in the background to enhance depth.',
        'Maintain the dramatic effect.',
      ],
      preserve: 'Preserve the graphite line work and monochrome mood.',
    }),
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.doesNotMatch(drawingGuarded.simpleFeedback?.studioChanges[0]?.text ?? '', /color variations/i);
  assert.match(drawingGuarded.simpleFeedback?.studioChanges[0]?.text ?? '', /pressure|edge weight|value grouping/i);

  const weakActionGuarded = applyCritiqueGuardrails({
    summary: 'An advanced landscape study with one unresolved foreground/background relationship.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'An atmospheric oil landscape with a bright field against a softer mountain backdrop.',
      working: ['The church remains a clear anchor.', 'The atmosphere is convincing.'],
      mainIssue: 'The bright foreground may overpower the softer background.',
      nextSteps: [
        'Maintain the current balance between the foreground and the background.',
        'Continue exploring the atmospheric effect in the distance.',
      ],
      preserve: 'Preserve the atmospheric softness in the mountains and the calm overall mood.',
    }),
    categories: [],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  assert.doesNotMatch(
    weakActionGuarded.simpleFeedback?.studioChanges[0]?.text ?? '',
    /maintain the current balance/i
  );
  assert.match(
    weakActionGuarded.simpleFeedback?.studioChanges[0]?.text ?? '',
    /on the next pass|temperature shift|foreground|background/i
  );
  assert.doesNotMatch(
    weakActionGuarded.simpleFeedback?.studioChanges[1]?.text ?? '',
    /continue exploring/i
  );
  assert.match(
    weakActionGuarded.simpleFeedback?.studioChanges[1]?.text ?? '',
    /softening one background edge|smaller temperature or value shift|deepen the distance/i
  );

  const belowMasterSpecificityGuarded = applyCritiqueGuardrails({
    summary: 'A student watercolor with several unresolved structural relationships.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'A simple watercolor scene with bright local color and childlike spacing.',
      working: ['The mood is cheerful.', 'The main shapes are easy to read.'],
      mainIssue: 'The work could be stronger overall.',
      nextSteps: [
        'Maintain the cheerful feeling.',
        'Continue exploring the composition.',
        'Consider adding more variety.',
      ],
      preserve: 'Preserve the cheerful mood and the readable big shapes.',
    }),
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
    belowMasterSpecificityGuarded.simpleFeedback?.studioChanges[0]?.text ?? '',
    /^maintain the cheerful feeling/i
  );
  assert.match(
    belowMasterSpecificityGuarded.simpleFeedback?.studioChanges[0]?.text ?? '',
    /cheerful feeling|on the next pass, keep/i
  );
  assert.match(
    belowMasterSpecificityGuarded.simpleFeedback?.studioChanges[1]?.text ?? '',
    /shape, edge, or value|undecided|replace the most generic/i
  );

  const sloppyWorkGuarded = applyCritiqueGuardrails({
    summary:
      'A colorful but underdeveloped painting with loose brushwork, simplified forms, and a balanced but naïve scene.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'A playful, inviting scene with bright color and expression over precision.',
      working: ['Bright color catches the eye.', 'The subject is readable.'],
      mainIssue: 'The work could be stronger overall.',
      nextSteps: [
        'Maintain the vibrant palette.',
        'Continue exploring the playful composition.',
        'Preserve the expressive brushwork.',
      ],
      preserve: 'Preserve the playful mood and bright colors.',
    }),
    categories: [
      {
        criterion: 'Intent and necessity',
        level: 'Advanced',
        feedback: 'The playful arrangement is readable but still simple.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Composition and shape structure',
        level: 'Advanced',
        feedback: 'Balanced composition, but simple.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Value and light structure',
        level: 'Intermediate',
        feedback: 'Light is suggested without clear value grouping.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Color relationships',
        level: 'Advanced',
        feedback: 'Bright color is lively but not disciplined.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Intermediate',
        feedback: 'Forms are simplified and space is uncertain.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        feedback: 'Edges stay loose and distributed.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Advanced',
        feedback: 'Loose brushwork is visible throughout.',
        actionPlan: '1. Keep going.',
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Advanced',
        feedback: 'The scene feels playful and inviting.',
        actionPlan: '1. Keep going.',
      },
    ],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  const sloppyLevels = sloppyWorkGuarded.categories.reduce<Record<string, number>>((acc, category) => {
    acc[category.level] = (acc[category.level] ?? 0) + 1;
    return acc;
  }, {});
  assert.ok((sloppyLevels.Beginner ?? 0) >= 5);
  assert.ok((sloppyLevels.Beginner ?? 0) + (sloppyLevels.Intermediate ?? 0) === 8);

  const actionPlanGuarded = applyCritiqueGuardrails({
    summary: 'A landscape with one unresolved focal path and weak foreground grouping.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'A calm landscape with one path leading into a distant tree line.',
      working: ['The path sets up a readable direction.', 'The color families are broadly separated.'],
      mainIssue: 'The foreground and background are not yet clearly separated.',
      nextSteps: [
        'Maintain the current mood.',
        'Continue exploring the scene.',
      ],
      preserve: 'Preserve the calm atmosphere.',
    }),
    categories: [
      {
        criterion: 'Composition and shape structure',
        level: 'Intermediate',
        feedback: 'The path leads inward, but nearby shapes compete too much.',
        actionPlan: '1. Maintain the current balance. 2. Continue exploring the composition. 3. Ensure harmony.',
        evidenceSignals: [
          'The path leads inward from the foreground.',
          'The tree line and sky meet softly in the background.',
        ],
      },
      {
        criterion: 'Value and light structure',
        level: 'Intermediate',
        feedback: 'The foreground values stay too close together.',
        actionPlan: '1. Improve the value structure. 2. Increase clarity. 3. Keep going.',
        evidenceSignals: [
          'Foreground values are close together.',
          'The distant background is lighter than the foreground.',
        ],
      },
      {
        criterion: 'Color relationships',
        level: 'Intermediate',
        feedback: 'Color stays broad but not yet very controlled.',
        actionPlan: '1. Harmonize the colors.',
        evidenceSignals: [
          'Green and earth tones dominate the foreground.',
          'Cooler blue-grey sits in the distance.',
        ],
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Intermediate',
        feedback: 'The path and tree masses are readable but broad.',
        actionPlan: '1. Refine the drawing.',
        evidenceSignals: [
          'The path narrows as it moves back.',
          'The trees form one large mass on the horizon.',
        ],
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        feedback: 'The focal path edge is not yet distinct enough.',
        actionPlan: '1. Sharpen where needed.',
        evidenceSignals: [
          'Most edges are equally soft.',
          'The path edge does not stand out from the neighboring grass.',
        ],
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Intermediate',
        feedback: 'Handling is broad and still tentative.',
        actionPlan: '1. Improve handling.',
        evidenceSignals: [
          'Foreground marks repeat with similar size and pressure.',
          'The distant paint surface is quieter.',
        ],
      },
      {
        criterion: 'Intent and necessity',
        level: 'Intermediate',
        feedback: 'The calm mood is there, but some decisions stay broad.',
        actionPlan: '1. Push the idea further.',
        evidenceSignals: [
          'The path sets the main direction of the scene.',
          'The softer horizon keeps the mood calm.',
        ],
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Intermediate',
        feedback: 'The viewpoint is stable but not yet especially forceful.',
        actionPlan: '1. Make it more memorable.',
        evidenceSignals: [
          'The view is eye-level and calm.',
          'No single passage yet holds the eye strongly.',
        ],
      },
    ],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  for (const category of actionPlanGuarded.categories) {
    assert.match(
      category.actionPlan,
      /foreground|background|upper|lower|left|right|path|edge|shape|value|temperature|neighbor/i
    );
    assert.doesNotMatch(
      category.actionPlan,
      /continue exploring|maintain the current balance|ensure harmony|keep going/i
    );
  }

  const vagueNextStepsGuarded = applyCritiqueGuardrails({
    summary: 'Landscape study: a dirt path cuts past oak trees into a pale evening sky.',
    simpleFeedback: migrateLegacySimpleFeedback({
      intent: 'Evening light on a path that bends past oak trunks toward a cool sky.',
      working: ['The path reads as a clear entry.', 'The oak mass anchors the right side.'],
      mainIssue: 'The path edge and grass still merge too much.',
      nextSteps: [
        'In the area that reads weakest against your evidence, simplify one busy passage and separate its main shape from the neighbor with a clearer value or edge decision.',
        'Along one important contour you already rely on, sharpen or lose a short span of edge so depth and focus read more deliberately.',
        'Where two color families meet in the painting, adjust temperature or chroma in a narrow band so the transition supports the space instead of flattening it.',
      ],
      preserve: 'Keep the path rhythm and the oak silhouette.',
    }),
    categories: [
      {
        criterion: 'Intent and necessity',
        level: 'Intermediate',
        feedback: 'The path story is clear but some passages still compete.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['The path leads the eye inward.', 'Sky and trees share similar value bands.'],
      },
      {
        criterion: 'Composition and shape structure',
        level: 'Intermediate',
        feedback: 'The path works but peripheral shapes compete.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['The path narrows convincingly into depth.', 'Grass texture repeats at the path edge.'],
      },
      {
        criterion: 'Value and light structure',
        level: 'Intermediate',
        feedback: 'Evening compression is nice but edges need separation.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Evening light flattens some foreground planes.', 'Oak trunks read darker than the path.'],
      },
      {
        criterion: 'Color relationships',
        level: 'Intermediate',
        feedback: 'Warm path vs cool sky is promising.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Warm ochres sit in the path.', 'Cool violets appear in the distant sky.'],
      },
      {
        criterion: 'Drawing, proportion, and spatial form',
        level: 'Intermediate',
        feedback: 'Big shapes read; small overlaps wobble.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Tree trunks tilt consistently.', 'Path width varies believably.'],
      },
      {
        criterion: 'Edge and focus control',
        level: 'Intermediate',
        feedback: 'Path edge needs hierarchy.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Grass strokes match the path edge sharpness.', 'Sky meets treetops softly.'],
      },
      {
        criterion: 'Surface and medium handling',
        level: 'Intermediate',
        feedback: 'Marks are lively but repetitive near the path.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Scumbled grass repeats similar length strokes.', 'Sky wash is smoother than foreground.'],
      },
      {
        criterion: 'Presence, point of view, and human force',
        level: 'Intermediate',
        feedback: 'Calm evening mood comes through.',
        actionPlan: '1. Keep going.',
        evidenceSignals: ['Low light mood is consistent.', 'No single human focal point.'],
      },
    ],
    overallConfidence: 'high',
    photoQuality: { level: 'good', summary: 'Good photo.', issues: [], tips: [] },
    analysisSource: 'api',
  });

  const joinedNext =
    vagueNextStepsGuarded.simpleFeedback?.studioChanges.map((c) => c.text).join(' ') ?? '';
  assert.doesNotMatch(joinedNext, /starting from what is already visible \(|\bin the passage your notes describe\b/i);
  assert.match(joinedNext, /path|oak|sky|grass|tree|evening|foreground|treetops|weakest against your evidence|two color families|one important contour/i);
}

async function main(): Promise<void> {
  await testCritiqueFlow();
  await testApiHelpers();
  testCritiqueGuardrails();
  await runPreviewResizeTests();
  console.log('Architecture tests passed.');
}

void main();
