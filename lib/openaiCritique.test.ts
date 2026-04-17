import { describe, expect, it } from 'vitest';

import {
  CritiqueGroundingError,
  CritiqueRetryExhaustedError,
  CritiqueUninterpretableImageError,
  CritiqueValidationError,
} from './critiqueErrors.js';
import {
  buildEvidenceRepairNote,
  classifyCoreCritiqueRecovery,
  createObservationRetryExhaustedError,
  parseObservationStageResult,
  runBestEffortCritiqueStage,
} from './openaiCritique.js';

describe('buildEvidenceRepairNote', () => {
  it('includes failing criterion evidence preview when generic evidence needs rewriting', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence is too generic for Composition and shape structure'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Composition and shape structure'],
            criterionEvidencePreview: [
              {
                criterion: 'Composition and shape structure',
                anchor: 'the path bend under the red house',
                visibleEvidencePreview: [
                  'The path bend under the red house narrows before the doorway and leaves a wider flower band on the left than on the right.',
                  'The house sits slightly off-center, creating a dynamic composition.',
                  'The fence line creates a horizontal division that guides the eye across the painting.',
                  'The trees on the right balance the composition by adding vertical elements.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Previous evidence preview for Composition and shape structure');
    expect(note).toContain('Previous anchor: "the path bend under the red house"');
    expect(note).toContain(
      '"The house sits slightly off-center, creating a dynamic composition."'
    );
    expect(note).toContain('Rewrite the quoted lines below instead of paraphrasing the same generic idea again.');
  });

  it('includes the top-level weak-work repair block for current evidence error wording', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Evidence strongestVisibleQualities are too flattering or style-biased for weak work'],
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Critical top-level tone fix:');
    expect(note).toContain('intentHypothesis, strongestVisibleQualities, and comparisonObservations must stay provisional and evidence-led for weak work.');
  });

  it('includes universal repair guidance when evidence retries fail', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: [
        'Visible evidence is too generic for Composition and shape structure',
        'Conceptual evidence anchor is too soft for Intent and necessity',
      ],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: [
              'Visible evidence is too generic for Composition and shape structure',
              'Conceptual evidence anchor is too soft for Intent and necessity',
            ],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the outdoor seating area',
                visibleEvidencePreview: [
                  'The outdoor seating area suggests a lively cafe atmosphere.',
                ],
              },
              {
                criterion: 'Composition and shape structure',
                anchor: 'the path leading through the scene',
                visibleEvidencePreview: [
                  'The path guides the eye through the composition.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Do NOT use flattering or summary anchor labels');
    expect(note).toContain(
      'Do NOT write summary evidence like "the area creates mood", "the form has personality", "the scene has momentum", or "the passage adds warmth" as sufficient conceptual evidence.'
    );
    expect(note).toContain(
      'For Composition and shape structure, write a shape event, not a verdict'
    );
  });

  it('includes universal conceptual-anchor guidance when anchors and composition evidence drift generic', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: [
        'Conceptual evidence anchor is too soft for Intent and necessity',
        'Visible evidence is too generic for Composition and shape structure',
      ],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: [
              'Conceptual evidence anchor is too soft for Intent and necessity',
              'Visible evidence is too generic for Composition and shape structure',
            ],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the elegance of the bottle',
                visibleEvidencePreview: [
                  'The elegance of the bottle suggests a refined and graceful object.',
                ],
              },
              {
                criterion: 'Composition and shape structure',
                anchor: 'the bottle against the background',
                visibleEvidencePreview: [
                  'The bottle is centered and creates a stable composition.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('For Intent and necessity or Presence, point of view, and human force, anchor to the visible carrier of that intent or force');
    expect(note).toContain('Do NOT use flattering or summary anchor labels');
    expect(note).toContain('Do NOT write summary evidence like "the area creates mood"');
  });

  it('tells unsupported-anchor retries to put the anchor-echo support line first', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence does not support anchor for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence does not support anchor for Intent and necessity'],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the path leading to the house',
                visibleEvidencePreview: [
                  'The red wall above the doorway stays warmer than the blue wash around it.',
                  'The flower band below the house opens wider on the left than on the right.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Make the FIRST visibleEvidence line for each listed criterion that anchor-echo support line.');
    expect(note).toContain('Nearby passages do NOT count as support just because they share scene tokens');
    expect(note).toContain('the same line must restate the anchor passage and describe one visible event there');
  });

  it('includes universal mood-summary repair guidance when conceptual retries drift into atmosphere language', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence is too generic for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Intent and necessity'],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: "the 'JOY' sign against the house",
                visibleEvidencePreview: [
                  'The warm glow from the windows suggests a welcoming and festive atmosphere.',
                  'The house feels festive because of the decorations and lights.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Do NOT use flattering or summary anchor labels');
    expect(note).toContain('strengthRead and preserve must also name that same visible carrier passage');
  });

  it('explicitly rewrites interpretation-first conceptual evidence toward visible events', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence is too generic for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Intent and necessity'],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the path leading to the house',
                visibleEvidencePreview: [
                  'The path leading to the house creates a directional flow through the painting.',
                  'The path leading to the house draws attention to the structure.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('For conceptual visibleEvidence lines, naming the anchor is NOT enough.');
    expect(note).toContain('make the FIRST visibleEvidence line an anchor-echo support line');
    expect(note).toContain('creates a directional flow');
    expect(note).toContain('rewrite');
    expect(note).toContain('what narrows, bends, meets, overlaps, sits below, stays lighter/darker, or separates against what');
  });

  it('includes universal repair guidance when retries drift into drama or movement summaries', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: [
        'Conceptual evidence anchor is too soft for Presence, point of view, and human force',
        'Visible evidence is too generic for Composition and shape structure',
      ],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: [
              'Conceptual evidence anchor is too soft for Presence, point of view, and human force',
              'Visible evidence is too generic for Composition and shape structure',
            ],
            criterionEvidencePreview: [
              {
                criterion: 'Presence, point of view, and human force',
                anchor: 'the dramatic pose of the figure',
                visibleEvidencePreview: [
                  'The dramatic pose of the figure creates emotion and personality.',
                ],
              },
              {
                criterion: 'Composition and shape structure',
                anchor: 'the train moving through the scene',
                visibleEvidencePreview: [
                  'The train creates movement and the poles create rhythm.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Do NOT write summary evidence like "the area creates mood", "the form has personality", "the scene has momentum", or "the passage adds warmth" as sufficient conceptual evidence.');
    expect(note).toContain('For Composition and shape structure, do NOT use stock phrases like "balanced composition", "dynamic tension", "guides the eye", or "adds interest"');
    expect(note).toContain('For Composition and shape structure, write a shape event, not a verdict');
  });

  it('escalates repeated generic composition failures instead of repeating the same rewrite guidance', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence is too generic for Composition and shape structure'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Composition and shape structure'],
            criterionEvidencePreview: [
              {
                criterion: 'Composition and shape structure',
                anchor: 'the horizon line dividing the sky and sea',
                visibleEvidencePreview: ['The horizon line creates a balanced composition.'],
              },
            ],
          },
          {
            attempt: 2,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Composition and shape structure'],
            criterionEvidencePreview: [
              {
                criterion: 'Composition and shape structure',
                anchor: 'the beach chair against the sand',
                visibleEvidencePreview: ['The beach chair adds interest and balance to the composition.'],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Escalation for repeated failure:');
    expect(note).toContain('Replace the ENTIRE criterion block for any repeated failure');
    expect(note).toContain('at least TWO visibleEvidence lines for that criterion must describe a structural event');
    expect(note).toContain('Latest preview for repeatedly failing Composition and shape structure');
    expect(note).toContain('Previous anchor: "the beach chair against the sand"');
  });

  it('escalates repeated conceptual failures toward carrier grammar instead of theme labels', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Conceptual evidence anchor is too soft for Presence, point of view, and human force'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['strengthRead is too generic for Presence, point of view, and human force'],
            criterionEvidencePreview: [
              {
                criterion: 'Presence, point of view, and human force',
                anchor: "the train's dominant presence in the scene",
                visibleEvidencePreview: ['The train creates power and movement across the image.'],
              },
            ],
          },
          {
            attempt: 2,
            error: 'Evidence stage validation failed.',
            details: ['Conceptual evidence anchor is too soft for Presence, point of view, and human force'],
            criterionEvidencePreview: [
              {
                criterion: 'Presence, point of view, and human force',
                anchor: "the train's dominant presence against the landscape",
                visibleEvidencePreview: ['The train dominates the scene and creates energy.'],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('Escalation for repeated failure:');
    expect(note).toContain('rewrite it as a more pointable visible carrier');
    expect(note).toContain('"[path] leading to [object]"');
    expect(note).toContain('Do NOT reuse pure theme labels like "movement", "presence", "power", "energy", "atmosphere", "mood", or "dominant presence"');
    expect(note).toContain('Latest preview for repeatedly failing Presence, point of view, and human force');
    expect(note).toContain(`Previous anchor: "the train's dominant presence against the landscape"`);
  });

  it('warns conceptual retries not to reuse a composition carrier without proving conceptual force', () => {
    const error = new CritiqueValidationError('Evidence stage validation failed.', {
      stage: 'evidence',
      details: ['Visible evidence is too generic for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Intent and necessity'],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the telegraph poles against the landscape',
                visibleEvidencePreview: [
                  'The telegraph poles against the landscape create a dynamic diagonal line, suggesting movement and direction.',
                ],
              },
            ],
          },
        ],
      },
    });

    const note = buildEvidenceRepairNote(error);

    expect(note).toContain('do NOT reuse a composition anchor unless the evidence explicitly shows why that same passage carries the intent');
    expect(note).toContain('If the line only proves structure, it is still wrong for Intent or Presence.');
  });
});

describe('createObservationRetryExhaustedError', () => {
  it('wraps observation failures in a structured retry-exhausted pipeline error', () => {
    const attempts = [
      {
        attempt: 1,
        error: 'fetch failed',
        details: ['network timeout'],
      },
      {
        attempt: 2,
        error: 'OpenAI error 503',
        details: ['service unavailable'],
      },
    ];

    const error = createObservationRetryExhaustedError(new Error('OpenAI error 503'), attempts);

    expect(error).toBeInstanceOf(CritiqueRetryExhaustedError);
    expect(error.stage).toBe('evidence');
    expect(error.attempts).toBe(2);
    expect(error.details).toEqual(['OpenAI error 503']);
    expect(error.debug).toEqual({ attempts });
  });
});

describe('runBestEffortCritiqueStage', () => {
  it('returns the fallback value when an optional enhancement fails', async () => {
    await expect(
      runBestEffortCritiqueStage(
        'clarity',
        async () => {
          throw new Error('OpenAI error 502');
        },
        'fallback critique'
      )
    ).resolves.toBe('fallback critique');
  });
});

describe('classifyCoreCritiqueRecovery', () => {
  it('treats criterion-scoped validation failures as recoverable', () => {
    const recovery = classifyCoreCritiqueRecovery(
      new CritiqueGroundingError('Final critique failed evidence traceability validation.', {
        stage: 'final',
        details: ['Color relationships: final teacher guidance drifted away from the anchored passage.'],
      })
    );

    expect(recovery).toEqual(
      expect.objectContaining({
        disposition: 'recoverable',
        failureStage: 'final',
      })
    );
  });

  it('treats exhausted retries as safe-mode failures', () => {
    const recovery = classifyCoreCritiqueRecovery(
      new CritiqueRetryExhaustedError('Voice B stage exhausted retries.', 3, {
        stage: 'voice_b',
        details: ['OpenAI error 503'],
      })
    );

    expect(recovery).toEqual(
      expect.objectContaining({
        disposition: 'safe_mode',
        failureStage: 'voice_b',
      })
    );
  });

  it('treats uninterpretable images as fatal', () => {
    const recovery = classifyCoreCritiqueRecovery(new CritiqueUninterpretableImageError());

    expect(recovery).toEqual(
      expect.objectContaining({
        disposition: 'fatal',
        failureStage: 'evidence',
      })
    );
  });
});

describe('parseObservationStageResult', () => {
  it('sorts intent carriers best-first for conceptual reuse', () => {
    const raw = {
      passages: [
        {
          id: 'p1',
          label: "the train's front against the sky",
          role: 'value',
          visibleFacts: ['The train front stays darker than the sky.', 'The engine silhouette stays concentrated at the front.'],
        },
        {
          id: 'p2',
          label: 'the smoke above the train',
          role: 'edge',
          visibleFacts: ['The smoke softens into the sky.', 'The smoke spreads above the engine roofline.'],
        },
        {
          id: 'p3',
          label: 'the telegraph poles against the landscape',
          role: 'structure',
          visibleFacts: ['The poles tilt beside the train.', 'The poles repeat into the distance.'],
        },
        {
          id: 'p4',
          label: "the train's wheels against the track",
          role: 'surface',
          visibleFacts: ['The wheels land darker than the track marks.', 'The track stays thinner beneath the wheels.'],
        },
        {
          id: 'p5',
          label: 'the darker landscape under the train',
          role: 'value',
          visibleFacts: ['The land stays darker than the sky.', 'The train sits over that darker band.'],
        },
        {
          id: 'p6',
          label: 'the coupling hardware against the track bed',
          role: 'edge',
          visibleFacts: [
            'The coupling reads as a dark knot between rail ties.',
            'Hardware catches a thin highlight on its upper facet.',
          ],
        },
      ],
      visibleEvents: [
        {
          passageId: 'p1',
          passage: "the train's front against the sky",
          event: "The train's front stays darker than the sky and holds the machine's pressure there.",
          signalType: 'value',
        },
        {
          passageId: 'p2',
          passage: 'the smoke above the train',
          event: 'The smoke softens into the sky above the roofline.',
          signalType: 'edge',
        },
        {
          passageId: 'p3',
          passage: 'the telegraph poles against the landscape',
          event: 'The poles tilt beside the train and repeat into the distance.',
          signalType: 'shape',
        },
        {
          passageId: 'p4',
          passage: "the train's wheels against the track",
          event: "The train's wheels land darker than the track marks below them.",
          signalType: 'surface',
        },
        {
          passageId: 'p5',
          passage: 'the darker landscape under the train',
          event: 'The darker landscape holds below the lighter sky.',
          signalType: 'value',
        },
        {
          passageId: 'p1',
          passage: "the train's front against the sky",
          event: "The engine cuts into the lighter sky and holds the machine's pressure there.",
          signalType: 'shape',
        },
        {
          passageId: 'p2',
          passage: 'the smoke above the train',
          event: 'The smoke widens above the roofline and disperses into the sky.',
          signalType: 'shape',
        },
        {
          passageId: 'p4',
          passage: "the train's wheels against the track",
          event: 'The wheels sit heavier than the thinner track marks under them.',
          signalType: 'shape',
        },
        {
          passageId: 'p5',
          passage: 'the darker landscape under the train',
          event: 'The landscape band runs darker beneath the engine silhouette.',
          signalType: 'value',
        },
        {
          passageId: 'p6',
          passage: 'the coupling hardware against the track bed',
          event: 'The coupling sits lower than the wheel hubs and wedges between two rail ties.',
          signalType: 'shape',
        },
        {
          passageId: 'p6',
          passage: 'the coupling hardware against the track bed',
          event: 'The hardware facet facing the sky catches a short bright stroke.',
          signalType: 'value',
        },
      ],
      mediumCues: [
        'Dry drawing marks and strong contrast.',
        'The medium reads direct and linear rather than painterly.',
        'Rail geometry stays parallel under the engine body.',
      ],
      photoCaveats: [],
      intentCarriers: [
        {
          passageId: 'p3',
          passage: 'the telegraph poles against the landscape',
          reason: 'The tilted poles suggest speed and movement through the scene.',
        },
        {
          passageId: 'p2',
          passage: 'the smoke above the train',
          reason: 'The smoke keeps motion visible above the engine.',
        },
        {
          passageId: 'p1',
          passage: "the train's front against the sky",
          reason: "The train's front stays darker and heavier than the sky, so the machine's pressure holds there.",
        },
      ],
    };

    const parsed = parseObservationStageResult(raw);

    expect(parsed.intentCarriers[0]?.passageId).toBe('p1');
    expect(parsed.intentCarriers[1]?.passageId).toBe('p2');
    expect(parsed.intentCarriers[2]?.passageId).toBe('p3');
  });
});
