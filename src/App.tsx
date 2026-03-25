import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import {
  ArrowLeft,
  Camera,
  FolderOpen,
  Home,
  ImagePlus,
  Loader2,
  Palette,
  Save,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { DesktopSidebar } from './components/DesktopSidebar';
import { CritiquePanels } from './components/CritiquePanels';
import { ImageCropModal } from './components/ImageCropModal';
import { PreviewEditBlendCard } from './components/PreviewEditBlendCard';
import { PreviewCompareOverlay } from './components/PreviewCompareOverlay';
import { analyzePainting } from './analyzePainting';
import { fetchCritiqueFromApi, shouldTryApiFirst } from './critiqueApi';
import { fetchPreviewEdit } from './previewEditApi';
import { fetchClassifyStyleFromApi } from './classifyStyleApi';
import { classifyStyleFromMetrics } from './classifyStyleHeuristic';
import { compressDataUrl, fileToDataUrl } from './imageUtils';
import { computeImageMetrics } from './imageMetrics';
import { useCameraCapture } from './hooks/useCameraCapture';
import { useIsDesktop } from './hooks/useIsDesktop';
import { advanceDailyMasterpieceIndex } from './dailyMasterpieceCycle';
import { clearReturnViewIntent, consumeReturnTabIntent, consumeReturnViewIntent, setReturnViewIntent } from './navIntent';
import { loadPaintings, savePaintings } from './storage';
import { BenchmarksTab } from './screens/BenchmarksTab';
import { HomeTab } from './screens/HomeTab';
import { ProfileTab } from './screens/ProfileTab';
import { StudioTab } from './screens/StudioTab';
import type {
  CritiqueCategory,
  CritiqueResult,
  Medium,
  PaintingVersion,
  SavedPainting,
  Style,
  TabId,
  WizardStep,
} from './types';
import { MEDIUMS, RATING_LEVELS, STYLES } from './types';

type StyleMode = 'manual' | 'auto';
type CropSource = 'gallery' | 'camera-file' | 'live-camera' | 'classify-upload';
type CropAction = 'analyze' | 'classify';

type FlowState = {
  step: WizardStep;
  styleMode: StyleMode;
  style: Style | null;
  medium: Medium | null;
  /** Optional title for this work (new critique or override on resubmit) */
  workingTitle: string;
  /** Original full-resolution source, preserved for preview edits. */
  originalImageDataUrl?: string;
  imageDataUrl?: string;
  critique?: CritiqueResult;
  critiqueSource?: 'api' | 'local';
  /** After auto style: vision or heuristic note */
  styleClassifyMeta?: { rationale: string; source: 'api' | 'local' };
  /** Photo uploaded for “Categorize for me”—reuse for critique without capture step */
  classifySourceImageDataUrl?: string;
  mode: 'new' | 'resubmit';
  targetPainting?: SavedPainting;
  /** After the critique has been saved once, track the studio record so later saves update it. */
  savedPaintingId?: string;
};

type PendingCrop = {
  imageSrc: string;
  source: CropSource;
  action: CropAction;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function priorityCritiqueCategory(categories: CritiqueCategory[]): CritiqueCategory {
  const rank = (l: (typeof RATING_LEVELS)[number]) => RATING_LEVELS.indexOf(l);
  return categories.reduce((a, b) => (rank(a.level) <= rank(b.level) ? a : b));
}

/** When preview is generated after save, merge into the last version instead of appending a duplicate. */
function mergePreviewIntoLastVersion(
  versions: PaintingVersion[],
  flowImageDataUrl: string,
  critiqueToStore: CritiqueResult,
  previewImageDataUrl: string,
  previewCriterion: CritiqueCategory['criterion']
): { versions: PaintingVersion[]; merged: boolean } {
  const last = versions[versions.length - 1];
  if (!last || last.imageDataUrl !== flowImageDataUrl) {
    return { versions, merged: false };
  }
  const next = versions.slice(0, -1);
  next.push({
    ...last,
    critique: critiqueToStore,
    previewEdit: {
      imageDataUrl: previewImageDataUrl,
      criterion: previewCriterion,
    },
  });
  return { versions: next, merged: true };
}

export default function App() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<TabId>('home');
  const [paintings, setPaintings] = useState<SavedPainting[]>(() => loadPaintings());
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const pendingCropRef = useRef<PendingCrop | null>(null);
  pendingCropRef.current = pendingCrop;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewImageDataUrl, setPreviewImageDataUrl] = useState<string | null>(null);
  const [previewCompareOpen, setPreviewCompareOpen] = useState(false);
  /** After user opens compare once for this preview, show a compact link instead of the full tap prompt. */
  const [previewCompareSeen, setPreviewCompareSeen] = useState(false);

  const { videoRef, status: camStatus, error: camError, start: startCamera, stop: stopCamera, captureFrame } =
    useCameraCapture();

  const flowScrollRef = useRef<HTMLDivElement>(null);
  const hadFlowRef = useRef(false);

  /** Mobile: main tabs scroll with the window — reset when switching tab (not in critique flow). */
  useLayoutEffect(() => {
    if (isDesktop || flow) return;
    window.scrollTo(0, 0);
  }, [isDesktop, tab, flow]);

  /** Mobile: opening or closing the full-screen critique flow — reset underlying page scroll. */
  useLayoutEffect(() => {
    if (isDesktop) return;
    const now = !!flow;
    if (now !== hadFlowRef.current) {
      hadFlowRef.current = now;
      window.scrollTo(0, 0);
    }
  }, [isDesktop, flow]);

  /** Mobile critique overlay uses its own scroll container; reset on each wizard step. */
  useLayoutEffect(() => {
    if (isDesktop || !flow) return;
    flowScrollRef.current?.scrollTo(0, 0);
  }, [isDesktop, flow, flow?.step]);

  useEffect(() => {
    try {
      savePaintings(paintings);
    } catch (e) {
      console.error(e);
    }
  }, [paintings]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    const returnView = consumeReturnViewIntent();
    if (returnView?.kind === 'critique' && returnView.flow) {
      setFlow(returnView.flow as FlowState);
      setAnalyzeError(null);
      setPreviewCompareOpen(false);
      return;
    }
    if (returnView?.kind === 'studio') {
      setFlow(null);
      setStudioSelectedId(returnView.selectedPaintingId);
      setTab('studio');
      return;
    }
    const intent = consumeReturnTabIntent();
    if (intent === 'benchmarks') setTab('benchmarks');
  }, [location.pathname, location.key]);

  const closeFlow = useCallback(() => {
    clearReturnViewIntent();
    stopCamera();
    setPendingCrop(null);
    setFlow(null);
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewImageDataUrl(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
  }, [stopCamera]);

  const goHome = useCallback(() => {
    clearReturnViewIntent();
    advanceDailyMasterpieceIndex();
    stopCamera();
    setPendingCrop(null);
    setFlow(null);
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewImageDataUrl(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setTab('home');
  }, [stopCamera]);

  const startNewCritique = useCallback(() => {
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewImageDataUrl(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setFlow({
      mode: 'new',
      step: 'setup',
      styleMode: 'manual',
      style: null,
      medium: null,
      workingTitle: '',
    });
  }, []);

  const startResubmit = useCallback((p: SavedPainting) => {
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewImageDataUrl(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    stopCamera();
    setFlow({
      mode: 'resubmit',
      step: 'capture',
      styleMode: 'manual',
      style: p.style,
      medium: p.medium,
      workingTitle: p.title,
      targetPainting: p,
    });
    setTab('studio');
  }, [stopCamera]);

  useEffect(() => {
    if (flow?.step === 'capture' && !isDesktop) {
      void startCamera();
      return () => stopCamera();
    }
    stopCamera();
  }, [flow?.step, isDesktop, startCamera, stopCamera]);

  const runAnalysis = useCallback(async (rawDataUrl: string) => {
    const f = flowRef.current;
    if (!f?.style || !f.medium) return;
    setAnalyzeError(null);
    setFlow((cur) => (cur ? { ...cur, step: 'analyzing', imageDataUrl: rawDataUrl } : cur));
    try {
      const compressed = await compressDataUrl(rawDataUrl);
      const prev =
        f.mode === 'resubmit' && f.targetPainting
          ? f.targetPainting.versions[f.targetPainting.versions.length - 1]
          : undefined;
      let critique: CritiqueResult;
      let critiqueSource: 'api' | 'local' = 'local';
      const prevPayload =
        prev
          ? {
              imageDataUrl: await compressDataUrl(prev.imageDataUrl),
              critique: prev.critique,
            }
          : undefined;

      const titleForCritique = f.workingTitle.trim();
      const titleArg = titleForCritique.length > 0 ? titleForCritique : undefined;

      if (shouldTryApiFirst()) {
        try {
          critique = await fetchCritiqueFromApi({
            style: f.style,
            medium: f.medium,
            imageDataUrl: compressed,
            ...(titleArg ? { paintingTitle: titleArg } : {}),
            ...(prevPayload
              ? {
                  previousImageDataUrl: prevPayload.imageDataUrl,
                  previousCritique: prevPayload.critique,
                }
              : {}),
          });
          critiqueSource = 'api';
        } catch (err) {
          console.warn('Critique API unavailable, using local analysis:', err);
          critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
          critiqueSource = 'local';
        }
      } else {
        critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
        critiqueSource = 'local';
      }

      setPreviewImageDataUrl(null);
      setPreviewError(null);
      setPreviewCompareOpen(false);
      setPreviewCompareSeen(false);
      setFlow((cur) =>
        cur
          ? {
              ...cur,
              step: 'results',
              imageDataUrl: compressed,
              critique,
              critiqueSource,
            }
          : cur
      );
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed');
      setFlow((cur) =>
        cur
          ? {
              ...cur,
              step: cur.classifySourceImageDataUrl ? 'setup' : 'capture',
            }
          : cur
      );
    }
  }, []);

  const runClassifyStyle = useCallback(async (rawDataUrl: string) => {
    setClassifyBusy(true);
    setAnalyzeError(null);
    try {
      const compressed = await compressDataUrl(rawDataUrl);
      let style: Style;
      let rationale: string;
      let source: 'api' | 'local';

      if (shouldTryApiFirst()) {
        try {
          const r = await fetchClassifyStyleFromApi(compressed);
          style = r.style;
          rationale = r.rationale;
          source = 'api';
        } catch (err) {
          console.warn('Classify API unavailable, using heuristic:', err);
          const metrics = await computeImageMetrics(compressed);
          const h = classifyStyleFromMetrics(metrics);
          style = h.style;
          rationale = h.rationale;
          source = 'local';
        }
      } else {
        const metrics = await computeImageMetrics(compressed);
        const h = classifyStyleFromMetrics(metrics);
        style = h.style;
        rationale = h.rationale;
        source = 'local';
      }

      setFlow((cur) =>
        cur
          ? {
              ...cur,
              style,
              styleClassifyMeta: { rationale, source },
              classifySourceImageDataUrl: compressed,
            }
          : cur
      );
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Could not detect style');
    } finally {
      setClassifyBusy(false);
    }
  }, []);

  const openCropperForImage = useCallback(
    (imageSrc: string, source: CropSource) => {
      if (!flowRef.current) return;
      stopCamera();
      setAnalyzeError(null);
      setPendingCrop({ imageSrc, source, action: 'analyze' });
      setFlow((cur) => (cur ? { ...cur, step: 'capture' } : cur));
    },
    [stopCamera]
  );

  const onCropConfirm = useCallback(
    async (croppedImage: string) => {
      const action = pendingCropRef.current?.action ?? 'analyze';
      setPendingCrop(null);
      if (action === 'classify') {
        await runClassifyStyle(croppedImage);
      } else {
        await runAnalysis(croppedImage);
      }
    },
    [runAnalysis, runClassifyStyle]
  );

  const onCropCancel = useCallback(() => {
    setPendingCrop(null);
  }, []);

  const onPickFile = useCallback(
    async (file: File | null, source: CropSource = 'gallery') => {
      if (!file || !flow) return;
      const url = await fileToDataUrl(file);
      openCropperForImage(url, source);
    },
    [flow, openCropperForImage]
  );

  const onPickFileForClassify = useCallback(
    async (file: File | null) => {
      if (!file || !flowRef.current || flowRef.current.step !== 'setup') return;
      setAnalyzeError(null);
      const url = await fileToDataUrl(file);
      stopCamera();
      setPendingCrop({ imageSrc: url, source: 'gallery', action: 'classify' });
    },
    [stopCamera]
  );

  const onShutter = useCallback(async () => {
    const shot = captureFrame();
    if (!shot) {
      setAnalyzeError('Could not read from camera. Try upload.');
      return;
    }
    openCropperForImage(shot, 'live-camera');
  }, [captureFrame, openCropperForImage]);

  const persistResult = useCallback(
    (opts?: { navigateToStudio?: boolean }) => {
      const navigateToStudio = opts?.navigateToStudio !== false;
      if (!flow?.critique || !flow.imageDataUrl || !flow.style || !flow.medium) return;
      const savedTitle =
        flow.workingTitle.trim() ||
        flow.critique.paintingTitle?.trim() ||
        undefined;
      const critiqueToStore: CritiqueResult = {
        ...flow.critique,
        ...(savedTitle ? { paintingTitle: savedTitle } : {}),
      };
      const priorityCat = priorityCritiqueCategory(flow.critique.categories);
      const version = {
        id: newId(),
        imageDataUrl: flow.imageDataUrl,
        createdAt: new Date().toISOString(),
        critique: critiqueToStore,
        ...(previewImageDataUrl
          ? {
              previewEdit: {
                imageDataUrl: previewImageDataUrl,
                criterion: priorityCat.criterion,
              },
            }
          : {}),
      };
      if (flow.mode === 'resubmit' && flow.targetPainting) {
        const t = flow.workingTitle.trim();
        const merged = previewImageDataUrl
          ? mergePreviewIntoLastVersion(
              flow.targetPainting.versions,
              flow.imageDataUrl,
              critiqueToStore,
              previewImageDataUrl,
              priorityCat.criterion
            )
          : { versions: flow.targetPainting.versions, merged: false };
        const nextVersions = merged.merged
          ? merged.versions
          : [...flow.targetPainting.versions, version];
        setPaintings((ps) =>
          ps.map((p) =>
            p.id === flow.targetPainting!.id
              ? {
                  ...p,
                  ...(t.length > 0 ? { title: t } : {}),
                  versions: nextVersions,
                }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(flow.targetPainting.id);
          setTab('studio');
        }
        setFlow((cur) =>
          cur
            ? {
                ...cur,
                mode: 'resubmit',
                targetPainting:
                  cur.targetPainting
                    ? {
                        ...cur.targetPainting,
                        ...(t.length > 0 ? { title: t } : {}),
                        versions: nextVersions,
                      }
                    : cur.targetPainting,
                savedPaintingId: flow.targetPainting?.id,
              }
            : cur
        );
        return;
      }

      if (flow.savedPaintingId) {
        const t = flow.workingTitle.trim();
        const existingPainting = paintings.find((p) => p.id === flow.savedPaintingId);

        let nextVersions: PaintingVersion[];
        if (previewImageDataUrl && existingPainting) {
          const m = mergePreviewIntoLastVersion(
            existingPainting.versions,
            flow.imageDataUrl,
            critiqueToStore,
            previewImageDataUrl,
            priorityCat.criterion
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
              ? {
                  ...p,
                  ...(t.length > 0 ? { title: t } : {}),
                  versions: nextVersions,
                }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(flow.savedPaintingId);
          setTab('studio');
        }
        setFlow((cur) => {
          if (!cur || !cur.style || !cur.medium) return cur;
          const targetPainting =
            cur.targetPainting && cur.targetPainting.id === flow.savedPaintingId
              ? {
                  ...cur.targetPainting,
                  ...(t.length > 0 ? { title: t } : {}),
                  versions: nextVersions,
                }
              : {
                  id: flow.savedPaintingId!,
                  title:
                    t.length > 0
                      ? t
                      : savedTitle && savedTitle.length > 0
                        ? savedTitle
                        : `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                  style: cur.style,
                  medium: cur.medium,
                  versions: nextVersions,
                };
          return {
            ...cur,
            mode: 'resubmit',
            targetPainting,
            savedPaintingId: flow.savedPaintingId,
          };
        });
        return;
      } else {
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
          style: flow.style,
          medium: flow.medium,
          versions: [version],
        };
        setPaintings((ps) => [painting, ...ps]);
        if (navigateToStudio) {
          setStudioSelectedId(painting.id);
          setTab('studio');
        }
        setFlow((cur) =>
          cur
            ? {
                ...cur,
                mode: 'resubmit',
                targetPainting: painting,
                savedPaintingId: painting.id,
              }
            : cur
        );
      }
    },
    [flow, paintings, previewImageDataUrl]
  );

  const persistResultRef = useRef(persistResult);
  persistResultRef.current = persistResult;

  const lastAutoPreviewSaveRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewImageDataUrl) {
      lastAutoPreviewSaveRef.current = null;
    }
  }, [previewImageDataUrl]);

  /** When preview finishes for a work already in Studio, persist (merge preview into last version) without leaving results. */
  useEffect(() => {
    if (previewLoading || !previewImageDataUrl) return;
    const f = flowRef.current;
    if (!f?.critique || f.step !== 'results') return;
    const hasStudio = f.mode === 'resubmit' || f.savedPaintingId != null;
    if (!hasStudio) return;
    if (lastAutoPreviewSaveRef.current === previewImageDataUrl) return;
    lastAutoPreviewSaveRef.current = previewImageDataUrl;
    persistResultRef.current({ navigateToStudio: false });
  }, [previewImageDataUrl, previewLoading]);

  const deletePainting = useCallback((id: string) => {
    setPaintings((ps) => ps.filter((p) => p.id !== id));
    setStudioSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const openPaintingFromHome = useCallback((id: string) => {
    setStudioSelectedId(id);
    setTab('studio');
  }, []);

  const canContinueFromSetup =
    flow &&
    flow.medium &&
    (flow.styleMode === 'manual' ? flow.style !== null : flow.style !== null && !classifyBusy);

  const canRunCritiqueFromClassifyUpload =
    Boolean(
      flow?.styleMode === 'auto' &&
        flow.classifySourceImageDataUrl &&
        flow.style &&
        flow.medium &&
        !classifyBusy
    );

  const priorityCategory = useMemo(() => {
    if (!flow?.critique?.categories.length) return null;
    return priorityCritiqueCategory(flow.critique.categories);
  }, [flow?.critique]);

  const rememberCritiqueReturn = useCallback(() => {
    const current = flowRef.current;
    if (current?.step === 'results' && current.critique && current.imageDataUrl) {
      setReturnViewIntent({ kind: 'critique', flow: current });
      return;
    }
    if (tab === 'studio' && studioSelectedId) {
      setReturnViewIntent({ kind: 'studio', selectedPaintingId: studioSelectedId });
      return;
    }
    clearReturnViewIntent();
  }, [studioSelectedId, tab]);

  const runPreviewEdit = useCallback(async () => {
    if (!flow?.imageDataUrl || !flow.style || !flow.medium || !priorityCategory) return;
    const previewSource = flow.originalImageDataUrl ?? flow.imageDataUrl;
    if (!shouldTryApiFirst()) {
      setPreviewError('Connect the API (deploy with OPENAI_API_KEY) to generate previews.');
      return;
    }
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { imageDataUrl } = await fetchPreviewEdit({
        imageDataUrl: previewSource,
        style: flow.style,
        medium: flow.medium,
        target: {
          criterion: priorityCategory.criterion,
          level: priorityCategory.level,
          feedback: priorityCategory.feedback,
          actionPlan: priorityCategory.actionPlan,
        },
      });
      setPreviewImageDataUrl(imageDataUrl);
      setPreviewCompareOpen(false);
      setPreviewCompareSeen(false);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, [flow?.imageDataUrl, flow?.medium, flow?.originalImageDataUrl, flow?.style, priorityCategory]);

  const openPreviewCompare = useCallback(() => {
    setPreviewCompareOpen(true);
    setPreviewCompareSeen(true);
  }, []);

  const handleTabChange = useCallback(
    (t: TabId) => {
      if (t === 'home') advanceDailyMasterpieceIndex();
      setTab(t);
    },
    []
  );

  const handleBottomNavCritique = useCallback(() => {
    setTab('home');
    startNewCritique();
  }, [startNewCritique]);

  /** Leaving a critique via the desktop rail must close the flow so the chosen tab is visible. */
  const handleDesktopSidebarChange = useCallback(
    (t: TabId) => {
      if (flowRef.current) closeFlow();
      if (t === 'home') advanceDailyMasterpieceIndex();
      setTab(t);
    },
    [closeFlow]
  );

  return (
    <div
      className={
        isDesktop
          ? 'flex h-dvh flex-col overflow-hidden bg-slate-50'
          : 'min-h-[100dvh] bg-slate-50'
      }
    >
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <DesktopSidebar active={tab} onChange={handleDesktopSidebarChange} />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4 lg:px-10 lg:py-5">
              {!flow && tab === 'home' && (
                <HomeTab
                  paintings={paintings}
                  onNewCritique={startNewCritique}
                  onOpenPainting={openPaintingFromHome}
                  isDesktop
                />
              )}
              {!flow && tab === 'studio' && (
                <StudioTab
                  paintings={paintings}
                  selectedId={studioSelectedId}
                  onSelectPainting={setStudioSelectedId}
                  onBack={goHome}
                  onDelete={deletePainting}
                  onResubmit={startResubmit}
                  isDesktop
                />
              )}
              {!flow && tab === 'benchmarks' && <BenchmarksTab isDesktop />}
              {!flow && tab === 'profile' && <ProfileTab isDesktop />}
            </div>
          </main>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white px-4 py-3 shadow-soft backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="mx-auto flex max-w-lg items-center justify-between">
              <button
                type="button"
                onClick={goHome}
                className="-ml-1 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-100/80"
                aria-label="Go to home"
              >
                <p className="font-display text-xl font-normal tracking-tight text-slate-900">
                  ArtVision <span className="text-violet-600">Pro</span>
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Painting mentor</p>
              </button>
              {flow ? (
                <button
                  type="button"
                  onClick={closeFlow}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <Sparkles className="h-6 w-6 text-violet-500" aria-hidden />
              )}
            </div>
          </header>

          <main className="mx-auto max-w-lg">
            {!flow && tab === 'home' && (
              <HomeTab
                paintings={paintings}
                onNewCritique={startNewCritique}
                onOpenPainting={openPaintingFromHome}
                isDesktop={false}
              />
            )}
            {!flow && tab === 'studio' && (
              <StudioTab
                paintings={paintings}
                selectedId={studioSelectedId}
                onSelectPainting={setStudioSelectedId}
                onBack={goHome}
                onDelete={deletePainting}
                onResubmit={startResubmit}
                isDesktop={false}
              />
            )}
            {!flow && tab === 'benchmarks' && <BenchmarksTab />}
            {!flow && tab === 'profile' && <ProfileTab />}
          </main>

          {!flow && (
            <BottomNav
              active={tab}
              onChange={handleTabChange}
              onStartCritique={handleBottomNavCritique}
            />
          )}
        </>
      )}

      {flow && (
        <>
        <div
          className={`fixed z-40 flex min-h-0 flex-col overflow-hidden bg-slate-50 ${
            isDesktop ? 'inset-y-0 left-60 right-0' : 'inset-0 pt-[env(safe-area-inset-top)]'
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 shadow-soft backdrop-blur-sm">
            {!isDesktop && flow.step === 'results' ? (
              <button
                type="button"
                onClick={goHome}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Go to home"
              >
                <Home className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (flow.step === 'setup') closeFlow();
                  else if (flow.step === 'capture') {
                    if (flow.mode === 'resubmit') closeFlow();
                    else setFlow({ ...flow, step: 'setup' });
                  } else if (flow.step === 'results') {
                    const backToSetup =
                      flow.mode === 'new' &&
                      flow.styleMode === 'auto' &&
                      flow.style &&
                      flow.styleClassifyMeta &&
                      flow.imageDataUrl;
                    clearReturnViewIntent();
                    setFlow({
                      ...flow,
                      step: backToSetup ? 'setup' : 'capture',
                      ...(backToSetup ? { classifySourceImageDataUrl: flow.imageDataUrl } : {}),
                    });
                  } else closeFlow();
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <p className="flex-1 text-center text-sm font-semibold text-slate-700">
              {flow.step === 'setup' && 'Style & medium'}
              {flow.step === 'capture' && (isDesktop ? 'Upload your painting' : 'Capture')}
              {flow.step === 'analyzing' && 'Analyzing'}
              {flow.step === 'results' && 'Critique'}
            </p>
            <span className="w-9 shrink-0" />
          </div>

          <div
            ref={flowScrollRef}
            className={`min-h-0 flex-1 overflow-y-auto pb-6 pt-4 ${
              isDesktop ? 'w-full px-8 lg:px-12' : 'px-4 pb-8 pt-5'
            }`}
          >
            {flow.step === 'setup' && (
              <div className="animate-slide-up space-y-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Style</p>
                  <div className="mt-2 flex gap-1 rounded-xl bg-slate-100/90 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setFlow((f) =>
                          f
                            ? {
                                ...f,
                                styleMode: 'manual',
                                styleClassifyMeta: undefined,
                                classifySourceImageDataUrl: undefined,
                              }
                            : f
                        )
                      }
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                        flow.styleMode === 'manual'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      I’ll choose
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFlow((f) =>
                          f
                            ? {
                                ...f,
                                styleMode: 'auto',
                                style: null,
                                styleClassifyMeta: undefined,
                                classifySourceImageDataUrl: undefined,
                              }
                            : f
                        )
                      }
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
                        flow.styleMode === 'auto'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Wand2 className="h-4 w-4 shrink-0" />
                      Categorize for me
                    </button>
                  </div>

                  {flow.styleMode === 'manual' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {STYLES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFlow((f) => (f ? { ...f, style: s } : f))}
                          className={`rounded-2xl border px-3 py-3.5 text-left text-sm font-semibold transition ${
                            flow.style === s
                              ? 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20'
                              : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-4 py-8 transition hover:border-violet-300 hover:bg-violet-50">
                        {classifyBusy ? (
                          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        ) : (
                          <Wand2 className="h-8 w-8 text-violet-500" />
                        )}
                        <span className="text-center text-sm font-semibold text-slate-800">
                          {classifyBusy ? 'Analyzing your painting…' : 'Upload a photo to detect style'}
                        </span>
                        <span className="text-center text-xs text-slate-500">
                          We match Realism, Impressionism, Expressionism, or Abstract from the image.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={classifyBusy}
                          onChange={(e) => void onPickFileForClassify(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {flow.style && flow.styleClassifyMeta ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                          {flow.classifySourceImageDataUrl ? (
                            <div className="mb-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                              <img
                                src={flow.classifySourceImageDataUrl}
                                alt=""
                                className="max-h-40 w-full object-contain object-center"
                              />
                            </div>
                          ) : null}
                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                            Suggested style
                          </p>
                          <p className="mt-1 font-display text-xl text-slate-900">{flow.style}</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {flow.styleClassifyMeta.rationale}
                          </p>
                          {flow.styleClassifyMeta.source === 'local' ? (
                            <p className="mt-2 text-xs text-amber-700">
                              Quick estimate from color and brushwork signals. Connect the API for a vision-based match.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Medium</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {MEDIUMS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFlow((f) => (f ? { ...f, medium: m } : f))}
                        className={`rounded-2xl border px-3 py-3.5 text-left text-sm font-semibold transition ${
                          flow.medium === m
                            ? 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20'
                            : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="working-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Title <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="working-title"
                    type="text"
                    maxLength={120}
                    value={flow.workingTitle}
                    onChange={(e) => setFlow((f) => (f ? { ...f, workingTitle: e.target.value } : f))}
                    placeholder="e.g. Morning light on the harbor"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Shown on your critique and saved with the painting. Leave blank for an auto title.
                  </p>
                </div>

                {canRunCritiqueFromClassifyUpload ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const src = flow.classifySourceImageDataUrl;
                        if (src) void runAnalysis(src);
                      }}
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition active:scale-[0.99]"
                    >
                      Run critique on this photo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFlow((f) =>
                          f
                            ? {
                                ...f,
                                step: 'capture',
                                classifySourceImageDataUrl: undefined,
                              }
                            : f
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      {isDesktop ? 'Upload a different photo' : 'Use camera or a different photo'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canContinueFromSetup}
                    onClick={() => setFlow((f) => (f ? { ...f, step: 'capture' } : f))}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition enabled:active:scale-[0.99] disabled:opacity-35"
                  >
                    {isDesktop ? 'Continue to upload' : 'Continue to capture'}
                  </button>
                )}
              </div>
            )}

            {flow.step === 'capture' && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <label htmlFor="capture-working-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Title <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="capture-working-title"
                    type="text"
                    maxLength={120}
                    value={flow.workingTitle}
                    onChange={(e) => setFlow((f) => (f ? { ...f, workingTitle: e.target.value } : f))}
                    placeholder="Name this piece for the critique"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                    autoComplete="off"
                  />
                </div>

                {isDesktop ? (
                  <label
                    className={`group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 transition ${
                      dragOver
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20'
                        : 'border-slate-300 bg-white hover:border-violet-400 hover:bg-violet-50/30'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file?.type.startsWith('image/')) void onPickFile(file);
                    }}
                  >
                    <div className={`rounded-2xl p-4 transition ${dragOver ? 'bg-violet-200' : 'bg-violet-100'}`}>
                      <Upload className="h-10 w-10 text-violet-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-slate-800">
                        {dragOver ? 'Drop your image here' : 'Click to upload your painting'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        or drag and drop an image file here
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Supports JPG, PNG, WebP
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  /* ── Mobile: live camera viewfinder ── */
                  <>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-card">
                      <video
                        ref={videoRef}
                        className="h-full w-full object-cover"
                        playsInline
                        muted
                        autoPlay
                      />
                      {camStatus !== 'live' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 p-4 text-center text-sm text-slate-200">
                          {camStatus === 'requesting' ? (
                            <>
                              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                              Starting camera…
                            </>
                          ) : (
                            <>
                              <Camera className="h-8 w-8 text-slate-500" />
                              <p>{camError ?? 'Camera unavailable — use Photos below.'}</p>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <p className="text-center text-xs text-slate-500">
                      Align the canvas in frame. Even, diffuse light gives the fairest read.
                    </p>
                  </>
                )}

                {analyzeError ? (
                  <p className="text-center text-sm text-red-600">{analyzeError}</p>
                ) : null}

                {!isDesktop && (
                  <div
                    className={`grid grid-cols-1 gap-2 ${camStatus === 'live' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
                  >
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                      <FolderOpen className="h-5 w-5 text-violet-600" />
                      Photos
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {camStatus !== 'live' ? (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                        <ImagePlus className="h-5 w-5 text-violet-600" />
                        Take photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onShutter()}
                      disabled={camStatus !== 'live'}
                      className="rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-35"
                    >
                      Capture
                    </button>
                  </div>
                )}

                <p className="text-center text-[11px] text-slate-400">
                  {flow.style} · {flow.medium}
                  {flow.mode === 'resubmit' ? ' · comparing to saved version' : ''}
                </p>
              </div>
            )}

            {flow.step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
                <p className="text-sm text-slate-500">
                  {shouldTryApiFirst()
                    ? 'Consulting the vision model—usually 15–45s…'
                    : 'Mapping value, edges, color, and surface…'}
                </p>
              </div>
            )}

            {flow.step === 'results' && flow.critique && flow.imageDataUrl && (
              <div
                className={`animate-fade-in space-y-4 pb-8 ${
                  isDesktop
                    ? 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start md:gap-8 md:space-y-0 md:pb-4'
                    : ''
                }`}
              >
                <div className="space-y-4">
                  <div>
                    <label htmlFor="results-working-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Title for this work
                    </label>
                    <input
                      id="results-working-title"
                      type="text"
                      maxLength={120}
                      value={flow.workingTitle}
                      onChange={(e) => setFlow((f) => (f ? { ...f, workingTitle: e.target.value } : f))}
                      placeholder="Optional — used when you save to Studio"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                    <img
                      src={flow.imageDataUrl}
                      alt=""
                      className={`w-full object-contain bg-slate-100 ${isDesktop ? 'max-h-[min(52vh,28rem)] md:max-h-[min(58vh,32rem)]' : 'max-h-56'}`}
                    />
                  </div>
                  {flow.critiqueSource === 'local' ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
                      Offline / fallback critique (heuristic). Set{' '}
                      <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">OPENAI_API_KEY</code> and run{' '}
                      <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">npm run dev</code> (API + UI) for
                      full vision feedback.
                    </p>
                  ) : null}
                </div>
                <div className="min-h-0 space-y-4">
                {priorityCategory ? (
                  <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                          Suggested change preview
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          Focus: {priorityCategory.criterion}{' '}
                          <span className="font-normal text-slate-500">({priorityCategory.level})</span>
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          One AI-edited example toward your next level in this area—interpretation only, not a
                          substitute for painting.
                        </p>
                      </div>
                      <Palette className="h-8 w-8 shrink-0 text-violet-500" aria-hidden />
                    </div>
                    <button
                      type="button"
                      disabled={previewLoading}
                      onClick={() => void runPreviewEdit()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-400 disabled:text-white"
                      style={{
                        WebkitFontSmoothing: 'antialiased',
                        transform: 'translateZ(0)',
                        WebkitTransform: 'translateZ(0)',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
                        {previewLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </span>
                      <span className="inline-flex min-w-0 items-center justify-center">
                        {previewLoading
                          ? 'Generating preview…'
                          : previewImageDataUrl
                            ? 'Regenerate preview'
                            : 'Generate preview'}
                      </span>
                    </button>
                    {previewError ? (
                      <p className="mt-2 text-center text-xs text-red-600">{previewError}</p>
                    ) : null}
                    {previewImageDataUrl && priorityCategory ? (
                      isDesktop ? (
                        <div className="mt-4 min-h-0 border-t border-violet-200/60 pt-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Illustrative result
                          </p>
                          <div className="mt-3">
                            <PreviewEditBlendCard
                              originalSrc={flow.imageDataUrl}
                              revisedSrc={previewImageDataUrl}
                              target={priorityCategory}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={openPreviewCompare}
                            className="mt-4 w-full rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50"
                          >
                            Open full-screen compare
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Illustrative result
                          </p>
                          <button
                            type="button"
                            onClick={openPreviewCompare}
                            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-white px-4 py-6 text-center shadow-sm transition hover:border-violet-400 hover:bg-violet-50/50 active:scale-[0.99]"
                          >
                            <span className="text-sm font-bold text-violet-800">
                              {previewCompareSeen ? 'Open compare again' : 'Tap to compare with your photo'}
                            </span>
                            {!previewCompareSeen ? (
                              <span className="text-xs font-medium leading-snug text-slate-500">
                                Scroll to see your image, the AI preview, and what changed.
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Your photo and the AI preview, with notes.</span>
                            )}
                          </button>
                        </div>
                      )
                    ) : null}
                  </section>
                ) : null}
                <CritiquePanels critique={flow.critique} onLearnMore={rememberCritiqueReturn} />
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => persistResult()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25"
                  >
                    <Save className="h-5 w-5" />
                    {flow.mode === 'resubmit' ? 'Save new version' : 'Save to studio'}
                  </button>
                  <button
                    type="button"
                    onClick={closeFlow}
                    className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Discard
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {previewCompareOpen &&
        flow.step === 'results' &&
        flow.imageDataUrl &&
        previewImageDataUrl &&
        priorityCategory ? (
          <PreviewCompareOverlay
            originalSrc={flow.imageDataUrl}
            revisedSrc={previewImageDataUrl}
            target={priorityCategory}
            onClose={() => setPreviewCompareOpen(false)}
          />
        ) : null}
        {pendingCrop ? (
          <ImageCropModal
            imageSrc={pendingCrop.imageSrc}
            onCancel={onCropCancel}
            onConfirm={onCropConfirm}
          />
        ) : null}
        </>
      )}
      <Analytics />
    </div>
  );
}
