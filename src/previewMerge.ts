import { canonicalCriterionLabel } from '../shared/criteria';
import type { CritiqueResult, PaintingVersion, SavedPreviewEdit } from './types';

/** A preview is persistable only when it carries a real image payload. */
export function hasPreviewImage(
  edit: Partial<SavedPreviewEdit> | null | undefined
): edit is SavedPreviewEdit {
  if (!edit || typeof edit !== 'object') return false;
  const url = edit.imageDataUrl;
  return typeof url === 'string' && url.startsWith('data:') && url.length > 64;
}

function criterionKey(criterion: string): string {
  return canonicalCriterionLabel(criterion) ?? criterion;
}

/**
 * Merge session AI previews into the already-saved list for a version.
 *
 * Stripped Stripe-return stubs (metadata without `imageDataUrl`) must never
 * overwrite a good Studio preview. Incomplete session entries are skipped;
 * complete session entries replace the same criterion.
 */
export function mergePreviewEdits(
  existing: SavedPreviewEdit[] | undefined,
  session: Array<Partial<SavedPreviewEdit> | SavedPreviewEdit> | undefined
): SavedPreviewEdit[] {
  const byCriterion = new Map<string, SavedPreviewEdit>();
  for (const edit of existing ?? []) {
    if (!hasPreviewImage(edit)) continue;
    byCriterion.set(criterionKey(edit.criterion), edit);
  }
  for (const sp of session ?? []) {
    if (!hasPreviewImage(sp)) continue;
    byCriterion.set(criterionKey(sp.criterion), sp);
  }
  return Array.from(byCriterion.values());
}

/** Keep only session previews that still have image bytes. */
export function filterPersistablePreviews(
  session: Array<Partial<SavedPreviewEdit> | SavedPreviewEdit> | undefined
): SavedPreviewEdit[] {
  return (session ?? []).filter(hasPreviewImage);
}

/**
 * After a Stripe round-trip, session previews may have had `imageDataUrl`
 * stripped. Rehydrate them from the painting already saved in Studio when
 * possible; drop stubs that have no image anywhere.
 */
export function rehydrateSessionPreviewsFromSaved(
  session: Array<Partial<SavedPreviewEdit> | SavedPreviewEdit> | undefined,
  saved: SavedPreviewEdit[] | undefined
): SavedPreviewEdit[] {
  const savedByCriterion = new Map<string, SavedPreviewEdit>();
  for (const edit of saved ?? []) {
    if (!hasPreviewImage(edit)) continue;
    savedByCriterion.set(criterionKey(edit.criterion), edit);
  }

  const out: SavedPreviewEdit[] = [];
  const seen = new Set<string>();
  for (const sp of session ?? []) {
    if (!sp || typeof sp !== 'object') continue;
    const key = criterionKey(String(sp.criterion ?? ''));
    if (!key || seen.has(key)) continue;
    if (hasPreviewImage(sp)) {
      out.push(sp);
      seen.add(key);
      continue;
    }
    const fromSaved = savedByCriterion.get(key);
    if (fromSaved) {
      out.push(fromSaved);
      seen.add(key);
    }
  }
  return out;
}

export function mergePreviewIntoLastVersion(
  existingVersions: PaintingVersion[],
  imageDataUrl: string,
  critiqueToStore: CritiqueResult,
  sessionPreviews: Array<Partial<SavedPreviewEdit> | SavedPreviewEdit>
): { versions: PaintingVersion[]; merged: boolean } {
  if (!existingVersions.length) return { versions: existingVersions, merged: false };
  const last = existingVersions[existingVersions.length - 1]!;
  if (last.imageDataUrl !== imageDataUrl) return { versions: existingVersions, merged: false };

  const persistableSession = filterPersistablePreviews(sessionPreviews);
  if (!persistableSession.length && !(last.previewEdits ?? []).length) {
    return { versions: existingVersions, merged: false };
  }

  const mergedEdits = mergePreviewEdits(last.previewEdits, persistableSession);
  // If session had only stripped stubs, mergedEdits may equal existing — still
  // treat as a merge so we refresh critique text without appending a version.
  const next = existingVersions.slice(0, -1).concat({
    ...last,
    critique: critiqueToStore,
    ...(mergedEdits.length ? { previewEdits: mergedEdits } : { previewEdits: undefined }),
    previewEdit: undefined,
  });
  return { versions: next, merged: true };
}
