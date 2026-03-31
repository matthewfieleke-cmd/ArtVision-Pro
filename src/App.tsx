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
  Save,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { canonicalCriterionLabel, previewEditChipText, previewEditChipTitle } from '../shared/criteria';
import { BottomNav } from './components/BottomNav';
import { DesktopSidebar } from './components/DesktopSidebar';
import { CritiquePanels } from './components/CritiquePanels';
import { ImageCropModal } from './components/ImageCropModal';
import { PreviewEditBlendCard } from './components/PreviewEditBlendCard';
import { PreviewCompareOverlay } from './components/PreviewCompareOverlay';
import {
  ANALYSIS_HIDDEN_RETRY_MS,
  isAbortError,
  requestScreenWakeLock,
  type WakeLockHandle,
} from './analysisKeepAlive';
import { analyzePainting } from './analyzePainting';
import { fetchCritiqueFromApi, shouldTryApiFirst } from './critiqueApi';
import { fetchPreviewEdit } from './previewEditApi';
import { fetchClassifyStyleFromApi } from './classifyStyleApi';
import { fetchClassifyMediumFromApi } from './classifyMediumApi';
import { classifyMediumFromMetrics } from './classifyMediumHeuristic';
import { classifyStyleFromMetrics } from './classifyStyleHeuristic';
import {
  applyDetectedStyle,
  backFromCapture,
  backFromResults,
  beginAnalysis,
  canContinueFromSetup,
  chooseMedium,
  chooseStyle,
  clearClassifySource,
  completeAnalysis,
  createNewFlow,
  createResubmitFlow,
  enterCapture,
  isCritiqueFlow,
  recoverFromAnalysisError,
  switchToAutoStyle,
  switchToManualStyle,
  updateWorkingTitle,
  type CritiqueFlow,
} from './critiqueFlow';
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
  SavedPreviewEdit,
  Style,
  TabId,
} from './types';
import { MEDIUMS, RATING_LEVELS, STYLES } from './types';
type CropSource = 'gallery' | 'camera-file' | 'live-camera' | 'classify-upload';
type CropAction = 'analyze' | 'classify';

type PendingCrop = {
  imageSrc: string;
  source: CropSource;
  action: CropAction;
};

type PreviewEditTargetPayload = Pick<
  CritiqueCategory,
  'criterion' | 'level' | 'feedback' | 'actionPlan' | 'anchor' | 'editPlan'
> & {
  studioChangeRecommendation?: string;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Cycles . … …… after “Analyzing” in the flow header while the critique runs. */
function AnalyzingHeaderEllipsis() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);
  const dots = phase === 0 ? '' : phase === 1 ? '.' : phase === 2 ? '..' : '...';
  return (
    <span className="inline-block min-w-[1.35em] text-left" aria-hidden>
      {dots}
    </span>
  );
}

function priorityCritiqueCategory(categories: CritiqueCategory[]): CritiqueCategory {
  const rank = (l: (typeof RATING_LEVELS)[number]) => RATING_LEVELS.indexOf(l);
  const safeRank = (category: CritiqueCategory) =>
    category.level ? rank(category.level) : Number.POSITIVE_INFINITY;
  return categories.reduce((a, b) => (safeRank(a) <= safeRank(b) ? a : b));
}

/** When saving after preview, merge into the last version instead of appending a duplicate. */
function mergePreviewIntoLastVersion(
  versions: PaintingVersion[],
  flowImageDataUrl: string,
  critiqueToStore: CritiqueResult,
  previewEdits: SavedPreviewEdit[]
): { versions: PaintingVersion[]; merged: boolean } {
  const last = versions[versions.length - 1];
  if (!last || last.imageDataUrl !== flowImageDataUrl) {
    return { versions, merged: false };
  }
  const next = versions.slice(0, -1);
  const existing = last.previewEdits ?? [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const e of previewEdits) byId.set(e.id, e);
  const mergedEdits = [...byId.values()];
  next.push({
    ...last,
    critique: critiqueToStore,
    ...(mergedEdits.length ? { previewEdits: mergedEdits } : {}),
    previewEdit: undefined,
  });
  return { versions: next, merged: true };
}

function previewDisplayTarget(
  flow: CritiqueFlow,
  activePreviewEditId: string | null
): PreviewEditTargetPayload | null {
  if (flow.step !== 'results' || !flow.critique.categories.length) return null;
  const catList = flow.critique.categories;
  const session = flow.sessionPreviewEdits ?? [];
  const active = activePreviewEditId ? session.find((e) => e.id === activePreviewEditId) : undefined;
  if (active) {
    const cat =
      catList.find((c) => c.criterion === active.criterion) ?? priorityCritiqueCategory(catList);
    return {
      criterion: active.criterion,
      level: cat.level,
      feedback: cat.feedback,
      actionPlan: cat.actionPlan,
      anchor: cat.anchor,
      editPlan: cat.editPlan,
      studioChangeRecommendation: active.studioChangeRecommendation,
    };
  }
  const changes = flow.critique.simple?.studioChanges;
  if (changes && changes.length > 0) {
    const ch = changes[0]!;
    const cat =
      catList.find((c) => c.criterion === ch.previewCriterion) ?? priorityCritiqueCategory(catList);
    return {
      criterion: ch.previewCriterion,
      level: cat.level,
      feedback: cat.feedback,
      actionPlan: cat.actionPlan,
      anchor: cat.anchor,
      editPlan: cat.editPlan,
      studioChangeRecommendation: ch.text,
    };
  }
  const p = priorityCritiqueCategory(catList);
  return {
    criterion: p.criterion,
    level: p.level,
    feedback: p.feedback,
    actionPlan: p.actionPlan,
    anchor: p.anchor,
    editPlan: p.editPlan,
  };
}

export default function App() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<TabId>('home');
  const [paintings, setPaintings] = useState<SavedPainting[]>(() => loadPaintings());
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const [flow, setFlow] = useState<CritiqueFlow | null>(null);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const pendingCropRef = useRef<PendingCrop | null>(null);
  pendingCropRef.current = pendingCrop;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Which generate action is in flight so only that button shows a spinner. */
  const [previewLoadingTarget, setPreviewLoadingTarget] = useState<null | { kind: 'single'; criterion: CritiqueCategory['criterion'] }>(
    null
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  /** Which generated preview is shown in the blend card / compare overlay. */
  const [activePreviewEditId, setActivePreviewEditId] = useState<string | null>(null);
  const [previewCompareOpen, setPreviewCompareOpen] = useState(false);
  /** After user opens compare once for this preview, show a compact link instead of the full tap prompt. */
  const [previewCompareSeen, setPreviewCompareSeen] = useState(false);
  const [analysisRetryNotice, setAnalysisRetryNotice] = useState(false);
  const [titleAppliedToast, setTitleAppliedToast] = useState(false);
  const titleToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisHiddenAtRef = useRef<number | null>(null);
  const analysisRetryUsedRef = useRef(false);
  /** True only when abort() was triggered from the visibility resume path (eligible for one API retry). */
  const analysisVisibilityAbortRef = useRef(false);
  const analysisWakeRef = useRef<WakeLockHandle | null>(null);
  const analysisRunTokenRef = useRef(0);

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
    if (returnView?.kind === 'critique' && isCritiqueFlow(returnView.flow)) {
      setFlow(returnView.flow);
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

  const cancelAnalysisKeepAlive = useCallback(() => {
    analysisRunTokenRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    void analysisWakeRef.current?.release().catch(() => {});
    analysisWakeRef.current = null;
    analysisHiddenAtRef.current = null;
    analysisRetryUsedRef.current = false;
    analysisVisibilityAbortRef.current = false;
    setAnalysisRetryNotice(false);
  }, []);

  const closeFlow = useCallback(() => {
    clearReturnViewIntent();
    stopCamera();
    cancelAnalysisKeepAlive();
    setPendingCrop(null);
    setFlow(null);
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setActivePreviewEditId(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setPreviewLoadingTarget(null);
  }, [stopCamera, cancelAnalysisKeepAlive]);

  const goHome = useCallback(() => {
    clearReturnViewIntent();
    advanceDailyMasterpieceIndex();
    stopCamera();
    cancelAnalysisKeepAlive();
    setPendingCrop(null);
    setFlow(null);
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setActivePreviewEditId(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setPreviewLoadingTarget(null);
    setTab('home');
  }, [stopCamera, cancelAnalysisKeepAlive]);

  const startNewCritique = useCallback(() => {
    cancelAnalysisKeepAlive();
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setActivePreviewEditId(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setPreviewLoadingTarget(null);
    setFlow(createNewFlow());
  }, [cancelAnalysisKeepAlive]);

  const startResubmit = useCallback((p: SavedPainting) => {
    cancelAnalysisKeepAlive();
    setAnalyzeError(null);
    setClassifyBusy(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setActivePreviewEditId(null);
    setPreviewCompareOpen(false);
    setPreviewCompareSeen(false);
    setPreviewLoadingTarget(null);
    stopCamera();
    setFlow(createResubmitFlow(p));
    setTab('studio');
  }, [stopCamera, cancelAnalysisKeepAlive]);

  useEffect(() => {
    if (flow?.step === 'capture' && !isDesktop) {
      void startCamera();
      return () => stopCamera();
    }
    stopCamera();
  }, [flow?.step, isDesktop, startCamera, stopCamera]);

  const runAnalysis = useCallback(async (rawDataUrl: string) => {
    const f = flowRef.current;
    if (!f || (f.step !== 'setup' && f.step !== 'capture')) return;
    if (!f.style || !f.medium) return;
    const startedFlow = beginAnalysis(f, rawDataUrl);
    if (!startedFlow) return;
    const runId = ++analysisRunTokenRef.current;
    setAnalyzeError(null);
    setAnalysisRetryNotice(false);
    setFlow(startedFlow);

    analysisAbortRef.current?.abort();
    const ac = new AbortController();
    analysisAbortRef.current = ac;
    analysisHiddenAtRef.current = null;
    analysisRetryUsedRef.current = false;
    analysisVisibilityAbortRef.current = false;

    void analysisWakeRef.current?.release().catch(() => {});
    analysisWakeRef.current = null;
    const wl = await requestScreenWakeLock();
    if (runId === analysisRunTokenRef.current) {
      analysisWakeRef.current = wl;
    } else {
      void wl?.release().catch(() => {});
    }

    const releaseWakeIfCurrent = () => {
      if (runId !== analysisRunTokenRef.current) return;
      void analysisWakeRef.current?.release().catch(() => {});
      analysisWakeRef.current = null;
    };

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

      const apiBody = {
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
      };

      if (shouldTryApiFirst()) {
        const attemptApi = async (signal: AbortSignal): Promise<CritiqueResult> =>
          fetchCritiqueFromApi({ ...apiBody, signal });

        try {
          critique = await attemptApi(ac.signal);
          critiqueSource = 'api';
        } catch (err) {
          const visibilityRetry =
            isAbortError(err) &&
            analysisVisibilityAbortRef.current &&
            !analysisRetryUsedRef.current &&
            runId === analysisRunTokenRef.current;

          if (visibilityRetry) {
            analysisVisibilityAbortRef.current = false;
            analysisRetryUsedRef.current = true;
            setAnalysisRetryNotice(true);
            const ac2 = new AbortController();
            analysisAbortRef.current = ac2;
            try {
              critique = await attemptApi(ac2.signal);
              critiqueSource = 'api';
            } catch (err2) {
              console.warn('Critique API unavailable after resume retry, using local analysis:', err2);
              critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
              critiqueSource = 'local';
            }
          } else if (isAbortError(err)) {
            analysisVisibilityAbortRef.current = false;
            critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
            critiqueSource = 'local';
          } else {
            analysisVisibilityAbortRef.current = false;
            console.warn('Critique API unavailable, using local analysis:', err);
            critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
            critiqueSource = 'local';
          }
        }
      } else {
        critique = await analyzePainting(compressed, f.style, f.medium, prevPayload, titleArg);
        critiqueSource = 'local';
      }

      if (runId !== analysisRunTokenRef.current) return;

      setActivePreviewEditId(null);
      setPreviewError(null);
      setPreviewCompareOpen(false);
      setPreviewCompareSeen(false);
      setPreviewLoadingTarget(null);
      setFlow(completeAnalysis(startedFlow, { imageDataUrl: compressed, critique, critiqueSource }));
    } catch (e) {
      if (runId !== analysisRunTokenRef.current) return;
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed');
      setFlow(recoverFromAnalysisError(startedFlow));
    } finally {
      if (runId === analysisRunTokenRef.current) {
        analysisAbortRef.current = null;
      }
      releaseWakeIfCurrent();
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (flowRef.current?.step === 'analyzing') {
          analysisHiddenAtRef.current = Date.now();
        }
        return;
      }
      if (document.visibilityState !== 'visible') return;
      if (flowRef.current?.step !== 'analyzing') {
        analysisHiddenAtRef.current = null;
        return;
      }
      if (!shouldTryApiFirst()) return;
      const hiddenAt = analysisHiddenAtRef.current;
      if (hiddenAt == null) return;
      const elapsed = Date.now() - hiddenAt;
      analysisHiddenAtRef.current = null;
      if (elapsed < ANALYSIS_HIDDEN_RETRY_MS) return;
      if (analysisRetryUsedRef.current) return;
      const ac = analysisAbortRef.current;
      if (!ac) return;
      analysisVisibilityAbortRef.current = true;
      ac.abort();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const runClassifyStyle = useCallback(async (rawDataUrl: string) => {
    setClassifyBusy(true);
    setAnalyzeError(null);
    try {
      const compressed = await compressDataUrl(rawDataUrl);
      let style: Style;
      let styleRationale: string;
      let styleSource: 'api' | 'local';
      let detectedMedium: Medium | undefined;
      let mediumRationale: string | undefined;
      let mediumSource: 'api' | 'local' | undefined;

      if (shouldTryApiFirst()) {
        try {
          const [styleRead, mediumRead] = await Promise.all([
            fetchClassifyStyleFromApi(compressed),
            fetchClassifyMediumFromApi(compressed).catch(() => null),
          ]);
          style = styleRead.style;
          styleRationale = styleRead.rationale;
          styleSource = 'api';
          if (mediumRead) {
            detectedMedium = mediumRead.medium;
            mediumRationale = mediumRead.rationale;
            mediumSource = 'api';
          } else {
            const metrics = await computeImageMetrics(compressed);
            const hm = classifyMediumFromMetrics(metrics);
            detectedMedium = hm.medium;
            mediumRationale = hm.rationale;
            mediumSource = 'local';
          }
        } catch (err) {
          console.warn('Classify API unavailable, using heuristic:', err);
          const metrics = await computeImageMetrics(compressed);
          const h = classifyStyleFromMetrics(metrics);
          style = h.style;
          styleRationale = h.rationale;
          styleSource = 'local';
          const hm = classifyMediumFromMetrics(metrics);
          detectedMedium = hm.medium;
          mediumRationale = hm.rationale;
          mediumSource = 'local';
        }
      } else {
        const metrics = await computeImageMetrics(compressed);
        const h = classifyStyleFromMetrics(metrics);
        style = h.style;
        styleRationale = h.rationale;
        styleSource = 'local';
        const hm = classifyMediumFromMetrics(metrics);
        detectedMedium = hm.medium;
        mediumRationale = hm.rationale;
        mediumSource = 'local';
      }

      setFlow((cur) => {
        if (cur?.step !== 'setup') return cur;
        return applyDetectedStyle(cur, {
          style,
          rationale: styleRationale,
          source: styleSource,
          imageDataUrl: compressed,
          ...(detectedMedium && mediumRationale && mediumSource
            ? {
                detectedMedium,
                mediumRationale,
                ...(mediumSource !== styleSource ? { mediumSource } : {}),
              }
            : {}),
        });
      });
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Could not detect style');
    } finally {
      setClassifyBusy(false);
    }
  }, []);

  const openCropperForImage = useCallback(
    (imageSrc: string, source: CropSource) => {
      const current = flowRef.current;
      if (!current) return;
      stopCamera();
      setAnalyzeError(null);
      setPendingCrop({ imageSrc, source, action: 'analyze' });
      if (current.step === 'setup') {
        const capture = enterCapture(current);
        if (capture) setFlow(capture);
      }
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
      if (!flow || flow.step !== 'results') return;
      const resultFlow = flow;
      const savedTitle =
        resultFlow.workingTitle.trim() ||
        resultFlow.critique.paintingTitle?.trim() ||
        undefined;
      const critiqueToStore: CritiqueResult = {
        ...resultFlow.critique,
        ...(savedTitle ? { paintingTitle: savedTitle } : {}),
      };
      const sessionPreviews = resultFlow.sessionPreviewEdits ?? [];
      const version = {
        id: newId(),
        imageDataUrl: resultFlow.imageDataUrl,
        createdAt: new Date().toISOString(),
        critique: critiqueToStore,
        ...(sessionPreviews.length ? { previewEdits: sessionPreviews } : {}),
      };
      if (resultFlow.mode === 'resubmit') {
        const t = resultFlow.workingTitle.trim();
        const merged = sessionPreviews.length
          ? mergePreviewIntoLastVersion(
              resultFlow.targetPainting.versions,
              resultFlow.imageDataUrl,
              critiqueToStore,
              sessionPreviews
            )
          : { versions: resultFlow.targetPainting.versions, merged: false };
        const nextVersions = merged.merged
          ? merged.versions
          : [...resultFlow.targetPainting.versions, version];
        setPaintings((ps) =>
          ps.map((p) =>
            p.id === resultFlow.targetPainting.id
              ? {
                  ...p,
                  ...(t.length > 0 ? { title: t } : {}),
                  versions: nextVersions,
                }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(resultFlow.targetPainting.id);
          setTab('studio');
        }
        setFlow((cur) => {
          if (!cur || cur.step !== 'results' || cur.mode !== 'resubmit') return cur;
          return {
            ...cur,
            targetPainting: {
              ...cur.targetPainting,
              ...(t.length > 0 ? { title: t } : {}),
              versions: nextVersions,
            },
            savedPaintingId: resultFlow.targetPainting.id,
          };
        });
        return;
      }

      if (resultFlow.savedPaintingId) {
        const t = resultFlow.workingTitle.trim();
        const existingPainting = paintings.find((p) => p.id === resultFlow.savedPaintingId);

        let nextVersions: PaintingVersion[];
        if (sessionPreviews.length && existingPainting) {
          const m = mergePreviewIntoLastVersion(
            existingPainting.versions,
            resultFlow.imageDataUrl,
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
            p.id === resultFlow.savedPaintingId
              ? {
                  ...p,
                  ...(t.length > 0 ? { title: t } : {}),
                  versions: nextVersions,
                }
              : p
          )
        );
        if (navigateToStudio) {
          setStudioSelectedId(resultFlow.savedPaintingId);
          setTab('studio');
        }
        setFlow((cur) => {
          if (!cur || cur.step !== 'results') return cur;
          const targetPainting =
            cur.mode === 'resubmit' && cur.targetPainting.id === resultFlow.savedPaintingId
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
            savedPaintingId: resultFlow.savedPaintingId,
          };
        });
        return;
      } else {
        const fromUser = resultFlow.workingTitle.trim();
        const fromCritique = resultFlow.critique.paintingTitle?.trim();
        const title =
          fromUser.length > 0
            ? fromUser
            : fromCritique && fromCritique.length > 0
              ? fromCritique
              : `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        const painting: SavedPainting = {
          id: newId(),
          title,
          style: resultFlow.style,
          medium: resultFlow.medium,
          versions: [version],
        };
        setPaintings((ps) => [painting, ...ps]);
        if (navigateToStudio) {
          setStudioSelectedId(painting.id);
          setTab('studio');
        }
        setFlow((cur) =>
          cur && cur.step === 'results'
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
    [flow, paintings]
  );

  const persistResultRef = useRef(persistResult);
  persistResultRef.current = persistResult;

  const lastAutoPreviewSaveRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flow || flow.step !== 'results') {
      lastAutoPreviewSaveRef.current = null;
      return;
    }
    const list = flow.sessionPreviewEdits ?? [];
    const sig = list.map((e) => e.id).join('|');
    if (!sig) lastAutoPreviewSaveRef.current = null;
  }, [flow]);

  /** When preview finishes for a work already in Studio, persist (merge previews into last version) without leaving results. */
  useEffect(() => {
    if (previewLoading) return;
    const f = flowRef.current;
    if (!f || f.step !== 'results') return;
    const list = f.sessionPreviewEdits ?? [];
    if (!list.length) return;
    const hasStudio = f.mode === 'resubmit' || f.savedPaintingId != null;
    if (!hasStudio) return;
    const sig = list.map((e) => e.id).join('|');
    if (lastAutoPreviewSaveRef.current === sig) return;
    lastAutoPreviewSaveRef.current = sig;
    persistResultRef.current({ navigateToStudio: false });
  }, [flow, previewLoading]);

  const deletePainting = useCallback((id: string) => {
    setPaintings((ps) => ps.filter((p) => p.id !== id));
    setStudioSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const openPaintingFromHome = useCallback((id: string) => {
    setStudioSelectedId(id);
    setTab('studio');
  }, []);

  const canRunCritiqueFromClassifyUpload =
    Boolean(
      flow?.styleMode === 'auto' &&
        flow.classifySourceImageDataUrl &&
        flow.style &&
        flow.medium &&
        !classifyBusy
    );

  /** Auto-classify finished: style + medium detection shown; simplify setup to Style/Medium grids + Run Critique. */
  const postAutoClassifySetup =
    Boolean(
      flow?.step === 'setup' &&
        flow.styleMode === 'auto' &&
        flow.styleClassifyMeta &&
        flow.mediumClassifyMeta &&
        flow.style &&
        flow.medium
    );

  const previewTarget = useMemo(
    () => (flow ? previewDisplayTarget(flow, activePreviewEditId) : null),
    [flow, activePreviewEditId]
  );

  const activePreviewImageDataUrl = useMemo(() => {
    if (!flow || flow.step !== 'results' || !activePreviewEditId) return null;
    return flow.sessionPreviewEdits?.find((e) => e.id === activePreviewEditId)?.imageDataUrl ?? null;
  }, [flow, activePreviewEditId]);

  const previewEditIdByCriterion = useMemo(() => {
    if (!flow || flow.step !== 'results') return undefined;
    const list = flow.sessionPreviewEdits ?? [];
    if (!list.length) return undefined;
    const map: Partial<Record<CritiqueCategory['criterion'], string>> = {};
    for (const e of list) {
      if (e.mode === 'single') {
        const key = canonicalCriterionLabel(e.criterion) ?? e.criterion;
        map[key as CritiqueCategory['criterion']] = e.id;
      }
    }
    return Object.keys(map).length ? map : undefined;
  }, [flow]);

  const focusSessionPreviewForCriterion = useCallback((criterion: CritiqueCategory['criterion']) => {
    const id = previewEditIdByCriterion?.[criterion];
    if (!id) return;
    setActivePreviewEditId(id);
    requestAnimationFrame(() => {
      document.getElementById('critique-session-ai-edits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [previewEditIdByCriterion]);

  const applySuggestedPaintingTitle = useCallback((title: string) => {
    const t = title.trim();
    if (!t) return;
    setFlow((f) => (f ? updateWorkingTitle(f, t) : f));
    setTitleAppliedToast(true);
    if (titleToastTimerRef.current) clearTimeout(titleToastTimerRef.current);
    titleToastTimerRef.current = setTimeout(() => {
      setTitleAppliedToast(false);
      titleToastTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (titleToastTimerRef.current) clearTimeout(titleToastTimerRef.current);
    };
  }, []);

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

  const runPreviewEdit = useCallback(async (criterion: CritiqueCategory['criterion']) => {
    const currentFlow = flowRef.current;
    if (!currentFlow || currentFlow.step !== 'results') return;
    const catList = currentFlow.critique.categories;
    if (catList.length === 0) return;
    const canonCriterion = canonicalCriterionLabel(criterion) ?? criterion;
    const alreadyForCriterion = (currentFlow.sessionPreviewEdits ?? []).some((e) => {
      if (e.mode !== 'single') return false;
      const k = canonicalCriterionLabel(e.criterion) ?? e.criterion;
      return k === canonCriterion;
    });
    if (alreadyForCriterion) return;
    const changes = currentFlow.critique.simple?.studioChanges;
    const previewSource = currentFlow.originalImageDataUrl ?? currentFlow.imageDataUrl;
    if (!shouldTryApiFirst()) {
      setPreviewError('Connect the API (deploy with OPENAI_API_KEY) to generate previews.');
      return;
    }
    const matchingChange = changes?.find((change) => change.previewCriterion === criterion);
    const category =
      catList.find((entry) => entry.criterion === criterion) ?? priorityCritiqueCategory(catList);
    setPreviewError(null);
    setPreviewLoadingTarget({ kind: 'single', criterion });
    setPreviewLoading(true);
    try {
      const target: PreviewEditTargetPayload = {
        criterion: category.criterion,
        level: category.level,
        feedback: category.feedback,
        actionPlan: category.actionPlan,
        anchor: category.anchor,
        editPlan: category.editPlan,
        ...(matchingChange ? { studioChangeRecommendation: matchingChange.text } : {}),
      };
      const { imageDataUrl, criterion: returnedCriterion } = await fetchPreviewEdit({
        imageDataUrl: previewSource,
        style: currentFlow.style,
        medium: currentFlow.medium,
        target,
      });
      const storedCriterion =
        canonicalCriterionLabel(returnedCriterion) ??
        canonicalCriterionLabel(target.criterion) ??
        target.criterion;
      const entry: SavedPreviewEdit = {
        id: newId(),
        imageDataUrl,
        criterion: storedCriterion,
        mode: 'single',
        ...(target.studioChangeRecommendation
          ? { studioChangeRecommendation: target.studioChangeRecommendation }
          : {}),
      };
      setFlow((cur) => {
        if (!cur || cur.step !== 'results') return cur;
        const prev = cur.sessionPreviewEdits ?? [];
        const withoutSameCriterion = prev.filter((e) => {
          if (e.mode !== 'single') return true;
          const prevK = canonicalCriterionLabel(e.criterion) ?? e.criterion;
          const nextK = canonicalCriterionLabel(entry.criterion) ?? entry.criterion;
          return prevK !== nextK;
        });
        const next = { ...cur, sessionPreviewEdits: [...withoutSameCriterion, entry] };
        queueMicrotask(() => {
          if (isCritiqueFlow(next)) setReturnViewIntent({ kind: 'critique', flow: next });
        });
        return next;
      });
      setActivePreviewEditId(entry.id);
      setPreviewCompareOpen(false);
      setPreviewCompareSeen(false);
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : 'Preview failed. Please retry from the critique screen.'
      );
    } finally {
      setPreviewLoading(false);
      setPreviewLoadingTarget(null);
    }
  }, []);

  useEffect(() => {
    if (!flow || flow.step !== 'results') return;
    const list = flow.sessionPreviewEdits ?? [];
    if (!list.length) return;
    if (activePreviewEditId && list.some((e) => e.id === activePreviewEditId)) return;
    setActivePreviewEditId(list[list.length - 1]!.id);
  }, [flow, activePreviewEditId]);

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
                className="-ml-1 rounded-lg px-1 py-0.5 text-left transition md:hover:bg-slate-100/80"
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
              ) : tab !== 'home' ? (
                <button
                  type="button"
                  onClick={goHome}
                  className="rounded-full p-2 text-violet-500 transition md:hover:bg-violet-50 md:hover:text-violet-700"
                  aria-label="Go to home"
                >
                  <Home className="h-6 w-6" />
                </button>
              ) : null}
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
                    const previousFlow = backFromCapture(flow);
                    if (!previousFlow) closeFlow();
                    else setFlow(previousFlow);
                  } else if (flow.step === 'results') {
                    clearReturnViewIntent();
                    setFlow(backFromResults(flow));
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
              {flow.step === 'analyzing' ? (
                <>
                  Analyzing
                  <AnalyzingHeaderEllipsis />
                </>
              ) : null}
              {flow.step === 'results' && 'Critique'}
            </p>
            <span className="w-9 shrink-0" />
          </div>

          <div
            ref={flowScrollRef}
            className={`min-h-0 flex-1 overflow-y-auto ${
              isDesktop
                ? 'w-full px-8 pb-6 pt-4 lg:px-12'
                : 'px-4 pt-5 pb-[max(2rem,calc(1.25rem+env(safe-area-inset-bottom)))]'
            }`}
          >
            {flow.step === 'setup' && (
              <div className="animate-slide-up space-y-7">
                {!postAutoClassifySetup ? (
                  <div>
                    <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1">
                      <button
                        type="button"
                        onClick={() => setFlow((f) => (f?.step === 'setup' ? switchToManualStyle(f) : f))}
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
                        onClick={() => setFlow((f) => (f?.step === 'setup' ? switchToAutoStyle(f) : f))}
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
                    <p className="mt-2 text-xs leading-snug text-slate-500">
                      “Categorize for me” infers <span className="font-medium text-slate-600">both</span> style and medium from
                      your upload. The lists below update automatically; change any pick if it doesn’t match your work.
                    </p>
                  </div>
                ) : null}

                {flow.styleMode === 'auto' ? (
                  <div className="space-y-3">
                    {!(flow.style && flow.styleClassifyMeta) ? (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-4 py-8 transition hover:border-violet-300 hover:bg-violet-50">
                        {classifyBusy ? (
                          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        ) : (
                          <Wand2 className="h-8 w-8 text-violet-500" />
                        )}
                        <span className="text-center text-sm font-semibold text-slate-800">
                          {classifyBusy ? 'Analyzing your painting…' : 'Upload a painting to detect style & medium'}
                        </span>
                        <span className="text-center text-xs text-slate-500">
                          Style (Realism, Impressionism, Expressionism, Abstract) and medium are inferred together from this
                          image.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={classifyBusy}
                          onChange={(e) => void onPickFileForClassify(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    ) : null}
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Detection notes</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{flow.styleClassifyMeta.rationale}</p>
                        {flow.styleClassifyMeta.source === 'local' ? (
                          <p className="mt-2 text-xs text-amber-700">
                            Quick estimate from color and brushwork signals. Connect the API for a vision-based match.
                          </p>
                        ) : null}
                        {flow.mediumClassifyMeta ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Detected medium
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-800">{flow.mediumClassifyMeta.medium}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {flow.mediumClassifyMeta.rationale}
                            </p>
                          </div>
                        ) : null}
                        {flow.mediumClassifyMeta && flow.medium !== flow.mediumClassifyMeta.medium ? (
                          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                            The image reads more like {flow.mediumClassifyMeta.medium}, but the critique will still use your
                            selected medium ({flow.medium}). Ratings may be less reliable if you keep this lens.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Style</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFlow((f) => (f?.step === 'setup' ? chooseStyle(f, s) : f))}
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
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Medium</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {MEDIUMS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFlow((f) => (f?.step === 'setup' ? chooseMedium(f, m) : f))}
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
                    onChange={(e) => setFlow((f) => (f ? updateWorkingTitle(f, e.target.value) : f))}
                    placeholder="e.g. Morning light on the harbor"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Shown on your critique and saved with the painting. Leave blank and ArtVision Pro will suggest three possible names for your painting.
                  </p>
                </div>

                {canRunCritiqueFromClassifyUpload ? (
                  <div className={postAutoClassifySetup ? '' : 'space-y-2'}>
                    <button
                      type="button"
                      onClick={() => {
                        const src = flow.classifySourceImageDataUrl;
                        if (src) void runAnalysis(src);
                      }}
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition active:scale-[0.99]"
                    >
                      Run Critique on this painting
                    </button>
                    {!postAutoClassifySetup ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFlow((f) => {
                            if (f?.step !== 'setup') return f;
                            const cleared = clearClassifySource(f);
                            return enterCapture(cleared) ?? f;
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        {isDesktop ? 'Upload a different photo' : 'Use camera or a different photo'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={flow.step !== 'setup' ? true : !canContinueFromSetup(flow, classifyBusy)}
                    onClick={() => setFlow((f) => (f?.step === 'setup' ? enterCapture(f) ?? f : f))}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition enabled:active:scale-[0.99] disabled:opacity-35"
                  >
                    {isDesktop ? 'Continue to upload' : 'Continue to capture'}
                  </button>
                )}
              </div>
            )}

            {flow.step === 'capture' && (
              <div className="space-y-3 animate-slide-up">
                <div>
                  <label htmlFor="capture-working-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Title <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="capture-working-title"
                    type="text"
                    maxLength={120}
                    value={flow.workingTitle}
                    onChange={(e) => setFlow((f) => (f ? updateWorkingTitle(f, e.target.value) : f))}
                    placeholder="Name this piece for the critique"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:text-sm"
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Leave blank and ArtVision Pro will suggest three possible names for your painting.
                  </p>
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
                    <div className="relative aspect-[4/5] max-h-[52vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-card">
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
                    <p className="text-center text-[11px] leading-snug text-slate-500">
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
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-20">
                <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
                <p className="max-w-sm text-center text-sm leading-relaxed text-slate-600">
                  ArtVision Pro is analyzing your painting and writing personalized feedback.
                </p>
                <p className="max-w-sm text-center text-xs leading-relaxed text-slate-500">
                  Please allow 1–2 minutes for this process and do not leave this screen while the analysis is
                  running. You will be taken automatically to your Critique once complete.
                </p>
                {analysisRetryNotice ? (
                  <p className="max-w-sm text-center text-xs font-medium text-violet-700">
                    Connection may have paused in the background—retrying the vision request…
                  </p>
                ) : null}
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
                      onChange={(e) => setFlow((f) => (f ? updateWorkingTitle(f, e.target.value) : f))}
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
                <CritiquePanels
                  critique={flow.critique}
                  paintingImageSrc={flow.imageDataUrl}
                  onLearnMore={rememberCritiqueReturn}
                  canGenerateAiEdits={shouldTryApiFirst()}
                  onGenerateAiEditForCriterion={(criterion: CritiqueCategory['criterion']) =>
                    void runPreviewEdit(criterion)
                  }
                  previewEditIdByCriterion={previewEditIdByCriterion}
                  onFocusSessionPreviewForCriterion={focusSessionPreviewForCriterion}
                  previewLoading={previewLoading}
                  previewLoadingTarget={previewLoadingTarget}
                  workingTitle={flow.workingTitle}
                  onSelectSuggestedTitle={applySuggestedPaintingTitle}
                  voiceBFooter={
                    flow.sessionPreviewEdits && flow.sessionPreviewEdits.length > 0 && previewTarget ? (
                      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                          AI edits this session
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Illustrative only—not a substitute for painting. Saved with the work when you save to Studio;
                          discarded if you leave without saving.
                        </p>
                        <div className="mt-3 rounded-xl border border-violet-200/60 bg-white/80 p-2">
                          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Select preview ({flow.sessionPreviewEdits.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {flow.sessionPreviewEdits.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                title={previewEditChipTitle(e.mode, e.criterion)}
                                onClick={() => setActivePreviewEditId(e.id)}
                                className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition ${
                                  activePreviewEditId === e.id
                                    ? 'border-violet-500 bg-violet-100 text-violet-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300'
                                }`}
                              >
                                {previewEditChipText(e.mode, e.criterion)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {previewError ? (
                          <p className="mt-2 text-center text-xs text-red-600">{previewError}</p>
                        ) : null}
                        {activePreviewImageDataUrl ? (
                          isDesktop ? (
                            <div className="mt-4 min-h-0 border-t border-violet-200/60 pt-4">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Compare
                              </p>
                              <div className="mt-3">
                                <PreviewEditBlendCard
                                  originalSrc={flow.imageDataUrl}
                                  revisedSrc={activePreviewImageDataUrl}
                                  target={previewTarget}
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
                                Compare
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
                                    Your image, the AI preview, and notes on what changed.
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    Your photo and the AI preview, with notes.
                                  </span>
                                )}
                              </button>
                            </div>
                          )
                        ) : null}
                      </section>
                    ) : previewError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-center text-xs text-red-700">
                        {previewError}
                      </p>
                    ) : null
                  }
                />
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
        activePreviewImageDataUrl &&
        previewTarget ? (
          <PreviewCompareOverlay
            originalSrc={flow.imageDataUrl}
            revisedSrc={activePreviewImageDataUrl}
            target={previewTarget}
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
        {titleAppliedToast ? (
          <div
            className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 px-4"
            role="status"
            aria-live="polite"
          >
            <div className="animate-fade-in rounded-full border border-violet-200 bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg shadow-slate-900/20">
              Applied to title
            </div>
          </div>
        ) : null}
        </>
      )}
      <Analytics />
    </div>
  );
}
