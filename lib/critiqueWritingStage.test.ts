import { describe, expect, it } from 'vitest';

import { normalizeKnownVoiceBVerbDrift, normalizeVoiceBMoveForSchema } from './critiqueWritingStage';

describe('normalizeKnownVoiceBVerbDrift', () => {
  it('rewrites generic color-transition enhancement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Enhance color transitions for greater cohesion throughout the painting.',
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: 'the muted color passages across the mourners' },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain('the muted color passages across the mourners');
  });

  it('rewrites generic presence enhancement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Enhance the distinctiveness of individual expressions for greater impact.',
      {
        criterion: 'Presence, point of view, and human force',
        anchor: { areaSummary: 'the varied expressions and postures of the figures' },
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('the varied expressions and postures of the figures');
  });

  it('rewrites generic color-strengthening language into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Strengthen the relational discipline of colors in selective passages to enhance cohesion.',
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: 'the muted color palette' },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain('the muted color palette');
  });

  it('rewrites generic value-transition refinement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      "Refine the transitions between the figures' clothing and the landscape to enhance separation.",
      {
        criterion: 'Value and light structure',
        anchor: { areaSummary: 'the contrast between the figures and the landscape' },
      }
    );

    expect(rewritten).toMatch(/^separate\b/i);
    expect(rewritten).toContain('the contrast between the figures and the landscape');
  });

  it('rewrites generic smooth-color-transition language into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      "Smooth the color transitions in the mourners' clothing, particularly where the muted tones meet the red of the clergy's robes.",
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: "the muted tones of the mourners' clothing" },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain("the muted tones of the mourners' clothing");
  });
});

describe('normalizeVoiceBMoveForSchema', () => {
  it('falls back to a valid edge-control move when the model says clarify', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Clarify the edges between the figures and the background to enhance focus hierarchy.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the edges between the figures and the background' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('the edges between the figures and the background');
  });

  it('falls back to a criterion-aware move when the starter verb is unsupported', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Emphasize the overlap between the front figures so the spacing feels firmer.',
      {
        criterion: 'Drawing, proportion, and spatial form',
        anchor: { areaSummary: 'the overlap between the front figures' },
        level: 'Advanced',
      }
    );

    expect(rewritten).toMatch(/^restate\b/i);
    expect(rewritten).toContain('the overlap between the front figures');
  });

  it('rewrites abstract focus language into a concrete edge relationship move', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Improve the focus hierarchy so the form reads more clearly.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the pale square against the off-white ground' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('edge');
    expect(rewritten).toContain('the pale square against the off-white ground');
  });
});
