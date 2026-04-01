import { PreviewEditBlendCard } from './PreviewEditBlendCard';
import type { CritiqueCategory } from '../types';

type Props = {
  originalSrc: string;
  revisedSrc: string;
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'feedback' | 'actionPlan' | 'actionPlanSteps'> & {
    anchor?: CritiqueCategory['anchor'];
    editPlan?: CritiqueCategory['editPlan'];
    studioChangeRecommendation?: string;
  };
  onClose: () => void;
};

/** Full-screen compare after “Perform single change” on the results screen. */
export function PreviewCompareOverlay({ originalSrc, revisedSrc, target, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-slate-100 lg:left-60"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-compare-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700/80 bg-slate-900/95 px-4 py-3 lg:px-6">
        <h2 id="preview-compare-title" className="font-display text-base font-normal text-white lg:text-lg">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 lg:px-8 lg:py-5">
        <div className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto lg:overflow-hidden">
          <PreviewEditBlendCard
            variant="dark"
            originalSrc={originalSrc}
            revisedSrc={revisedSrc}
            target={target}
            className="lg:h-full lg:max-h-full lg:overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
