import { describe, expect, it } from 'vitest';

import { compactIntentForStorage, type ReturnViewIntent } from './navIntent';

/**
 * These tests pin the Stripe-round-trip storage compaction behavior.
 *
 * Context: before this change, `setReturnViewIntent` JSON-serialized the
 * critique flow straight into `localStorage` before the Stripe redirect.
 * Each previously-generated AI edit in the flow's `sessionPreviewEdits`
 * carries a multi-MB base64 data URL; 2–3 of those were enough to blow the
 * per-origin localStorage quota, at which point the write silently failed,
 * `consumeReturnViewIntent()` returned null on return, and the post-
 * payment preview-edit resume silently did nothing — the user landed on
 * Home with no AI image and no error toast.
 *
 * `compactIntentForStorage` strips the parts that are (a) session-only,
 * (b) not needed to run the freshly-paid preview-edit, and (c) most
 * likely to push us over the quota. These tests guard the exact strip
 * shape so a future refactor can't regress the quota-safety property.
 */

const FAKE_DATA_URL_A =
  'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const FAKE_DATA_URL_B =
  'data:image/png;base64,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function makeCritiqueIntent(
  sessionPreviewEdits: Array<Record<string, unknown>>
): ReturnViewIntent {
  return {
    kind: 'critique',
    flow: {
      step: 'results',
      mode: 'new',
      styleMode: 'manual',
      workingTitle: 'Untitled',
      style: 'Realism',
      medium: 'Oil on Canvas',
      imageDataUrl: FAKE_DATA_URL_A,
      originalImageDataUrl: FAKE_DATA_URL_A,
      critique: { summary: 'A painting.' },
      critiqueSource: 'api',
      sessionPreviewEdits,
    },
  };
}

describe('compactIntentForStorage', () => {
  it('returns studio intents unchanged', () => {
    const intent: ReturnViewIntent = {
      kind: 'studio',
      selectedPaintingId: 'abc123',
    };
    expect(compactIntentForStorage(intent)).toBe(intent);
  });

  it('returns critique intents unchanged when there are no session preview edits', () => {
    const intent = makeCritiqueIntent([]);
    expect(compactIntentForStorage(intent)).toBe(intent);
  });

  it('strips imageDataUrl from sessionPreviewEdits while preserving metadata', () => {
    const intent = makeCritiqueIntent([
      {
        id: 'edit-1',
        criterion: 'Composition and shape structure',
        mode: 'single',
        imageDataUrl: FAKE_DATA_URL_A,
      },
      {
        id: 'edit-2',
        criterion: 'Value and light structure',
        mode: 'single',
        imageDataUrl: FAKE_DATA_URL_B,
        studioChangeRecommendation: 'Darken the shadow side of the jaw.',
      },
    ]);

    const compact = compactIntentForStorage(intent);
    expect(compact.kind).toBe('critique');
    if (compact.kind !== 'critique') return;
    const flow = compact.flow as Record<string, unknown>;
    const stripped = flow.sessionPreviewEdits as Array<Record<string, unknown>>;
    expect(stripped).toHaveLength(2);
    expect(stripped[0]).toEqual({
      id: 'edit-1',
      criterion: 'Composition and shape structure',
      mode: 'single',
    });
    expect(stripped[1]).toEqual({
      id: 'edit-2',
      criterion: 'Value and light structure',
      mode: 'single',
      studioChangeRecommendation: 'Darken the shadow side of the jaw.',
    });
    // Crucial negative: no entry carries imageDataUrl any more.
    for (const entry of stripped) {
      expect('imageDataUrl' in entry).toBe(false);
    }
  });

  it('preserves the flow-level imageDataUrl so the preview-edit resume can re-run after return', () => {
    // The flow's own imageDataUrl is what gets sent to the AI-edit endpoint
    // when the user returns from Stripe. Stripping THIS would break the
    // very thing the post-payment resume is trying to do.
    const intent = makeCritiqueIntent([
      { id: 'edit-1', criterion: 'Edge and focus control', mode: 'single', imageDataUrl: FAKE_DATA_URL_A },
    ]);
    const compact = compactIntentForStorage(intent);
    expect(compact.kind).toBe('critique');
    if (compact.kind !== 'critique') return;
    const flow = compact.flow as Record<string, unknown>;
    expect(flow.imageDataUrl).toBe(FAKE_DATA_URL_A);
    expect(flow.originalImageDataUrl).toBe(FAKE_DATA_URL_A);
    expect(flow.style).toBe('Realism');
    expect(flow.medium).toBe('Oil on Canvas');
    expect(flow.critique).toBeDefined();
  });

  it('does not mutate the input intent', () => {
    const original = makeCritiqueIntent([
      { id: 'edit-1', criterion: 'Color relationships', mode: 'single', imageDataUrl: FAKE_DATA_URL_A },
    ]);
    const originalSessionEdits =
      original.kind === 'critique'
        ? (original.flow as Record<string, unknown>).sessionPreviewEdits
        : null;

    compactIntentForStorage(original);

    // Same array reference after compaction, still carries the data URL.
    expect(originalSessionEdits).toBeDefined();
    if (!Array.isArray(originalSessionEdits)) return;
    expect(
      (originalSessionEdits[0] as Record<string, unknown>).imageDataUrl
    ).toBe(FAKE_DATA_URL_A);
  });

  it('tolerates garbage flow shapes', () => {
    // If the flow isn't an object (e.g. malformed legacy data), return the
    // input as-is rather than throw.
    const intent: ReturnViewIntent = { kind: 'critique', flow: null as unknown };
    expect(compactIntentForStorage(intent)).toBe(intent);
  });
});
