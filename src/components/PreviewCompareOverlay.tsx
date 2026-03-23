import { useEffect, useState, type CSSProperties } from 'react';
import type { CritiqueCategory } from '../types';

function clipSentence(s: string, max = 220): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** Natural aspect ratio (width / height) of the user's photo for matched preview framing. */
function useOriginalAspectRatio(originalSrc: string): number | null {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setRatio(null);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > 0 && h > 0) setRatio(w / h);
    };
    img.onerror = () => {
      if (!cancelled) setRatio(null);
    };
    img.src = originalSrc;
    return () => {
      cancelled = true;
    };
  }, [originalSrc]);

  return ratio;
}

const overlayImgClass =
  'absolute inset-0 h-full w-full object-contain object-center select-none';

type Props = {
  originalSrc: string;
  revisedSrc: string;
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'feedback' | 'actionPlan'>;
  onClose: () => void;
};

/** 0 = show only original; 100 = show only AI revision (full suggested changes). */
export function PreviewCompareOverlay({ originalSrc, revisedSrc, target, onClose }: Props) {
  const [blend, setBlend] = useState(100);
  const aspectRatio = useOriginalAspectRatio(originalSrc);

  useEffect(() => {
    setBlend(100);
  }, [originalSrc, revisedSrc]);

  const revisedOpacity = blend / 100;

  /** Same box for “your photo” and the blend so framing matches; AI is cropped to this frame like the original. */
  const frameStyle: CSSProperties =
    aspectRatio != null
      ? { aspectRatio, width: '100%' }
      : { aspectRatio: '3 / 4', width: '100%', minHeight: 'min(40vh, 85vw)' };

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

          <div className="flex flex-col gap-3">
            <figure className="flex min-h-0 flex-col rounded-xl border border-slate-700/80 bg-slate-900/30 p-2">
              <figcaption className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Your photo
              </figcaption>
              <div className="relative mx-auto max-w-full overflow-hidden rounded-lg bg-slate-950" style={frameStyle}>
                <img src={originalSrc} alt="" className={overlayImgClass} draggable={false} />
              </div>
            </figure>

            <figure className="flex min-h-0 flex-col rounded-xl border border-violet-500/40 bg-violet-950/20 p-2">
              <figcaption className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
                AI preview (illustrative)
              </figcaption>
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2">
                  <label htmlFor="preview-blend-slider" className="sr-only">
                    Blend between your photo and the AI-generated preview
                  </label>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>Your photo</span>
                    <span className="text-violet-300/90">AI changes</span>
                  </div>
                  <input
                    id="preview-blend-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={blend}
                    onChange={(e) => setBlend(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-violet-500"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={blend}
                    aria-valuetext={
                      blend === 0
                        ? 'Showing your original photo only'
                        : blend === 100
                          ? 'Showing full AI preview'
                          : `${blend}% AI preview blended with your photo`
                    }
                  />
                  <p className="mt-1.5 text-center text-[10px] leading-snug text-slate-400">
                    Slide right for the full suggested edit; slide left to match your original photo.
                  </p>
                </div>
                <div
                  className="relative mx-auto max-w-full overflow-hidden rounded-lg bg-slate-950"
                  style={frameStyle}
                >
                  <img src={originalSrc} alt="" className={overlayImgClass} draggable={false} />
                  <img
                    src={revisedSrc}
                    alt=""
                    className={`${overlayImgClass} transition-opacity duration-75 ease-out`}
                    style={{ opacity: revisedOpacity }}
                    draggable={false}
                  />
                </div>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );
}
