import { useCallback, useEffect, useRef, useState } from 'react';
import { compressDataUrl } from '../imageUtils';
import {
  filterPersistablePreviews,
  hasPreviewImage,
  mergePreviewIntoLastVersion,
} from '../previewMerge';
import { loadPaintingsAsync, savePaintings } from '../storage';
import type {
  CritiqueCategory,
  CritiqueResult,
  PaintingVersion,
  SavedPainting,
  SavedPreviewEdit,
} from '../types';

let nextId = Date.now();
function newId(): string {
  return `${nextId++}-${Math.random().toString(36).slice(2, 8)}`;
}

async function compressPreviewEdits(edits: SavedPreviewEdit[]): Promise<SavedPreviewEdit[]> {
  return Promise.all(
    edits.map(async (edit) => {
      if (!hasPreviewImage(edit)) return edit;
      try {
        const imageDataUrl = await compressDataUrl(edit.imageDataUrl, 720, 0.75);
        return { ...edit, imageDataUrl };
      } catch {
        return edit;
      }
    })
  );
}

export type PersistFlowInput = {
  step: string;
  mode: string;
  style: string;
  medium: string;
  workingTitle: string;
  imageDataUrl: string;
  critique: CritiqueResult;
  sessionPreviewEdits?: SavedPreviewEdit[];
  savedPaintingId?: string;
  targetPainting?: SavedPainting;
};

export type PaintingStorageActions = {
  paintings: SavedPainting[];
  storageReady: boolean;
  saveError: string | null;
  clearSaveError: () => void;
  studioSelectedId: string | null;
  setStudioSelectedId: (id: string | null) => void;
  persistResult: (
    flow: PersistFlowInput,
    opts?: { navigateToStudio?: boolean }
  ) => Promise<{ savedPaintingId: string; targetPainting: SavedPainting; navigateToStudio: boolean } | null>;
  appendStudioPreviewEdit: (
    paintingId: string,
    edit: SavedPreviewEdit
  ) => Promise<SavedPainting | null>;
  deletePainting: (id: string) => void;
  openPaintingFromHome: (id: string) => void;
};

export function usePaintingStorage(
  setTab: (tab: 'studio') => void
): PaintingStorageActions {
  const [paintings, setPaintings] = useState<SavedPainting[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const paintingsRef = useRef(paintings);
  paintingsRef.current = paintings;
  const skipNextSaveRef = useRef(true);
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadPaintingsAsync();
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setPaintings(loaded);
      } catch (e) {
        console.error('[usePaintingStorage] load failed', e);
        if (!cancelled) {
          skipNextSaveRef.current = true;
          setPaintings([]);
        }
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const generation = ++saveGenerationRef.current;
    void (async () => {
      try {
        await savePaintings(paintings);
        if (generation === saveGenerationRef.current) {
          setSaveError(null);
        }
      } catch (e) {
        console.error(e);
        if (generation === saveGenerationRef.current) {
          setSaveError(
            e instanceof Error
              ? e.message
              : 'Could not save your Studio library. Try removing an older project.'
          );
        }
      }
    })();
  }, [paintings, storageReady]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const persistResult = useCallback(
    async (flow: PersistFlowInput, opts?: { navigateToStudio?: boolean }) => {
      if (flow.step !== 'results') return null;
      const navigateToStudio = opts?.navigateToStudio !== false;
      const savedTitle =
        flow.workingTitle.trim() ||
        flow.critique.paintingTitle?.trim() ||
        undefined;
      const critiqueToStore: CritiqueResult = {
        ...flow.critique,
        ...(savedTitle ? { paintingTitle: savedTitle } : {}),
      };
      const sessionPreviews = await compressPreviewEdits(
        filterPersistablePreviews(flow.sessionPreviewEdits)
      );
      const version: PaintingVersion = {
        id: newId(),
        imageDataUrl: flow.imageDataUrl,
        createdAt: new Date().toISOString(),
        critique: critiqueToStore,
        ...(sessionPreviews.length ? { previewEdits: sessionPreviews } : {}),
      };

      const currentPaintings = paintingsRef.current;

      if (flow.mode === 'resubmit' && flow.targetPainting) {
        const t = flow.workingTitle.trim();
        const merged = mergePreviewIntoLastVersion(
          flow.targetPainting.versions,
          flow.imageDataUrl,
          critiqueToStore,
          sessionPreviews
        );
        const resolvedVersions = merged.merged
          ? merged.versions
          : [...flow.targetPainting.versions, version];
        setPaintings((ps) =>
          ps.map((p) =>
            p.id === flow.targetPainting!.id
              ? { ...p, ...(t.length > 0 ? { title: t } : {}), versions: resolvedVersions }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(flow.targetPainting.id);
          setTab('studio');
        }
        return {
          savedPaintingId: flow.targetPainting.id,
          targetPainting: {
            ...flow.targetPainting,
            ...(t.length > 0 ? { title: t } : {}),
            versions: resolvedVersions,
          },
          navigateToStudio,
        };
      }

      if (flow.savedPaintingId) {
        const t = flow.workingTitle.trim();
        const existingPainting = currentPaintings.find((p) => p.id === flow.savedPaintingId);
        let nextVersions: PaintingVersion[];
        if (existingPainting) {
          const m = mergePreviewIntoLastVersion(
            existingPainting.versions,
            flow.imageDataUrl,
            critiqueToStore,
            sessionPreviews
          );
          nextVersions = m.merged ? m.versions : [...existingPainting.versions, version];
        } else {
          nextVersions = [version];
        }
        setPaintings((ps) =>
          ps.map((p) =>
            p.id === flow.savedPaintingId
              ? { ...p, ...(t.length > 0 ? { title: t } : {}), versions: nextVersions }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(flow.savedPaintingId);
          setTab('studio');
        }
        const targetPainting: SavedPainting = existingPainting
          ? { ...existingPainting, ...(t.length > 0 ? { title: t } : {}), versions: nextVersions }
          : {
              id: flow.savedPaintingId,
              title:
                t.length > 0
                  ? t
                  : savedTitle ??
                    `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
              style: flow.style as SavedPainting['style'],
              medium: flow.medium as SavedPainting['medium'],
              versions: nextVersions,
            };
        return { savedPaintingId: flow.savedPaintingId, targetPainting, navigateToStudio };
      }

      const fromUser = flow.workingTitle.trim();
      const fromCritique = flow.critique.paintingTitle?.trim();
      const title =
        fromUser.length > 0
          ? fromUser
          : fromCritique && fromCritique.length > 0
            ? fromCritique
            : `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      const painting: SavedPainting = {
        id: newId(),
        title,
        style: flow.style as SavedPainting['style'],
        medium: flow.medium as SavedPainting['medium'],
        versions: [version],
      };
      setPaintings((ps) => [painting, ...ps]);
      if (navigateToStudio) {
        setStudioSelectedId(painting.id);
        setTab('studio');
      }
      return { savedPaintingId: painting.id, targetPainting: painting, navigateToStudio };
    },
    [setTab]
  );

  const appendStudioPreviewEdit = useCallback(
    async (paintingId: string, edit: SavedPreviewEdit): Promise<SavedPainting | null> => {
      if (!hasPreviewImage(edit)) return null;
      const [compressed] = await compressPreviewEdits([edit]);
      if (!compressed || !hasPreviewImage(compressed)) return null;

      const current = paintingsRef.current.find((p) => p.id === paintingId);
      if (!current?.versions.length) return null;
      const last = current.versions[current.versions.length - 1]!;
      const merged = mergePreviewIntoLastVersion(
        current.versions,
        last.imageDataUrl,
        last.critique,
        [compressed]
      );
      if (!merged.merged) return null;
      const updated: SavedPainting = { ...current, versions: merged.versions };
      setPaintings((ps) => ps.map((p) => (p.id === paintingId ? updated : p)));
      return updated;
    },
    []
  );

  const deletePainting = useCallback((id: string) => {
    setPaintings((ps) => ps.filter((p) => p.id !== id));
    setStudioSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const openPaintingFromHome = useCallback(
    (id: string) => {
      setStudioSelectedId(id);
      setTab('studio');
    },
    [setTab]
  );

  return {
    paintings,
    storageReady,
    saveError,
    clearSaveError,
    studioSelectedId,
    setStudioSelectedId,
    persistResult,
    appendStudioPreviewEdit,
    deletePainting,
    openPaintingFromHome,
  };
}

/** Re-export for Studio generate criterion typing convenience. */
export type StudioGenerateCriterion = CritiqueCategory['criterion'];
