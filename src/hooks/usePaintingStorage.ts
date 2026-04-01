import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPaintings, savePaintings } from '../storage';
import type {
  CritiqueResult,
  PaintingVersion,
  SavedPainting,
  SavedPreviewEdit,
} from '../types';

let nextId = Date.now();
function newId(): string {
  return `${nextId++}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergePreviewIntoLastVersion(
  existingVersions: PaintingVersion[],
  imageDataUrl: string,
  critiqueToStore: CritiqueResult,
  sessionPreviews: SavedPreviewEdit[]
): { versions: PaintingVersion[]; merged: boolean } {
  if (!existingVersions.length) return { versions: existingVersions, merged: false };
  const last = existingVersions[existingVersions.length - 1]!;
  if (last.imageDataUrl !== imageDataUrl) return { versions: existingVersions, merged: false };
  const existingEdits = last.previewEdits ?? [];
  const existingByCriterion = new Map(existingEdits.map((e) => [e.criterion, e]));
  for (const sp of sessionPreviews) existingByCriterion.set(sp.criterion, sp);
  const mergedEdits = Array.from(existingByCriterion.values());
  if (!mergedEdits.length) return { versions: existingVersions, merged: false };
  const next = existingVersions.slice(0, -1).concat({
    ...last,
    critique: critiqueToStore,
    previewEdits: mergedEdits,
    previewEdit: undefined,
  });
  return { versions: next, merged: true };
}

export type PaintingStorageActions = {
  paintings: SavedPainting[];
  studioSelectedId: string | null;
  setStudioSelectedId: (id: string | null) => void;
  persistResult: (
    flow: {
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
    },
    opts?: { navigateToStudio?: boolean }
  ) => { savedPaintingId: string; targetPainting: SavedPainting; navigateToStudio: boolean } | null;
  deletePainting: (id: string) => void;
  openPaintingFromHome: (id: string) => void;
};

export function usePaintingStorage(
  setTab: (tab: string) => void
): PaintingStorageActions {
  const [paintings, setPaintings] = useState<SavedPainting[]>(() => loadPaintings());
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      savePaintings(paintings);
    } catch (e) {
      console.error(e);
    }
  }, [paintings]);

  const persistResult = useCallback(
    (
      flow: {
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
      },
      opts?: { navigateToStudio?: boolean }
    ) => {
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
      const sessionPreviews = flow.sessionPreviewEdits ?? [];
      const version: PaintingVersion = {
        id: newId(),
        imageDataUrl: flow.imageDataUrl,
        createdAt: new Date().toISOString(),
        critique: critiqueToStore,
        ...(sessionPreviews.length ? { previewEdits: sessionPreviews } : {}),
      };

      if (flow.mode === 'resubmit' && flow.targetPainting) {
        const t = flow.workingTitle.trim();
        const merged = sessionPreviews.length
          ? mergePreviewIntoLastVersion(
              flow.targetPainting.versions,
              flow.imageDataUrl,
              critiqueToStore,
              sessionPreviews
            )
          : { versions: flow.targetPainting.versions, merged: false };
        const nextVersions = merged.merged
          ? merged.versions
          : [...flow.targetPainting.versions, version];
        setPaintings((ps) =>
          ps.map((p) =>
            p.id === flow.targetPainting!.id
              ? { ...p, ...(t.length > 0 ? { title: t } : {}), versions: nextVersions }
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
            versions: nextVersions,
          },
          navigateToStudio,
        };
      }

      if (flow.savedPaintingId) {
        const t = flow.workingTitle.trim();
        const existingPainting = paintings.find((p) => p.id === flow.savedPaintingId);
        let nextVersions: PaintingVersion[];
        if (sessionPreviews.length && existingPainting) {
          const m = mergePreviewIntoLastVersion(
            existingPainting.versions,
            flow.imageDataUrl,
            critiqueToStore,
            sessionPreviews
          );
          nextVersions = m.merged ? m.versions : [...existingPainting.versions, version];
        } else if (existingPainting) {
          nextVersions = [...existingPainting.versions, version];
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
                t.length > 0 ? t : savedTitle ?? `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
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
    [paintings, setTab]
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
    studioSelectedId,
    setStudioSelectedId,
    persistResult,
    deletePainting,
    openPaintingFromHome,
  };
}
