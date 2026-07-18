import { describe, expect, it } from 'vitest';
import {
  filterPersistablePreviews,
  hasPreviewImage,
  mergePreviewEdits,
  mergePreviewIntoLastVersion,
  rehydrateSessionPreviewsFromSaved,
} from './previewMerge';
import type { CritiqueResult, PaintingVersion, SavedPreviewEdit } from './types';

const DATA_A =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';
const DATA_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function edit(
  criterion: SavedPreviewEdit['criterion'],
  imageDataUrl?: string,
  id = 'e1'
): SavedPreviewEdit | Partial<SavedPreviewEdit> {
  return {
    id,
    criterion,
    mode: 'single' as const,
    ...(imageDataUrl ? { imageDataUrl } : {}),
  };
}

const emptyCritique = { categories: [], summary: '' } as unknown as CritiqueResult;

describe('hasPreviewImage', () => {
  it('accepts data-URL previews', () => {
    expect(hasPreviewImage(edit('Composition and shape structure', DATA_A) as SavedPreviewEdit)).toBe(
      true
    );
  });

  it('rejects stripped / empty previews', () => {
    expect(hasPreviewImage(edit('Composition and shape structure'))).toBe(false);
    expect(hasPreviewImage({ id: 'x', criterion: 'Color relationships', mode: 'single', imageDataUrl: '' })).toBe(
      false
    );
    expect(hasPreviewImage(null)).toBe(false);
  });
});

describe('mergePreviewEdits', () => {
  it('does not let stripped session stubs overwrite saved images', () => {
    const existing = [
      edit('Composition and shape structure', DATA_A, 'saved') as SavedPreviewEdit,
    ];
    const session = [edit('Composition and shape structure', undefined, 'stripped')];
    const merged = mergePreviewEdits(existing, session);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.imageDataUrl).toBe(DATA_A);
    expect(merged[0]!.id).toBe('saved');
  });

  it('lets a complete session preview replace the same criterion', () => {
    const existing = [
      edit('Composition and shape structure', DATA_A, 'old') as SavedPreviewEdit,
    ];
    const session = [
      edit('Composition and shape structure', DATA_B, 'new') as SavedPreviewEdit,
    ];
    const merged = mergePreviewEdits(existing, session);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.imageDataUrl).toBe(DATA_B);
    expect(merged[0]!.id).toBe('new');
  });

  it('adds a new criterion without dropping others', () => {
    const existing = [
      edit('Composition and shape structure', DATA_A, 'a') as SavedPreviewEdit,
    ];
    const session = [
      edit('Value and light structure', DATA_B, 'b') as SavedPreviewEdit,
    ];
    const merged = mergePreviewEdits(existing, session);
    expect(merged).toHaveLength(2);
  });
});

describe('rehydrateSessionPreviewsFromSaved', () => {
  it('restores image bytes from Studio after Stripe strip', () => {
    const saved = [edit('Edge and focus control', DATA_A, 'studio') as SavedPreviewEdit];
    const session = [edit('Edge and focus control', undefined, 'stripped')];
    const out = rehydrateSessionPreviewsFromSaved(session, saved);
    expect(out).toHaveLength(1);
    expect(out[0]!.imageDataUrl).toBe(DATA_A);
  });

  it('drops stubs that have no Studio image either', () => {
    const out = rehydrateSessionPreviewsFromSaved(
      [edit('Color relationships')],
      []
    );
    expect(out).toHaveLength(0);
  });
});

describe('mergePreviewIntoLastVersion', () => {
  it('merges without appending a version when the photo matches', () => {
    const versions: PaintingVersion[] = [
      {
        id: 'v1',
        imageDataUrl: DATA_A,
        createdAt: '2026-01-01T00:00:00.000Z',
        critique: emptyCritique,
        previewEdits: [edit('Composition and shape structure', DATA_A, 'old') as SavedPreviewEdit],
      },
    ];
    const result = mergePreviewIntoLastVersion(
      versions,
      DATA_A,
      emptyCritique,
      [
        edit('Composition and shape structure'), // stripped — must not wipe
        edit('Value and light structure', DATA_B, 'new') as SavedPreviewEdit,
      ]
    );
    expect(result.merged).toBe(true);
    expect(result.versions).toHaveLength(1);
    const edits = result.versions[0]!.previewEdits ?? [];
    expect(edits).toHaveLength(2);
    const comp = edits.find((e) => e.criterion === 'Composition and shape structure');
    expect(comp?.imageDataUrl).toBe(DATA_A);
  });
});

describe('filterPersistablePreviews', () => {
  it('keeps only entries with images', () => {
    const out = filterPersistablePreviews([
      edit('Composition and shape structure', DATA_A) as SavedPreviewEdit,
      edit('Color relationships'),
    ]);
    expect(out).toHaveLength(1);
  });
});
