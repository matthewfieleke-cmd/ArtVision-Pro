import { describe, expect, it } from 'vitest';

import { CritiqueValidationError } from './critiqueErrors.js';
import { buildEvidenceRepairNote } from './openaiCritique.js';

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

  it('includes cafe-scene repair guidance when evidence retries fail', () => {
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

    expect(note).toContain('For cafe or street scenes, prefer anchors shaped like "the cafe tables with yellow umbrellas"');
    expect(note).toContain(
      'Do NOT write "the outdoor seating area", "the cafe atmosphere", or "the path leading through the scene" as sufficient conceptual evidence'
    );
    expect(note).toContain(
      'replace summaries like "the path guides the eye", "the tables create rhythm", or "the umbrellas create a focal point" with event language'
    );
  });

  it('includes object-study repair guidance when conceptual anchors and composition evidence drift generic', () => {
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

    expect(note).toContain('On object studies or architecture, conceptual anchors still need a physical carrier passage');
    expect(note).toContain('Do NOT use object-summary anchors like "the beauty of the bottle"');
    expect(note).toContain('Do NOT write object-study summaries like "the bottle feels elegant"');
    expect(note).toContain('a pump head against a bottle neck');
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

  it('includes house-scene repair guidance when conceptual retries drift into holiday mood language', () => {
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

    expect(note).toContain('Do NOT use house-scene summaries like "the welcoming house"');
    expect(note).toContain('Do NOT write house-scene summaries like "the house feels welcoming"');
    expect(note).toContain('the red door under the lit window');
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

  it('includes figure-led and train-led repair guidance when retries drift into drama or movement summaries', () => {
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

    expect(note).toContain('Do NOT write figure summaries like "the pose creates emotion"');
    expect(note).toContain('Do NOT write train summaries like "the train creates movement"');
    expect(note).toContain('the shoulder edge against the pillow');
    expect(note).toContain('the leaning telegraph poles beside the train');
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
