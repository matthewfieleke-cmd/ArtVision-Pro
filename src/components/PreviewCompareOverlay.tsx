import { useCallback, useEffect, useRef, useState } from 'react';
import type { CritiqueCategory } from '../types';
import { buildDifferenceOverlayDataUrl } from '../previewDiff';

function clipSentence(s: string, max = 220): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

type Props = {
  originalSrc: string;
  revisedSrc: string;
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'feedback' | 'actionPlan'>;
  onClose: () => void;
};

const HOLD_MS = 380;

export function PreviewCompareOverlay({ originalSrc, revisedSrc, target, onClose }: Props) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diffUrl, setDiffUrl] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(true);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDiffUrl(null);
    setDiffBusy(true);

    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
      });

    void (async () => {
      try {
        const [o, r] = await Promise.all([load(originalSrc), load(revisedSrc)]);
        if (cancelled) return;
        const url = await buildDifferenceOverlayDataUrl(o, r);
        if (!cancelled) {
          setDiffUrl(url);
          setDiffBusy(false);
        }
      } catch {
        if (!cancelled) setDiffBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originalSrc, revisedSrc]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const onRevPointerDown = useCallback(() => {
    clearHoldTimer();
    holdTimer.current = setTimeout(() => setHolding(true), HOLD_MS);
  }, [clearHoldTimer]);

  const onRevPointerEnd = useCallback(() => {
    clearHoldTimer();
    setHolding(false);
  }, [clearHoldTimer]);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-slate-100"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-compare-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700/80 bg-slate-900/95 px-3 py-3">
        <h2 id="preview-compare-title" className="font-display text-base font-normal text-white">
          Suggested changes
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-500"
        >
          Back to critique
        </button>
      </div>

      <p className="shrink-0 border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-center text-[11px] text-violet-200/90">
        Turn your phone horizontal for a true side-by-side view.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-300">
            <p>
              This preview focuses on <strong className="text-violet-300">{target.criterion}</strong> (current level:{' '}
              {target.level}). It illustrates where the AI applied the suggested change—interpretation only, not a
              substitute for repainting.
            </p>
            <p className="mt-2">{clipSentence(target.feedback, 300)}</p>
            <p className="mt-2">{clipSentence(target.actionPlan, 300)}</p>
          </div>

          <div className="flex min-h-[40vh] flex-col gap-3 landscape:flex-row landscape:items-stretch landscape:gap-2">
            <figure className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700/80 bg-slate-900/30 p-2">
              <figcaption className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Your photo
              </figcaption>
              <div className="relative min-h-[28vh] flex-1 overflow-hidden rounded-lg bg-slate-950 landscape:min-h-0">
                <img src={originalSrc} alt="" className="h-full w-full object-contain" draggable={false} />
              </div>
            </figure>

            <figure className="flex min-h-0 flex-1 flex-col rounded-xl border border-violet-500/40 bg-violet-950/20 p-2">
              <figcaption className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
                AI preview (illustrative)
              </figcaption>
              <div
                className="relative min-h-[28vh] flex-1 touch-none overflow-hidden rounded-lg bg-slate-950 landscape:min-h-0"
                onPointerDown={onRevPointerDown}
                onPointerUp={onRevPointerEnd}
                onPointerCancel={onRevPointerEnd}
                onPointerLeave={onRevPointerEnd}
                role="img"
                aria-label="Hold to highlight differences from your original photo"
              >
                <img src={revisedSrc} alt="" className="h-full w-full object-contain" draggable={false} />
                {diffUrl ? (
                  <img
                    src={diffUrl}
                    alt=""
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${
                      holding ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ) : null}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent px-2 py-2 text-center text-[10px] text-slate-300 transition-opacity ${
                    holding ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {diffBusy
                    ? 'Preparing difference map…'
                    : diffUrl
                      ? 'Press and hold this image to highlight where pixels differ from your photo.'
                      : 'Difference map unavailable for this pair.'}
                </div>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );
}
