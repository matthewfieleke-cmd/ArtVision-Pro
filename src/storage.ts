import { canonicalCriterionLabel } from '../shared/criteria';
import type { CritiqueCategory, CritiqueResult, SavedPainting } from './types';

const KEY = 'artvision-pro-paintings-v1';

function migrateCritiqueCategory(category: CritiqueCategory): CritiqueCategory {
  const criterion = canonicalCriterionLabel(category.criterion);
  return criterion ? { ...category, criterion } : category;
}

function migrateCritiqueResult(critique: CritiqueResult): CritiqueResult {
  return {
    ...critique,
    categories: critique.categories.map(migrateCritiqueCategory),
  };
}

function migratePainting(painting: SavedPainting): SavedPainting {
  return {
    ...painting,
    versions: painting.versions.map((version) => {
      const previewCriterion = version.previewEdit?.criterion
        ? canonicalCriterionLabel(version.previewEdit.criterion)
        : null;
      return {
        ...version,
        critique: migrateCritiqueResult(version.critique),
        ...(version.previewEdit
          ? {
              previewEdit: {
                ...version.previewEdit,
                criterion: previewCriterion ?? version.previewEdit.criterion,
              },
            }
          : {}),
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
