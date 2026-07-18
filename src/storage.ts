import { canonicalCriterionLabel } from '../shared/criteria';
import { adaptCritiqueResult } from './critiqueResultAdapter';
import { loadPaintingsFromDb, savePaintingsToDb } from './paintingDb';
import type { CritiqueCategory, CritiqueResult, SavedPainting, SavedPreviewEdit } from './types';

function migrateCritiqueCategory(category: CritiqueCategory): CritiqueCategory {
  const criterion = canonicalCriterionLabel(category.criterion);
  return criterion ? { ...category, criterion } : category;
}

function migrateCritiqueResult(critique: CritiqueResult): CritiqueResult {
  return adaptCritiqueResult({
    ...critique,
    categories: critique.categories.map(migrateCritiqueCategory),
  });
}

function migrateVersionPreviewEdits(version: {
  previewEdits?: SavedPreviewEdit[];
  previewEdit?: { imageDataUrl: string; criterion: string; studioChangeRecommendation?: string };
}): { previewEdits?: SavedPreviewEdit[]; previewEdit?: never } {
  const edits: SavedPreviewEdit[] = [...(version.previewEdits ?? [])];
  if (version.previewEdit && edits.length === 0) {
    const c = canonicalCriterionLabel(version.previewEdit.criterion);
    if (c) {
      edits.push({
        id: `legacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        imageDataUrl: version.previewEdit.imageDataUrl,
        criterion: c,
        mode: 'single',
        studioChangeRecommendation: version.previewEdit.studioChangeRecommendation,
      });
    }
  }
  const normalized = edits
    .map((e) => ({
      ...e,
      criterion: (canonicalCriterionLabel(e.criterion) ?? e.criterion) as SavedPreviewEdit['criterion'],
    }))
    .filter((e) => typeof e.imageDataUrl === 'string' && e.imageDataUrl.startsWith('data:'));
  return normalized.length ? { previewEdits: normalized } : {};
}

export function migratePainting(painting: SavedPainting): SavedPainting {
  return {
    ...painting,
    versions: painting.versions.map((version) => {
      const migratedPreviews = migrateVersionPreviewEdits(version);
      return {
        ...version,
        critique: migrateCritiqueResult(version.critique),
        ...migratedPreviews,
        previewEdit: undefined,
      };
    }),
  };
}

/** @deprecated Prefer loadPaintingsAsync — sync localStorage read for legacy callers/tests. */
export function loadPaintings(): SavedPainting[] {
  try {
    const raw = localStorage.getItem('artvision-pro-paintings-v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPainting[];
    return Array.isArray(parsed) ? parsed.map(migratePainting) : [];
  } catch {
    return [];
  }
}

export async function loadPaintingsAsync(): Promise<SavedPainting[]> {
  const raw = await loadPaintingsFromDb();
  return raw.map(migratePainting);
}

export async function savePaintings(paintings: SavedPainting[]): Promise<void> {
  await savePaintingsToDb(paintings);
}
