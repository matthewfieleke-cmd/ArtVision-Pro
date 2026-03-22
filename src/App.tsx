import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { analyzePainting } from './analyzePainting';
import { fetchCritiqueFromApi, shouldTryApiFirst } from './critiqueApi';
import { compressDataUrl, fileToDataUrl } from './imageUtils';
import { useCameraCapture } from './hooks/useCameraCapture';
import { loadPaintings, savePaintings } from './storage';
import { BenchmarksTab } from './screens/BenchmarksTab';
import { HomeTab } from './screens/HomeTab';
import { ProfileTab } from './screens/ProfileTab';
import { StudioTab } from './screens/StudioTab';
import type { CritiqueResult, Medium, SavedPainting, Style, TabId, WizardStep } from './types';
import { MEDIUMS, STYLES } from './types';

type FlowState = {
  step: WizardStep;
  style: Style | null;
  medium: Medium | null;
  imageDataUrl?: string;
  critique?: CritiqueResult;
  /** How the current critique was produced */
  critiqueSource?: 'api' | 'local';
  mode: 'new' | 'resubmit';
  targetPainting?: SavedPainting;
};

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [paintings, setPaintings] = useState<SavedPainting[]>(() => loadPaintings());
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

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
  }, [stopCamera]);

  const startNewCritique = useCallback(() => {
    setAnalyzeError(null);
    setFlow({
      mode: 'new',
      step: 'setup',
      style: null,
      medium: null,
    });
  }, []);

  const startResubmit = useCallback((p: SavedPainting) => {
    setAnalyzeError(null);
    stopCamera();
    setFlow({
      mode: 'resubmit',
      step: 'capture',
      style: p.style,
      medium: p.medium,
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

      if (shouldTryApiFirst()) {
        try {
          critique = await fetchCritiqueFromApi({
            style: f.style,
            medium: f.medium,
            imageDataUrl: compressed,
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
          critique = await analyzePainting(compressed, f.style, f.medium, prevPayload);
          critiqueSource = 'local';
        }
      } else {
        critique = await analyzePainting(compressed, f.style, f.medium, prevPayload);
        critiqueSource = 'local';
      }

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
      setFlow((cur) => (cur ? { ...cur, step: 'capture' } : cur));
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
    const version = {
      id: newId(),
      imageDataUrl: flow.imageDataUrl,
      createdAt: new Date().toISOString(),
      critique: flow.critique,
    };
    if (flow.mode === 'resubmit' && flow.targetPainting) {
      setPaintings((ps) =>
        ps.map((p) =>
          p.id === flow.targetPainting!.id
            ? { ...p, versions: [...p.versions, version] }
            : p
        )
      );
      setStudioSelectedId(flow.targetPainting.id);
      setTab('studio');
    } else {
      const title = `Work · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
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

  return (
    <div className="min-h-[100dvh] bg-ink-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/90 px-4 py-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-white">
              ArtVision <span className="text-indigo-400">Pro</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-500">Painting mentor</p>
          </div>
          {flow ? (
            <button
              type="button"
              onClick={closeFlow}
              className="rounded-full p-2 text-ink-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <Sparkles className="h-6 w-6 text-indigo-400/80" aria-hidden />
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
            onBack={() => setTab('home')}
            onDelete={deletePainting}
            onResubmit={startResubmit}
          />
        )}
        {!flow && tab === 'benchmarks' && <BenchmarksTab />}
        {!flow && tab === 'profile' && <ProfileTab />}
      </main>

      {!flow && <BottomNav active={tab} onChange={setTab} />}

      {flow && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink-900 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                if (flow.step === 'setup') closeFlow();
                else if (flow.step === 'capture') {
                  if (flow.mode === 'resubmit') closeFlow();
                  else setFlow({ ...flow, step: 'setup' });
                } else if (flow.step === 'results') setFlow({ ...flow, step: 'capture' });
                else closeFlow();
              }}
              className="rounded-full p-2 text-ink-400 hover:bg-white/5 hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <p className="flex-1 text-center text-sm font-medium text-ink-300">
              {flow.step === 'setup' && 'Style & medium'}
              {flow.step === 'capture' && 'Capture'}
              {flow.step === 'analyzing' && 'Analyzing'}
              {flow.step === 'results' && 'Critique'}
            </p>
            <span className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
            {flow.step === 'setup' && (
              <div className="animate-slide-up space-y-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-500">Style</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFlow((f) => (f ? { ...f, style: s } : f))}
                        className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition ${
                          flow.style === s
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-100'
                            : 'border-white/10 bg-ink-800/50 text-ink-200 hover:border-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-500">Medium</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {MEDIUMS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFlow((f) => (f ? { ...f, medium: m } : f))}
                        className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition ${
                          flow.medium === m
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-100'
                            : 'border-white/10 bg-ink-800/50 text-ink-200 hover:border-white/20'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!flow.style || !flow.medium}
                  onClick={() => setFlow((f) => (f ? { ...f, step: 'capture' } : f))}
                  className="w-full rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white disabled:opacity-30"
                >
                  Continue to capture
                </button>
              </div>
            )}

            {flow.step === 'capture' && (
              <div className="space-y-4 animate-slide-up">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                  {camStatus !== 'live' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-sm text-ink-300">
                      {camStatus === 'requesting' ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                          Starting camera…
                        </>
                      ) : (
                        <>
                          <Camera className="h-8 w-8 text-ink-500" />
                          <p>{camError ?? 'Camera unavailable'}</p>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                {analyzeError ? (
                  <p className="text-center text-sm text-red-400">{analyzeError}</p>
                ) : null}
                <p className="text-center text-xs text-ink-500">
                  Align the canvas in frame. Use even, diffuse light for best value and color reads.
                </p>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-ink-800 py-4 text-sm font-semibold text-ink-100">
                    <ImagePlus className="h-5 w-5" />
                    Upload
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
                    className="flex-[1.2] rounded-xl bg-white py-4 text-sm font-bold text-ink-900 disabled:opacity-30"
                  >
                    Capture
                  </button>
                </div>
                <p className="text-center text-[10px] text-ink-600">
                  {flow.style} · {flow.medium}
                  {flow.mode === 'resubmit' ? ' · comparing to saved version' : ''}
                </p>
              </div>
            )}

            {flow.step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
                <p className="text-sm text-ink-400">
                  {shouldTryApiFirst()
                    ? 'Consulting the vision model—usually 15–45s…'
                    : 'Mapping value, edges, color, and surface…'}
                </p>
              </div>
            )}

            {flow.step === 'results' && flow.critique && flow.imageDataUrl && (
              <div className="space-y-4 pb-8 animate-fade-in">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <img src={flow.imageDataUrl} alt="" className="max-h-56 w-full object-contain bg-black" />
                </div>
                {flow.critiqueSource === 'local' ? (
                  <p className="rounded-lg border border-amber-500/25 bg-ink-800/80 px-3 py-2 text-center text-xs text-amber-200/90">
                    Offline / fallback critique (heuristic). Set{' '}
                    <code className="text-ink-300">OPENAI_API_KEY</code> and run{' '}
                    <code className="text-ink-300">npm run dev:full</code> for full vision feedback.
                  </p>
                ) : null}
                {flow.critique.comparisonNote ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-50/95">
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-400/90">vs. previous</span>
                    <p className="mt-1 leading-relaxed">{flow.critique.comparisonNote}</p>
                  </div>
                ) : null}
                <p className="text-sm leading-relaxed text-ink-300">{flow.critique.summary}</p>
                {flow.critique.categories.map((cat) => (
                  <article
                    key={cat.criterion}
                    className="rounded-xl border border-white/10 bg-ink-800/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">{cat.criterion}</h3>
                      <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-200">
                        {cat.level}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-950">
                      <div
                        className="h-full rounded-full bg-indigo-500"
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
                    <p className="mt-3 text-sm leading-relaxed text-ink-300">{cat.feedback}</p>
                    <div className="mt-3 rounded-lg border border-white/5 bg-ink-900/80 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Next level</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-200">{cat.actionPlan}</p>
                    </div>
                  </article>
                ))}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={persistResult}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white"
                  >
                    <Save className="h-5 w-5" />
                    {flow.mode === 'resubmit' ? 'Save new version' : 'Save to studio'}
                  </button>
                  <button
                    type="button"
                    onClick={closeFlow}
                    className="w-full rounded-xl border border-white/10 py-3 text-sm font-medium text-ink-400"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
