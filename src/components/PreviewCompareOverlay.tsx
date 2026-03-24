import { PreviewEditBlendCard } from './PreviewEditBlendCard';
import type { CritiqueCategory } from '../types';

type Props = {
  originalSrc: string;
  revisedSrc: string;
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'feedback' | 'actionPlan'>;
  onClose: () => void;
};

/** Full-screen compare after “Generate preview” on the results screen. */
export function PreviewCompareOverlay({ originalSrc, revisedSrc, target, onClose }: Props) {
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
        <div className="mx-auto max-w-6xl">
          <PreviewEditBlendCard
            variant="dark"
            originalSrc={originalSrc}
            revisedSrc={revisedSrc}
            target={target}
          />
        </div>
      </div>
    </div>
  );
}
