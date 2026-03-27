import { canonicalCriterionLabel } from '../shared/criteria';
import { migrateCritiqueSimpleFeedback } from './critiqueCoach';
import type { CritiqueCategory, CritiqueResult, SavedPainting, SavedPreviewEdit } from './types';

const KEY = 'artvision-pro-paintings-v1';

function migrateCritiqueCategory(category: CritiqueCategory): CritiqueCategory {
  const criterion = canonicalCriterionLabel(category.criterion);
  return criterion ? { ...category, criterion } : category;
}

function migrateCritiqueResult(critique: CritiqueResult): CritiqueResult {
  const simple =
    critique.simple !== undefined ? migrateCritiqueSimpleFeedback(critique.simple) : undefined;
  return {
    ...critique,
    categories: critique.categories.map(migrateCritiqueCategory),
    ...(simple ? { simple } : {}),
  };
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
  const normalized = edits.map((e) => ({
    ...e,
    criterion: canonicalCriterionLabel(e.criterion) ?? e.criterion,
  }));
  return normalized.length ? { previewEdits: normalized } : {};
}

function migratePainting(painting: SavedPainting): SavedPainting {
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

export function loadPaintings(): SavedPainting[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPainting[];
    return Array.isArray(parsed) ? parsed.map(migratePainting) : [];
  } catch {
    return [];
  }
}

export function savePaintings(paintings: SavedPainting[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(paintings));
  } catch (e) {
    console.error(e);
    throw new Error(
      'Could not save — storage may be full. Try removing an older project or using a smaller photo.'
    );
  }
}
