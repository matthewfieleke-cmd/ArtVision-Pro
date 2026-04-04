import { describe, expect, it } from 'vitest';

import { anchorSupportedByEvidenceLine, anchorSupportedByEvidenceLines } from './critiqueGrounding';

describe('anchorSupportedByEvidenceLine', () => {
  it('accepts evidence lines that restate a figure-against-shore anchor with equivalent rock/shore nouns', () => {
    expect(
      anchorSupportedByEvidenceLine(
        'the seated figure against the rocky shore',
        "The seated figure's yellow clothing contrasts with the dark rocks, drawing attention."
      )
    ).toBe(true);
  });

  it('accepts aggregate support when anchor nouns are distributed across concrete evidence lines', () => {
    expect(
      anchorSupportedByEvidenceLines('the seated figure against the rocky shoreline', [
        "The seated figure's yellow shirt contrasts with the dark rocks, drawing attention.",
        'The figure\'s placement near the tree trunk connects human presence with nature.',
        'The distant figure on the rocks adds a sense of scale and narrative.',
      ])
    ).toBe(true);
  });
});
