import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  FolderOpen,
  ImagePlus,
  Loader2,
  Palette,
  Save,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { CriterionLearnLink } from './components/CriterionLearnLink';
import { PreviewCompareOverlay } from './components/PreviewCompareOverlay';
import { analyzePainting } from './analyzePainting';
import { classifyStyleFromMetrics } from './classifyStyleHeuristic';
import { fetchClassifyStyleFromApi } from './classifyStyleApi';
import { fetchCritiqueFromApi, shouldTryApiFirst } from './critiqueApi';
import { fetchPreviewEdit } from './previewEditApi';
import { compressDataUrl, fileToDataUrl } from './imageUtils';
import { computeImageMetrics } from './imageMetrics';
import { useCameraCapture } from './hooks/useCameraCapture';
import { advanceDailyMasterpieceIndex } from './dailyMasterpieceCycle';
import { loadPaintings, savePaintings } from './storage';
import { BenchmarksTab } from './screens/BenchmarksTab';
import { HomeTab } from './screens/HomeTab';
import { ProfileTab } from './screens/ProfileTab';
import { StudioTab } from './screens/StudioTab';
import type {
  CritiqueCategory,
  CritiqueResult,
  Medium,
  SavedPainting,
  Style,
  TabId,
  WizardStep,
} from './types';
import { MEDIUMS, RATING_LEVELS, STYLES } from './types';

type StyleMode = 'manual' | 'auto';

type FlowState = {
  step: WizardStep;
  styleMode: StyleMode;
  style: Style | null;
  medium: Medium | null;
  /** Optional title for this work (new critique or override on resubmit) */
  workingTitle: string;
  imageDataUrl?: string;
  critique?: CritiqueResult;
  critiqueSource?: 'api' | 'local';
  /** After auto style: vision or heuristic note */
  styleClassifyMeta?: { rationale: string; source: 'api' | 'local' };
  /** Photo uploaded for “Categorize for me”—reuse for critique without capture step */
  classifySourceImageDataUrl?: string;
  mode: 'new' | 'resubmit';
  targetPainting?: SavedPainting;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function priorityCritiqueCategory(categories: CritiqueCategory[]): CritiqueCategory {
  const rank = (l: (typeof RATING_LEVELS)[number]) => RATING_LEVELS.indexOf(l);
  return categories.reduce((a, b) => (rank(a.level) <= rank(b.level) ? a : b));
}

async function classifyStyleFromImage(dataUrl: string): Promise<{
  style: Style;
  rationale: string;
  source: 'api' | 'local';
}> {
  const sample = await compressDataUrl(dataUrl);
  if (shouldTryApiFirst()) {
    try {
      const r = await fetchClassifyStyleFromApi(sample);
      return { ...r, source: 'api' as const };
    } catch (e) {
      console.warn('Style API fallback:', e);
    }
  }
  const m = await computeImageMetrics(sample);
  const h = classifyStyleFromMetrics(m);
  return { style: h.style, rationale: h.rationale, source: 'local' as const };
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [paintings, setPaintings] = useState<SavedPainting[]>(() => loadPaintings());
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewImageDataUrl, setPreviewImageDataUrl] = useState<string | null>(null);
  const [previewCompareOpen, setPreviewCompareOpen] = useState(false);
  /** After user opens compare once for this preview, show a compact link instead of the full tap prompt. */
  const [previewCompareSeen, setPreviewCompareSeen] = useState(false);

  const { videoRef, status: camStatus, error: camError, start: startCamera, stop: stopCamera, captureFrame } =
    useCameraCapture();

  useEffect(() => {
    try {
      savePaintings(paintings);
    } catch (e) {
      console.error(e);
    }
  }, [paintings]);

  const closeFlow = useCallback(() => {
    stopCamera();
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
    advanceDailyMasterpieceIndex();
    stopCamera();
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
    if (flow?.step === 'capture') {
      void startCamera();
      return () => stopCamera();
    }
    stopCamera();
  }, [flow?.step, startCamera, stopCamera]);

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

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file || !flow) return;
      const url = await fileToDataUrl(file);
      await runAnalysis(url);
    },
    [flow, runAnalysis]
  );

  const onPickFileForClassify = useCallback(async (file: File | null) => {
    if (!file || !flowRef.current || flowRef.current.step !== 'setup') return;
    setClassifyBusy(true);
    setAnalyzeError(null);
    try {
      const url = await fileToDataUrl(file);
      const { style, rationale, source } = await classifyStyleFromImage(url);
      setFlow((cur) =>
        cur
          ? {
              ...cur,
              style,
              styleClassifyMeta: { rationale, source },
              classifySourceImageDataUrl: url,
            }
          : cur
      );
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Could not categorize style');
    } finally {
      setClassifyBusy(false);
    }
  }, []);

  const onShutter = useCallback(async () => {
    const shot = captureFrame();
    if (!shot) {
      setAnalyzeError('Could not read from camera. Try upload.');
      return;
    }
    await runAnalysis(shot);
  }, [captureFrame, runAnalysis]);

  const persistResult = useCallback(() => {
    if (!flow?.critique || !flow.imageDataUrl || !flow.style || !flow.medium) return;
    const savedTitle =
      flow.workingTitle.trim() ||
      flow.critique.paintingTitle?.trim() ||
      undefined;
    const critiqueToStore: CritiqueResult = {
      ...flow.critique,
      ...(savedTitle ? { paintingTitle: savedTitle } : {}),
    };
    const version = {
      id: newId(),
      imageDataUrl: flow.imageDataUrl,
      createdAt: new Date().toISOString(),
      critique: critiqueToStore,
    };
    if (flow.mode === 'resubmit' && flow.targetPainting) {
      const t = flow.workingTitle.trim();
      setPaintings((ps) =>
        ps.map((p) =>
          p.id === flow.targetPainting!.id
            ? {
                ...p,
                ...(t.length > 0 ? { title: t } : {}),
                versions: [...p.versions, version],
              }
            : p
        )
      );
      setStudioSelectedId(flow.targetPainting.id);
      setTab('studio');
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
      setStudioSelectedId(painting.id);
      setTab('studio');
    }
    closeFlow();
  }, [flow, closeFlow]);

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

  const runPreviewEdit = useCallback(async () => {
    if (!flow?.imageDataUrl || !flow.style || !flow.medium || !priorityCategory) return;
    if (!shouldTryApiFirst()) {
      setPreviewError('Connect the API (deploy with OPENAI_API_KEY) to generate previews.');
      return;
    }
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { imageDataUrl } = await fetchPreviewEdit({
        imageDataUrl: flow.imageDataUrl,
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
  }, [flow?.imageDataUrl, flow?.style, flow?.medium, priorityCategory]);

  const openPreviewCompare = useCallback(() => {
    setPreviewCompareOpen(true);
    setPreviewCompareSeen(true);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 px-4 py-3 shadow-soft backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
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
          />
        )}
        {!flow && tab === 'benchmarks' && <BenchmarksTab />}
        {!flow && tab === 'profile' && <ProfileTab />}
      </main>

      {!flow && (
        <BottomNav
          active={tab}
          onChange={(t) => {
            if (t === 'home') advanceDailyMasterpieceIndex();
            setTab(t);
          }}
        />
      )}

      {flow && (
        <>
        <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2.5 shadow-soft backdrop-blur-sm">
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
                  setFlow({
                    ...flow,
                    step: backToSetup ? 'setup' : 'capture',
                    ...(backToSetup ? { classifySourceImageDataUrl: flow.imageDataUrl } : {}),
                  });
                }
                else closeFlow();
              }}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <p className="flex-1 text-center text-sm font-semibold text-slate-700">
              {flow.step === 'setup' && 'Style & medium'}
              {flow.step === 'capture' && 'Capture'}
              {flow.step === 'analyzing' && 'Analyzing'}
              {flow.step === 'results' && 'Critique'}
            </p>
            <span className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-5">
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
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
                      Use camera or a different photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canContinueFromSetup}
                    onClick={() => setFlow((f) => (f ? { ...f, step: 'capture' } : f))}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition enabled:active:scale-[0.99] disabled:opacity-35"
                  >
                    Continue to capture
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    autoComplete="off"
                  />
                </div>
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
                {analyzeError ? (
                  <p className="text-center text-sm text-red-600">{analyzeError}</p>
                ) : null}
                <p className="text-center text-xs text-slate-500">
                  Align the canvas in frame. Even, diffuse light gives the fairest read.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  <button
                    type="button"
                    onClick={() => void onShutter()}
                    disabled={camStatus !== 'live'}
                    className="rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-35"
                  >
                    Capture
                  </button>
                </div>
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
              <div className="space-y-4 pb-8 animate-fade-in">
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    autoComplete="off"
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                  <img src={flow.imageDataUrl} alt="" className="max-h-56 w-full object-contain bg-slate-100" />
                </div>
                {flow.critiqueSource === 'local' ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
                    Offline / fallback critique (heuristic). Set{' '}
                    <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">OPENAI_API_KEY</code> and run{' '}
                    <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">npm run dev</code> (API + UI) for
                    full vision feedback.
                  </p>
                ) : null}
                {flow.critique.comparisonNote ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-800">vs. previous</span>
                    <p className="mt-1 leading-relaxed text-amber-950/95">{flow.critique.comparisonNote}</p>
                  </div>
                ) : null}
                <p className="text-sm leading-relaxed text-slate-600">{flow.critique.summary}</p>

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
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      {previewLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating preview…
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          {previewImageDataUrl ? 'Regenerate preview' : 'Generate preview'}
                        </>
                      )}
                    </button>
                    {previewError ? (
                      <p className="mt-2 text-center text-xs text-red-600">{previewError}</p>
                    ) : null}
                    {previewImageDataUrl ? (
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
                    ) : null}
                  </section>
                ) : null}

                {flow.critique.categories.map((cat) => (
                  <article
                    key={cat.criterion}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{cat.criterion}</h3>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                        {cat.level}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all duration-700"
                        style={{
                          width:
                            cat.level === 'Beginner'
                              ? '25%'
                              : cat.level === 'Intermediate'
                                ? '50%'
                                : cat.level === 'Advanced'
                                  ? '75%'
                                  : '100%',
                        }}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{cat.feedback}</p>
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next level</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{cat.actionPlan}</p>
                    </div>
                    <CriterionLearnLink criterion={cat.criterion} />
                  </article>
                ))}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={persistResult}
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
        </>
      )}
    </div>
  );
}
