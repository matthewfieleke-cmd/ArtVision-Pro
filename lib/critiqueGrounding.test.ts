import { describe, expect, it } from 'vitest';

import {
  anchorSupportedByEvidenceLine,
  anchorSupportedByEvidenceLines,
  findPrimaryAnchorSupportLine,
} from './critiqueGrounding';

describe('anchorSupportedByEvidenceLine', () => {
  it('accepts evidence lines that restate a figure-against-shore anchor with equivalent rock/shore nouns', () => {
    expect(
      anchorSupportedByEvidenceLine(
        'the seated figure against the rocky shore',
        "The seated figure's yellow clothing contrasts with the dark rocks, drawing attention."
      )
    ).toBe(true);
  });

  it('chooses a direct anchor-echo line as the primary support line', () => {
    const match = findPrimaryAnchorSupportLine('the path leading to the house', [
      'The path leading to the house narrows before the doorway and stays lighter than the flower patch beside it.',
      'The red wall above the doorway stays warmer than the blue wash around it.',
      'The flower band below the house opens wider on the left than on the right.',
    ]);

    expect(match?.line).toBe(
      'The path leading to the house narrows before the doorway and stays lighter than the flower patch beside it.'
    );
  });

  it('rejects aggregate support when anchor nouns are only distributed across nearby lines', () => {
    expect(
      anchorSupportedByEvidenceLines('the seated figure against the rocky shoreline', [
        "The seated figure's yellow shirt contrasts with the pale water, drawing attention.",
        'The tree trunk behind the figure keeps the body from floating loose against the bank.',
        'The distant figure on the rocks adds a sense of scale and narrative.',
      ])
    ).toBe(false);
  });

  it('accepts support when one line keeps the full carrier passage intact', () => {
    expect(
      anchorSupportedByEvidenceLines('the reclining figure on the couch', [
        "The figure's white shirt against the dark couch creates the clearest focal break in the room.",
        'The reclining figure on the couch stays lower than the chair back and keeps the body read horizontal rather than upright.',
        'Light on the face and upper chest keeps that couch-bound body from sinking into the wall tone.',
      ])
    ).toBe(true);
  });

  it('rejects nearby figure language when no single line keeps the anchored passage intact', () => {
    expect(
      anchorSupportedByEvidenceLines('the seated figure against the tree trunk', [
        'The sitting figure stays tucked close to the bank and reads quieter than the standing companion farther right.',
        'A darker bark passage just behind one shoulder gives the silhouette some contrast.',
        'The yellow shirt stays brighter than the rocks below it.',
      ])
    ).toBe(false);
  });
});
