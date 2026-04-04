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
});
