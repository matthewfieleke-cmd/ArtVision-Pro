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
});
