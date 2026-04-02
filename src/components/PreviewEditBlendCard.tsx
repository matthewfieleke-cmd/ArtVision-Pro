import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { CritiqueCategory } from '../types';

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
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'phase2' | 'phase3' | 'actionPlanSteps'> & {
    anchor?: CritiqueCategory['anchor'];
    editPlan?: CritiqueCategory['editPlan'];
    studioChangeRecommendation?: string;
  };
  /** Light background for Studio; dark for full-screen overlay */
  variant?: 'light' | 'dark';
  className?: string;
};

/**
 * Blend slider between critique photo and AI preview (same behavior as results overlay).
 * On large screens: discussion left; original and AI preview sit side by side; blend slider sits under the AI panel.
 */
export function PreviewEditBlendCard({
  originalSrc,
  revisedSrc,
  target,
  variant = 'light',
  className = '',
}: Props) {
  const sliderId = useId();
  const [blend, setBlend] = useState(100);
  const aspectRatio = useOriginalAspectRatio(originalSrc);

  useEffect(() => {
    setBlend(100);
  }, [originalSrc, revisedSrc]);

  const revisedOpacity = blend / 100;

  const frameStyle: CSSProperties =
    aspectRatio != null
      ? { aspectRatio, width: '100%', maxHeight: 'min(42vh, 520px)' }
      : { aspectRatio: '3 / 4', width: '100%', maxHeight: 'min(42vh, 520px)', minHeight: 'min(28vh, 200px)' };

  const isDark = variant === 'dark';
  const box = isDark
    ? 'rounded-xl border border-slate-700/80 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-300'
    : 'rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-sm leading-relaxed text-slate-700';
  const capMuted = isDark ? 'text-slate-500' : 'text-slate-500';
  const capViolet = isDark ? 'text-violet-300/90' : 'text-violet-700';
  const figBorder = isDark ? 'border-slate-700/80 bg-slate-900/30' : 'border-slate-200 bg-white';
  const figBorderAi = isDark ? 'border-violet-500/40 bg-violet-950/20' : 'border-violet-200 bg-violet-50/50';
  const innerBox = isDark ? 'border-slate-700/60 bg-slate-900/50' : 'border-slate-200 bg-white';
  const bgFrame = isDark ? 'bg-slate-950' : 'bg-slate-100';
  const hint = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      className={`flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-6 xl:gap-8 ${className}`}
    >
      <div className={`min-w-0 ${box}`}>
        <p>
          Suggested change preview for{' '}
          <strong className={isDark ? 'text-violet-300' : 'text-violet-800'}>{target.criterion}</strong>
          {target.level ? ` (current level: ${target.level})` : ''}. Illustrative only—not a substitute for repainting.
        </p>
        {target.anchor ? (
          <p className={`mt-2 text-xs ${capMuted}`}>
            Targeted area: <span className="font-medium">{target.anchor.areaSummary}</span>
          </p>
        ) : null}
        {target.studioChangeRecommendation?.trim() ? (
          <p className="mt-2 whitespace-pre-line font-medium">{target.studioChangeRecommendation.trim()}</p>
        ) : (
          <>
            <p className="mt-2 whitespace-pre-line">{target.phase2.criticsAnalysis.trim()}</p>
            <p className="mt-2 whitespace-pre-line">{target.phase3.teacherNextSteps.trim()}</p>
          </>
        )}
      </div>

      <div className="grid min-h-0 w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start sm:gap-4 lg:grid-cols-2 lg:gap-6">
        <figure className={`flex min-h-0 flex-col rounded-xl border p-2 ${figBorder}`}>
          <figcaption className={`mb-2 text-center text-[10px] font-bold uppercase tracking-wider ${capMuted}`}>
            Your photo
          </figcaption>
          <div
            className={`relative w-full min-w-0 overflow-hidden rounded-lg ${bgFrame}`}
            style={frameStyle}
          >
            <img src={originalSrc} alt="" className={overlayImgClass} draggable={false} />
          </div>
        </figure>

        <figure className={`flex min-h-0 flex-col rounded-xl border p-2 ${figBorderAi}`}>
          <figcaption className={`mb-2 text-center text-[10px] font-bold uppercase tracking-wider ${capViolet}`}>
            AI preview (blend)
          </figcaption>
          <div
            className={`relative w-full min-w-0 overflow-hidden rounded-lg ${bgFrame}`}
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
          <div className={`mt-3 rounded-lg border px-3 py-2 ${innerBox}`}>
            <label htmlFor={sliderId} className="sr-only">
              Blend between your photo and the AI-generated preview
            </label>
            <div
              className={`mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider ${capMuted}`}
            >
              <span>Your photo</span>
              <span className={capViolet}>AI changes</span>
            </div>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              value={blend}
              onChange={(e) => setBlend(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-violet-500"
            />
            <p className={`mt-1.5 text-center text-[10px] leading-snug ${hint}`}>
              Slide right for the full suggested edit; slide left for your original photo.
            </p>
          </div>
        </figure>
      </div>
    </div>
  );
}
