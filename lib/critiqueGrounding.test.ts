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

  it('accepts equivalent seated/tree-trunk wording across distributed evidence lines', () => {
    expect(
      anchorSupportedByEvidenceLines('the seated figure against the tree trunk', [
        'The sitting figure stays tucked close to the tree, which keeps the body from floating away from the bank.',
        'A softer pose in the shoulders keeps that figure quieter than the standing companion farther right.',
        'The darker bark just behind the figure gives the silhouette enough contrast to stay legible.',
      ])
    ).toBe(true);
  });

  it('accepts reclining-figure couch anchors when pose and couch support are distributed across evidence lines', () => {
    expect(
      anchorSupportedByEvidenceLines('the reclining figure on the couch', [
        "The figure's white shirt against the dark couch creates the clearest focal break in the room.",
        'The angled pose of the torso and legs makes the body read as reclined rather than upright.',
        'Light on the face and upper chest keeps that couch-bound body from sinking into the wall tone.',
      ])
    ).toBe(true);
  });

  it('accepts human-carrier aggregate support when a seated figure anchor is restated through shirt and rocks language', () => {
    expect(
      anchorSupportedByEvidenceLines('the seated figure against the rocks', [
        "The seated figure's yellow shirt contrasts with the dark rocks, drawing attention.",
        'The relaxed posture keeps that body quieter than the standing companion nearby.',
        'The tree trunk behind the figure keeps the silhouette from floating loose.',
      ])
    ).toBe(true);
  });
});
