import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { DesktopMainChrome } from './components/DesktopMainChrome';
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
import { fetchCritiqueFromApi } from './critiqueApi';
import { fetchPreviewEdit, PreviewEditPaymentRequiredError } from './previewEditApi';
import { fetchClassifyStyleFromApi } from './classifyStyleApi';
import { fetchClassifyMediumFromApi } from './classifyMediumApi';
import type { CritiqueStageName } from '../lib/critiqueErrors';
import type { PreviewEditTarget } from '../lib/previewEditTypes.js';
import { hydrateVoiceBCanonicalCategory } from '../lib/critiqueVoiceBCanonical.js';
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
  toAnalysisUnavailableFromAnalyzing,
  updateWorkingTitle,
  type CritiqueFlow,
} from './critiqueFlow';
import { compressDataUrl, compressDataUrlForApi, fileToDataUrl } from './imageUtils';
import { useCameraCapture } from './hooks/useCameraCapture';
import { useCritiqueAsyncState } from './hooks/useCritiqueAsyncState';
import { useIsDesktop } from './hooks/useIsDesktop';
import { usePreviewState } from './hooks/usePreviewState';
import { advanceDailyMasterpieceIndex } from './dailyMasterpieceCycle';
import {
  CritiqueRequestError,
  createCritiqueRequestError,
  normalizeCritiqueRequestError,
} from './critiqueRequestError';
import { clearReturnViewIntent, consumeReturnTabIntent, consumeReturnViewIntent, setReturnViewIntent } from './navIntent';
import { tabFromSearch } from './launchUrls';
import { createStripeCheckoutSession, fetchStripePaywallConfig } from './stripeConfigApi';
import { clearStripeCheckoutJwt, getStripeCheckoutJwt, setStripeCheckoutJwt } from './stripeCheckoutSession';
import { usePaintingStorage } from './hooks/usePaintingStorage';
import { BenchmarksTab } from './screens/BenchmarksTab';
import { GlossaryTab } from './screens/GlossaryTab';
import { HomeTab } from './screens/HomeTab';
import { ProfileTab } from './screens/ProfileTab';
import { StudioTab } from './screens/StudioTab';
import type {
  CritiqueCategory,
  CritiqueResult,
  Medium,
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

type PreviewEditTargetPayload = PreviewEditTarget;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Soft staggered dots after “Analyzing” in the flow header (CSS-driven). */
function AnalyzingHeaderEllipsis() {
  return (
    <span className="inline-flex min-w-[1.35em] items-baseline gap-px pl-px" aria-hidden>
      <span className="analyzing-dot">.</span>
      <span className="analyzing-dot">.</span>
      <span className="analyzing-dot">.</span>
    </span>
  );
}

function priorityCritiqueCategory(categories: CritiqueCategory[]): CritiqueCategory {
  const rank = (l: (typeof RATING_LEVELS)[number]) => RATING_LEVELS.indexOf(l);
  const safeRank = (category: CritiqueCategory) =>
    category.level ? rank(category.level) : Number.POSITIVE_INFINITY;
  return categories.reduce((a, b) => (safeRank(a) <= safeRank(b) ? a : b));
}

function critiqueStageLabel(stage: CritiqueStageName | undefined): string | null {
  switch (stage) {
    case 'evidence':
      return 'Evidence extraction';
    case 'calibration':
      return 'Calibration review';
    case 'voice_a':
      return 'Voice A critic analysis';
    case 'voice_b':
    case 'voice_b_summary':
      return 'Voice B teaching plan';
    case 'final':
      return 'Final quality gate';
    default:
      return null;
  }
}

function formatRequestErrorDetail(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return 'The critique response did not pass validation.';
  if (trimmed.startsWith('[{') || trimmed.startsWith('[')) {
    if (
      trimmed.includes('actionPlanSteps[0].move') ||
      (trimmed.includes('"path":["categories",0,"actionPlanSteps",0,"move"]') &&
        trimmed.includes('"invalid_format"'))
    ) {
      return 'The teaching-plan move was not a concrete change instruction for that criterion.';
    }
    if (
      trimmed.includes('bestNextMove') ||
      (trimmed.includes('"path":["categories",0,"voiceBPlan","bestNextMove"]') &&
        trimmed.includes('"invalid_format"'))
    ) {
      return 'The teaching-plan next move was not a concrete change instruction for that criterion.';
    }
    if (
      trimmed.includes('intendedChange') ||
      (trimmed.includes('"path":["categories",0,"editPlan","intendedChange"]') &&
        trimmed.includes('"invalid_format"'))
    ) {
      return 'The edit plan did not specify a concrete change instruction for that criterion.';
    }
    return 'The critique response did not match the required schema.';
  }
  return trimmed;
}

function formatRequestDebugTraceEntry(entry: {
  attempt: number;
  error: string;
  details: string[];
  repairNotePreview?: string;
}): string {
  const firstDetail = entry.details.find((detail) => detail.trim().length > 0);
  const base = firstDetail ? `Attempt ${entry.attempt}: ${formatRequestErrorDetail(firstDetail)}` : `Attempt ${entry.attempt}: ${entry.error}`;
  if (!entry.repairNotePreview) return base;
  const compactRepair = entry.repairNotePreview.replace(/\s+/g, ' ').trim();
  return `${base} Retry note: ${compactRepair.slice(0, 180)}${compactRepair.length > 180 ? '…' : ''}`;
}

function previewDisplayTarget(
  flow: CritiqueFlow,
  activePreviewEditId: string | null
): PreviewEditTargetPayload | null {
  if (flow.step !== 'results' || !flow.critique.categories.length) return null;
  const catList = flow.critique.categories.map((category) => hydrateVoiceBCanonicalCategory(category));
  const session = flow.sessionPreviewEdits ?? [];
  const active = activePreviewEditId ? session.find((e) => e.id === activePreviewEditId) : undefined;
  if (active) {
    const cat =
      catList.find((c) => c.criterion === active.criterion) ?? priorityCritiqueCategory(catList);
    return {
      criterion: active.criterion,
      level: cat.level,
      phase1: cat.phase1,
      phase2: cat.phase2,
      phase3: cat.phase3,
      plan: cat.plan,
      actionPlanSteps: cat.actionPlanSteps,
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
      phase1: cat.phase1,
      phase2: cat.phase2,
      phase3: cat.phase3,
      plan: cat.plan,
      actionPlanSteps: cat.actionPlanSteps,
      anchor: cat.anchor,
      editPlan: cat.editPlan,
      studioChangeRecommendation: ch.text,
    };
  }
  const p = priorityCritiqueCategory(catList);
  return {
    criterion: p.criterion,
    level: p.level,
    phase1: p.phase1,
    phase2: p.phase2,
    phase3: p.phase3,
    plan: p.plan,
    actionPlanSteps: p.actionPlanSteps,
    anchor: p.anchor,
    editPlan: p.editPlan,
  };
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<TabId>('home');
  const { paintings, studioSelectedId, setStudioSelectedId, persistResult: storagePersist, deletePainting, openPaintingFromHome } = usePaintingStorage(setTab);
  const [flow, setFlow] = useState<CritiqueFlow | null>(null);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const pendingCropRef = useRef<PendingCrop | null>(null);
  pendingCropRef.current = pendingCrop;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [dragOver, setDragOver] = useState(false);
  const {
    asyncState,
    clearAsyncState,
    failRequest,
    finishRequest,
    noteAnalysisRetry,
    startAnalysis,
    startClassify,
  } = useCritiqueAsyncState();
  const { preview, resetPreview, startPreviewLoading, completePreview, failPreview, selectEdit, openCompare, closeCompare } = usePreviewState();
  const [titleAppliedToast, setTitleAppliedToast] = useState(false);
  const titleToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysisAbortRef = useRef<AbortController | null>(null);
  const classifyAbortRef = useRef<AbortController | null>(null);
  const analysisHiddenAtRef = useRef<number | null>(null);
  const analysisRetryUsedRef = useRef(false);
  /** True only when abort() was triggered from the visibility resume path (eligible for one API retry). */
  const analysisVisibilityAbortRef = useRef(false);
  const analysisWakeRef = useRef<WakeLockHandle | null>(null);
  const analysisRunTokenRef = useRef(0);
  const classifyRunTokenRef = useRef(0);
  const imageSelectionTokenRef = useRef(0);
  const lastAutoSaveSigRef = useRef<string | null>(null);
  const [paywallEnabled, setPaywallEnabled] = useState(false);
  const [critiquePriceLabel, setCritiquePriceLabel] = useState('$1.49');
  const [previewPriceLabel, setPreviewPriceLabel] = useState('$0.49');
  const pendingCritiqueAfterPaymentRef = useRef<{ runId: number; rawDataUrl: string } | null>(null);
  const pendingPreviewCriterionRef = useRef<CritiqueCategory['criterion'] | null>(null);

  const formatUsd = useCallback(
    (cents: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100),
    []
  );

  useEffect(() => {
    void fetchStripePaywallConfig().then((c) => {
      setPaywallEnabled(c.paywallEnabled);
      setCritiquePriceLabel(formatUsd(c.critiqueAmountCents));
      setPreviewPriceLabel(formatUsd(c.previewEditAmountCents));
    });
  }, [formatUsd]);

  const { videoRef, status: camStatus, error: camError, start: startCamera, stop: stopCamera, captureFrame } =
    useCameraCapture();

  const flowScrollRef = useRef<HTMLDivElement>(null);
  const hadFlowRef = useRef(false);
  const requestError = asyncState.status === 'error' ? asyncState.error : null;
  const classifyBusy = asyncState.status === 'classifying';
  const analysisRetryNotice =
    asyncState.status === 'analyzing' ? asyncState.retryNotice : false;

  const invalidateImageSelections = useCallback(() => {
    imageSelectionTokenRef.current += 1;
  }, []);

  const clearPendingCrop = useCallback(() => {
    pendingCropRef.current = null;
    setPendingCrop(null);
  }, []);

  /** Expose layout mode for styling hooks and assistive context (desktop = sidebar shell, mobile = bottom nav). */
  useEffect(() => {
    document.documentElement.dataset.layout = isDesktop ? 'desktop' : 'mobile';
    return () => {
      delete document.documentElement.dataset.layout;
    };
  }, [isDesktop]);

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
    if (location.pathname !== '/') return;
    const returnView = consumeReturnViewIntent();
    if (returnView?.kind === 'critique' && isCritiqueFlow(returnView.flow)) {
      setFlow(returnView.flow);
      clearAsyncState();
      closeCompare();
      return;
    }
    if (returnView?.kind === 'studio') {
      setFlow(null);
      setStudioSelectedId(returnView.selectedPaintingId);
      setTab('studio');
      return;
    }
    const intent = consumeReturnTabIntent();
    if (intent === 'benchmarks') {
      setTab('benchmarks');
      return;
    }
    const tabParam = tabFromSearch(location.search);
    if (tabParam) {
      setFlow(null);
      setTab(tabParam);
      if (location.search) {
        navigate({ pathname: '/', search: '' }, { replace: true });
      }
    }
  }, [
    location.pathname,
    location.key,
    location.search,
    navigate,
    clearAsyncState,
    closeCompare,
    setStudioSelectedId,
  ]);

  const cancelAnalysisKeepAlive = useCallback(() => {
    analysisRunTokenRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    void analysisWakeRef.current?.release().catch(() => {});
    analysisWakeRef.current = null;
    analysisHiddenAtRef.current = null;
    analysisRetryUsedRef.current = false;
    analysisVisibilityAbortRef.current = false;
  }, []);

  const cancelClassifyRequest = useCallback(() => {
    classifyRunTokenRef.current += 1;
    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
  }, []);

  const resetTransientFlowState = useCallback(() => {
    cancelAnalysisKeepAlive();
    cancelClassifyRequest();
    invalidateImageSelections();
    clearPendingCrop();
    clearAsyncState();
    lastAutoSaveSigRef.current = null;
    resetPreview();
  }, [
    cancelAnalysisKeepAlive,
    cancelClassifyRequest,
    clearAsyncState,
    clearPendingCrop,
    invalidateImageSelections,
    resetPreview,
  ]);

  const closeFlow = useCallback(() => {
    clearReturnViewIntent();
    stopCamera();
    resetTransientFlowState();
    setFlow(null);
  }, [resetTransientFlowState, stopCamera]);

  const goHome = useCallback(() => {
    clearReturnViewIntent();
    advanceDailyMasterpieceIndex();
    stopCamera();
    resetTransientFlowState();
    setFlow(null);
    setTab('home');
  }, [resetTransientFlowState, stopCamera]);

  const startNewCritique = useCallback(() => {
    stopCamera();
    resetTransientFlowState();
    setFlow(createNewFlow());
  }, [resetTransientFlowState, stopCamera]);

  const startResubmit = useCallback((p: SavedPainting) => {
    stopCamera();
    resetTransientFlowState();
    setFlow(createResubmitFlow(p));
    setTab('studio');
  }, [resetTransientFlowState, stopCamera]);

  useEffect(() => {
    if (flow?.step === 'capture' && !isDesktop) {
      void startCamera();
      return () => stopCamera();
    }
    stopCamera();
  }, [flow?.step, isDesktop, startCamera, stopCamera]);

  const runAnalysisRef = useRef<(rawDataUrl: string) => Promise<void>>(async () => {});
  const runPreviewEditRef = useRef<(criterion: CritiqueCategory['criterion']) => Promise<void>>(async () => {});

  const runAnalysis = useCallback(async (rawDataUrl: string) => {
    const f = flowRef.current;
    if (!f || (f.step !== 'setup' && f.step !== 'capture')) return;
    if (!f.style || !f.medium) return;
    const startedFlow = beginAnalysis(f, rawDataUrl);
    if (!startedFlow) return;
    cancelClassifyRequest();
    invalidateImageSelections();
    clearPendingCrop();
    const runId = ++analysisRunTokenRef.current;
    pendingCritiqueAfterPaymentRef.current = null;
    startAnalysis();
    lastAutoSaveSigRef.current = null;
    resetPreview();
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
      const [compressedForApi, compressedForStorage] = await Promise.all([
        compressDataUrlForApi(rawDataUrl),
        compressDataUrl(rawDataUrl),
      ]);
      const prev =
        f.mode === 'resubmit' && f.targetPainting
          ? f.targetPainting.versions[f.targetPainting.versions.length - 1]
          : undefined;
      let critique: CritiqueResult;
      const prevPayload =
        prev
          ? {
              imageDataUrl: await compressDataUrlForApi(prev.imageDataUrl),
              critique: prev.critique,
            }
          : undefined;

      const titleForCritique = f.workingTitle.trim();
      const titleArg = titleForCritique.length > 0 ? titleForCritique : undefined;

      const jwt = paywallEnabled ? getStripeCheckoutJwt('critique') : null;
      const apiBody = {
        style: f.style,
        medium: f.medium,
        imageDataUrl: compressedForApi,
        ...(titleArg ? { paintingTitle: titleArg } : {}),
        ...(prevPayload
          ? {
              previousImageDataUrl: prevPayload.imageDataUrl,
              previousCritique: prevPayload.critique,
            }
          : {}),
        ...(jwt ? { stripeCheckoutJwt: jwt } : {}),
      };

      const attemptApi = async (signal: AbortSignal): Promise<CritiqueResult> =>
        fetchCritiqueFromApi({ ...apiBody, signal });

      const visibilityRetryable = (): boolean =>
        analysisVisibilityAbortRef.current &&
        !analysisRetryUsedRef.current &&
        runId === analysisRunTokenRef.current;

      try {
        critique = await attemptApi(ac.signal);
      } catch (err) {
        if (isAbortError(err) && visibilityRetryable()) {
          analysisVisibilityAbortRef.current = false;
          analysisRetryUsedRef.current = true;
          noteAnalysisRetry();
          const ac2 = new AbortController();
          analysisAbortRef.current = ac2;
          critique = await attemptApi(ac2.signal);
        } else {
          throw err;
        }
      }

      if (runId !== analysisRunTokenRef.current) return;

      finishRequest();
      setFlow(
        completeAnalysis(startedFlow, {
          imageDataUrl: compressedForStorage,
          critique,
          critiqueSource: 'api',
        })
      );
    } catch (e) {
      if (runId !== analysisRunTokenRef.current) return;
      const normalized = normalizeCritiqueRequestError(e, 'critique');
      if (normalized instanceof CritiqueRequestError && normalized.kind === 'uninterpretable') {
        finishRequest();
        setFlow(toAnalysisUnavailableFromAnalyzing(startedFlow));
      } else if (normalized instanceof CritiqueRequestError && normalized.kind === 'payment_required') {
        finishRequest();
        setFlow(recoverFromAnalysisError(startedFlow));
        pendingCritiqueAfterPaymentRef.current = { runId, rawDataUrl };
        failRequest(normalized);
      } else {
        failRequest(normalized);
        setFlow(recoverFromAnalysisError(startedFlow));
      }
    } finally {
      if (runId === analysisRunTokenRef.current) {
        analysisAbortRef.current = null;
      }
      releaseWakeIfCurrent();
    }
  }, [
    cancelClassifyRequest,
    clearPendingCrop,
    failRequest,
    finishRequest,
    invalidateImageSelections,
    noteAnalysisRetry,
    paywallEnabled,
    resetPreview,
    startAnalysis,
  ]);

  runAnalysisRef.current = runAnalysis;

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
    const current = flowRef.current;
    if (!current || current.step !== 'setup' || current.styleMode !== 'auto') return;
    const runId = ++classifyRunTokenRef.current;
    classifyAbortRef.current?.abort();
    const ac = new AbortController();
    classifyAbortRef.current = ac;
    startClassify();
    try {
      const compressed = await compressDataUrlForApi(rawDataUrl);
      if (runId !== classifyRunTokenRef.current) return;
      const [styleRead, mediumRead] = await Promise.all([
        fetchClassifyStyleFromApi(compressed, ac.signal),
        fetchClassifyMediumFromApi(compressed, ac.signal).catch((error) => {
          if (isAbortError(error)) throw error;
          return null;
        }),
      ]);
      if (runId !== classifyRunTokenRef.current) return;
      const style: Style = styleRead.style;
      const styleRationale: string = styleRead.rationale;
      const styleSource: 'api' | 'local' = 'api';
      const detectedMedium: Medium | undefined = mediumRead?.medium;
      const mediumRationale: string | undefined = mediumRead?.rationale;
      const mediumSource: 'api' | 'local' | undefined = mediumRead ? 'api' : undefined;

      setFlow((cur) => {
        if (
          runId !== classifyRunTokenRef.current ||
          cur?.step !== 'setup' ||
          cur.styleMode !== 'auto'
        ) {
          return cur;
        }
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
      finishRequest();
    } catch (e) {
      if (isAbortError(e)) return;
      if (runId !== classifyRunTokenRef.current) return;
      failRequest(normalizeCritiqueRequestError(e, 'classify'));
    } finally {
      if (runId === classifyRunTokenRef.current) {
        classifyAbortRef.current = null;
      }
    }
  }, [failRequest, finishRequest, startClassify]);

  const openCropperForImage = useCallback(
    (imageSrc: string, source: CropSource) => {
      const current = flowRef.current;
      if (!current) return;
      stopCamera();
      clearAsyncState();
      const nextCrop = { imageSrc, source, action: 'analyze' } as const;
      pendingCropRef.current = nextCrop;
      setPendingCrop(nextCrop);
      if (current.step === 'setup') {
        const capture = enterCapture(current);
        if (capture) setFlow(capture);
      }
    },
    [clearAsyncState, stopCamera]
  );

  const onCropConfirm = useCallback(
    async (croppedImage: string) => {
      const pending = pendingCropRef.current;
      if (!pending) return;
      pendingCropRef.current = null;
      setPendingCrop(null);
      const action = pending.action;
      if (action === 'classify') {
        await runClassifyStyle(croppedImage);
      } else {
        await runAnalysis(croppedImage);
      }
    },
    [runAnalysis, runClassifyStyle]
  );

  const onCropCancel = useCallback(() => {
    clearPendingCrop();
  }, [clearPendingCrop]);

  const onPickFile = useCallback(
    async (file: File | null, source: CropSource = 'gallery') => {
      if (!file || !flowRef.current) return;
      const token = ++imageSelectionTokenRef.current;
      const url = await fileToDataUrl(file);
      if (token !== imageSelectionTokenRef.current) return;
      openCropperForImage(url, source);
    },
    [openCropperForImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file?.type.startsWith('image/')) void onPickFile(file);
    },
    [onPickFile]
  );

  const onPickFileForClassify = useCallback(
    async (file: File | null) => {
      const current = flowRef.current;
      if (!file || !current || current.step !== 'setup' || current.styleMode !== 'auto') return;
      clearAsyncState();
      const token = ++imageSelectionTokenRef.current;
      const url = await fileToDataUrl(file);
      if (token !== imageSelectionTokenRef.current) return;
      stopCamera();
      const nextCrop = { imageSrc: url, source: 'gallery', action: 'classify' } as const;
      pendingCropRef.current = nextCrop;
      setPendingCrop(nextCrop);
    },
    [clearAsyncState, stopCamera]
  );

  const onShutter = useCallback(async () => {
    const shot = captureFrame();
    if (!shot) {
      failRequest(
        createCritiqueRequestError({
          operation: 'critique',
          kind: 'unknown',
          technicalMessage: 'Could not read from camera. Try upload.',
          userMessage: 'Could not read from camera. Try upload.',
        })
      );
      return;
    }
    openCropperForImage(shot, 'live-camera');
  }, [captureFrame, failRequest, openCropperForImage]);

  /** When preview finishes for a work already in Studio, persist (merge previews into last version) without leaving results. */
  useEffect(() => {
    if (preview.loading) return;
    const f = flowRef.current;
    if (!f || f.step !== 'results') return;
    const list = f.sessionPreviewEdits ?? [];
    if (!list.length) return;
    const hasStudio = f.mode === 'resubmit' || f.savedPaintingId != null;
    if (!hasStudio) return;
    const sig = list.map((e) => e.id).join('|');
    if (lastAutoSaveSigRef.current === sig) return;
    lastAutoSaveSigRef.current = sig;
    const result = storagePersist(f, { navigateToStudio: false });
    if (result) {
      setFlow((cur) => cur && cur.step === 'results' ? { ...cur, mode: 'resubmit', targetPainting: result.targetPainting, savedPaintingId: result.savedPaintingId } : cur);
    }
  }, [flow, preview.loading, storagePersist]);

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

  const requestErrorNotice = requestError ? (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        requestError.kind === 'payment_required'
          ? 'border-amber-200 bg-amber-50/90 text-amber-950'
          : 'border-red-200 bg-red-50/80 text-red-800'
      }`}
      role="alert"
    >
      <p className="font-medium">{requestError.message}</p>
      {requestError.operation === 'critique' && requestError.stage ? (
        <p className="mt-1 text-xs leading-relaxed text-red-700">
          Failed stage: {critiqueStageLabel(requestError.stage) ?? requestError.stage}
          {requestError.attempts ? ` after ${requestError.attempts} attempts` : ''}.
        </p>
      ) : null}
      {requestError.details.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-red-700">
          {requestError.details.slice(0, 3).map((detail, index) => {
            const formatted = formatRequestErrorDetail(detail);
            return <li key={`${index}-${formatted}`}>{formatted}</li>;
          })}
        </ul>
      ) : null}
      {requestError.operation === 'critique' && requestError.debug?.attempts && requestError.debug.attempts.length > 0 ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-white/60 px-3 py-2 text-xs leading-relaxed text-red-700">
          <p className="font-medium text-red-800">Debug summary</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {requestError.debug.attempts.slice(0, 3).map((entry) => {
              const formatted = formatRequestDebugTraceEntry(entry);
              return <li key={`${entry.attempt}-${formatted}`}>{formatted}</li>;
            })}
          </ul>
        </div>
      ) : null}
      {requestError.kind === 'payment_required' && requestError.operation === 'critique' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-amber-900/90">
            One critique is {critiquePriceLabel} (USD). After you pay, you will return here and the critique will run
            automatically.
          </p>
          <button
            type="button"
            onClick={() => void startCritiqueCheckout()}
            className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700"
          >
            Pay {critiquePriceLabel} with Stripe
          </button>
        </div>
      ) : null}
      {requestError.retryable ? (
        <p
          className={`mt-1 text-xs leading-relaxed ${
            requestError.kind === 'payment_required' ? 'text-amber-900/80' : 'text-red-700'
          }`}
        >
          {requestError.operation === 'classify'
            ? 'Try another upload, or switch to manual style selection.'
            : 'You can retry with the same image or choose a different photo.'}
        </p>
      ) : null}
    </div>
  ) : null;

  const previewTarget = useMemo(
    () => (flow ? previewDisplayTarget(flow, preview.activeEditId) : null),
    [flow, preview.activeEditId]
  );

  const activePreviewImageDataUrl = useMemo(() => {
    if (!flow || flow.step !== 'results' || !preview.activeEditId) return null;
    return flow.sessionPreviewEdits?.find((e) => e.id === preview.activeEditId)?.imageDataUrl ?? null;
  }, [flow, preview.activeEditId]);

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
    selectEdit(id);
    requestAnimationFrame(() => {
      document.getElementById('critique-session-ai-edits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [previewEditIdByCriterion, selectEdit]);

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

  const startCritiqueCheckout = useCallback(async () => {
    try {
      const url = await createStripeCheckoutSession({
        kind: 'critique',
        cancelPathHash: '#/',
      });
      window.location.href = url;
    } catch (e) {
      failRequest(
        normalizeCritiqueRequestError(
          e instanceof Error ? e : new Error('Checkout failed'),
          'critique'
        )
      );
    }
  }, [failRequest]);

  const startPreviewCheckout = useCallback(async () => {
    try {
      const url = await createStripeCheckoutSession({
        kind: 'preview_edit',
        cancelPathHash: '#/',
      });
      window.location.href = url;
    } catch (e) {
      failPreview(e instanceof Error ? e.message : 'Checkout failed');
    }
  }, [failPreview]);

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
    const matchingChange = changes?.find((change) => change.previewCriterion === criterion);
    const category =
      catList.find((entry) => entry.criterion === criterion) ?? priorityCritiqueCategory(catList);
    pendingPreviewCriterionRef.current = null;
    startPreviewLoading({ kind: 'single', criterion });
    try {
      const target: PreviewEditTargetPayload = {
        criterion: category.criterion,
        level: category.level,
        phase1: category.phase1,
        phase2: category.phase2,
        phase3: category.phase3,
        actionPlanSteps: category.actionPlanSteps,
        anchor: category.anchor,
        editPlan: category.editPlan,
        ...(matchingChange ? { studioChangeRecommendation: matchingChange.text } : {}),
      };
      const previewJwt = paywallEnabled ? getStripeCheckoutJwt('preview_edit') : null;
      const { imageDataUrl, criterion: returnedCriterion } = await fetchPreviewEdit({
        imageDataUrl: previewSource,
        style: currentFlow.style,
        medium: currentFlow.medium,
        target,
        ...(previewJwt ? { stripeCheckoutJwt: previewJwt } : {}),
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
      completePreview(entry.id);
    } catch (e) {
      if (e instanceof PreviewEditPaymentRequiredError) {
        pendingPreviewCriterionRef.current = criterion;
        failPreview(e.message, { paymentRequired: true });
      } else {
        failPreview(
          e instanceof Error ? e.message : 'Preview failed. Please retry from the critique screen.'
        );
      }
    }
  }, [startPreviewLoading, completePreview, failPreview, paywallEnabled]);

  runPreviewEditRef.current = runPreviewEdit;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') !== 'success') return;
    const jwt = params.get('jwt');
    const kind = params.get('kind');
    if (!jwt || (kind !== 'critique' && kind !== 'preview_edit')) {
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
      return;
    }
    if (kind === 'critique') {
      setStripeCheckoutJwt('critique', jwt);
      clearStripeCheckoutJwt('preview_edit');
    } else {
      setStripeCheckoutJwt('preview_edit', jwt);
      clearStripeCheckoutJwt('critique');
    }
    navigate({ pathname: location.pathname, search: '' }, { replace: true });

    const pendingCrit = pendingCritiqueAfterPaymentRef.current;
    if (kind === 'critique' && pendingCrit && pendingCrit.runId === analysisRunTokenRef.current) {
      pendingCritiqueAfterPaymentRef.current = null;
      void runAnalysisRef.current(pendingCrit.rawDataUrl);
      return;
    }
    const pendingPrev = pendingPreviewCriterionRef.current;
    if (kind === 'preview_edit' && pendingPrev) {
      pendingPreviewCriterionRef.current = null;
      void runPreviewEditRef.current(pendingPrev);
    }
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    if (!flow || flow.step !== 'results') return;
    const list = flow.sessionPreviewEdits ?? [];
    if (!list.length) return;
    if (preview.activeEditId && list.some((e) => e.id === preview.activeEditId)) return;
    selectEdit(list[list.length - 1]!.id);
  }, [flow, preview.activeEditId, selectEdit]);


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
        <div className="flex min-h-0 flex-1 bg-slate-100">
          <DesktopSidebar active={tab} onChange={handleDesktopSidebarChange} />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <DesktopMainChrome activeTab={tab} />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_24px_-4px_rgba(15,23,42,0.08)]">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5 lg:px-10 lg:py-6">
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
                  {!flow && tab === 'glossary' && <GlossaryTab isDesktop />}
                  {!flow && tab === 'profile' && <ProfileTab isDesktop />}
                </div>
              </div>
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
            {!flow && tab === 'glossary' && <GlossaryTab />}
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
          className={`fixed z-40 flex min-h-0 flex-col overflow-hidden ${
            isDesktop
              ? 'inset-y-0 left-60 right-0 border-l border-slate-200/90 bg-slate-50 shadow-[-12px_0_40px_-12px_rgba(15,23,42,0.12)]'
              : 'inset-0 bg-slate-50 pt-[env(safe-area-inset-top)]'
          }`}
        >
          <div
            className={`flex shrink-0 items-center gap-3 border-b border-slate-200/90 bg-white px-4 py-3 shadow-sm backdrop-blur-sm ${
              isDesktop ? 'pl-5' : ''
            }`}
          >
            {!isDesktop && (flow.step === 'results' || flow.step === 'analysis_unavailable') ? (
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
                  clearAsyncState();
                  if (flow.step === 'setup') closeFlow();
                  else if (flow.step === 'capture') {
                    cancelClassifyRequest();
                    const previousFlow = backFromCapture(flow);
                    if (!previousFlow) closeFlow();
                    else setFlow(previousFlow);
                  } else if (flow.step === 'results') {
                    clearReturnViewIntent();
                    lastAutoSaveSigRef.current = null;
                    resetPreview();
                    setFlow(backFromResults(flow));
                  } else if (flow.step === 'analysis_unavailable') {
                    goHome();
                  } else closeFlow();
                }}
                className={`rounded-full p-2 text-slate-500 transition hover:bg-slate-100 ${
                  isDesktop ? 'hover:text-slate-800' : ''
                }`}
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className={`min-w-0 flex-1 ${isDesktop ? 'text-left' : 'text-center'}`}>
              <p
                className={`font-semibold text-slate-900 ${isDesktop ? 'text-base' : 'text-center text-sm text-slate-700'}`}
              >
                {flow.step === 'setup' && 'Style & medium'}
                {flow.step === 'capture' && (isDesktop ? 'Upload your painting' : 'Capture')}
                {flow.step === 'analyzing' ? (
                  <>
                    Analyzing
                    <AnalyzingHeaderEllipsis />
                  </>
                ) : null}
                {flow.step === 'analysis_unavailable' && 'Unable to analyze'}
                {flow.step === 'results' && 'Critique'}
              </p>
              {isDesktop ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {flow.step === 'setup' && 'Choose style and medium, then upload or continue.'}
                  {flow.step === 'capture' && 'Add a clear photo of the full painting.'}
                  {flow.step === 'analyzing' && 'Evidence, critic review, and teaching plan are being generated.'}
                  {flow.step === 'analysis_unavailable' && 'Try a clearer photograph and start again from Home.'}
                  {flow.step === 'results' && 'Ratings, feedback, and optional preview edits.'}
                </p>
              ) : null}
            </div>
            <span className="w-9 shrink-0" />
          </div>

          <div
            ref={flowScrollRef}
            className={`min-h-0 flex-1 overflow-y-auto ${
              isDesktop
                ? 'w-full bg-white px-10 pb-8 pt-6 xl:px-14'
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
                        onClick={() => {
                          cancelClassifyRequest();
                          clearAsyncState();
                          setFlow((f) => (f?.step === 'setup' ? switchToManualStyle(f) : f));
                        }}
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
                        onClick={() => {
                          clearAsyncState();
                          setFlow((f) => (f?.step === 'setup' ? switchToAutoStyle(f) : f));
                        }}
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
                        onClick={() => {
                          clearAsyncState();
                          setFlow((f) => (f?.step === 'setup' ? chooseStyle(f, s) : f));
                        }}
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
                        onClick={() => {
                          clearAsyncState();
                          setFlow((f) => (f?.step === 'setup' ? chooseMedium(f, m) : f));
                        }}
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

                {requestErrorNotice}

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
                        onClick={() => {
                          cancelClassifyRequest();
                          clearAsyncState();
                          setFlow((f) => {
                            if (f?.step !== 'setup') return f;
                            const cleared = clearClassifySource(f);
                            return enterCapture(cleared) ?? f;
                          });
                        }}
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
                    onClick={() => {
                      cancelClassifyRequest();
                      clearAsyncState();
                      setFlow((f) => (f?.step === 'setup' ? enterCapture(f) ?? f : f));
                    }}
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
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
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

                {requestErrorNotice}

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

            {flow.step === 'analysis_unavailable' && (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-12 text-center">
                <p className="max-w-md font-display text-xl font-normal leading-snug text-slate-900 md:text-2xl">
                  Your painting is unable to be analyzed.
                </p>
                <p className="max-w-sm text-sm leading-relaxed text-slate-600">
                  Try a clearer photo: even light, no heavy glare, full painting in frame, and sharp focus. Then run a new
                  critique from Home.
                </p>
                <button
                  type="button"
                  onClick={goHome}
                  className="rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500 active:scale-[0.99]"
                >
                  Back to Home
                </button>
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
                </div>
                <div className="min-h-0 space-y-4">
                <CritiquePanels
                  critique={flow.critique}
                  paintingImageSrc={flow.imageDataUrl}
                  onLearnMore={rememberCritiqueReturn}
                  canGenerateAiEdits
                  onGenerateAiEditForCriterion={runPreviewEdit}
                  previewEditIdByCriterion={previewEditIdByCriterion}
                  onFocusSessionPreviewForCriterion={focusSessionPreviewForCriterion}
                  previewLoading={preview.loading}
                  previewLoadingTarget={preview.loadingTarget}
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
                                onClick={() => selectEdit(e.id)}
                                className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition ${
                                  preview.activeEditId === e.id
                                    ? 'border-violet-500 bg-violet-100 text-violet-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300'
                                }`}
                              >
                                {previewEditChipText(e.mode, e.criterion)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {preview.error ? (
                          <div className="mt-2 space-y-2 text-center">
                            <p
                              className={`text-xs ${
                                preview.errorPaymentRequired ? 'text-amber-800' : 'text-red-600'
                              }`}
                            >
                              {preview.error}
                            </p>
                            {preview.errorPaymentRequired ? (
                              <>
                                <p className="text-[11px] leading-relaxed text-amber-900/85">
                                  AI preview is {previewPriceLabel} per generation (USD).
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void startPreviewCheckout()}
                                  className="w-full rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                                >
                                  Pay {previewPriceLabel} with Stripe
                                </button>
                              </>
                            ) : null}
                          </div>
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
                                onClick={openCompare}
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
                                onClick={openCompare}
                                className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-white px-4 py-6 text-center shadow-sm transition hover:border-violet-400 hover:bg-violet-50/50 active:scale-[0.99]"
                              >
                                <span className="text-sm font-bold text-violet-800">
                                  {preview.compareSeen ? 'Open compare again' : 'Tap to compare with your photo'}
                                </span>
                                {!preview.compareSeen ? (
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
                    ) : preview.error ? (
                      <div
                        className={`rounded-xl border px-3 py-2 text-center text-xs ${
                          preview.errorPaymentRequired
                            ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                            : 'border-red-200 bg-red-50/80 text-red-700'
                        }`}
                      >
                        <p>{preview.error}</p>
                        {preview.errorPaymentRequired ? (
                          <div className="mt-2 space-y-2">
                            <p className="text-[11px] leading-relaxed">AI preview is {previewPriceLabel} per generation.</p>
                            <button
                              type="button"
                              onClick={() => void startPreviewCheckout()}
                              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-700"
                            >
                              Pay {previewPriceLabel} with Stripe
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null
                  }
                />
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!flow || flow.step !== 'results') return;
                      const result = storagePersist(flow);
                      if (result) {
                        setFlow((cur) => cur && cur.step === 'results' ? { ...cur, mode: 'resubmit', targetPainting: result.targetPainting, savedPaintingId: result.savedPaintingId } : cur);
                      }
                    }}
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
        {preview.compareOpen &&
        flow.step === 'results' &&
        flow.imageDataUrl &&
        activePreviewImageDataUrl &&
        previewTarget ? (
          <PreviewCompareOverlay
            originalSrc={flow.imageDataUrl}
            revisedSrc={activePreviewImageDataUrl}
            target={previewTarget}
            onClose={closeCompare}
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
