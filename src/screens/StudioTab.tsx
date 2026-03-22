import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import type { CritiqueResult, SavedPainting } from '../types';
import { CRITERIA } from '../types';
import { formatShortDate, progressPercentFromPainting } from '../utils';

type Props = {
  paintings: SavedPainting[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onResubmit: (painting: SavedPainting) => void;
  onSelectPainting: (id: string | null) => void;
  selectedId: string | null;
};

function levelWidth(level: string): string {
  switch (level) {
    case 'Beginner':
      return '25%';
    case 'Intermediate':
      return '50%';
    case 'Advanced':
      return '75%';
    default:
      return '100%';
  }
}

function CritiquePanels({ critique }: { critique: CritiqueResult }) {
  return (
    <div className="space-y-3">
      {critique.comparisonNote ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-800">vs. previous</span>
          <p className="mt-1 leading-relaxed text-amber-950/95">{critique.comparisonNote}</p>
        </div>
      ) : null}
      <p className="text-sm leading-relaxed text-slate-600">{critique.summary}</p>
      {critique.categories.map((cat) => (
        <article
          key={cat.criterion}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{cat.criterion}</h4>
            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
              {cat.level}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-700"
              style={{ width: levelWidth(cat.level) }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{cat.feedback}</p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next level</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{cat.actionPlan}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StudioTab({
  paintings,
  onBack,
  onDelete,
  onResubmit,
  onSelectPainting,
  selectedId,
}: Props) {
  const [compareIdx, setCompareIdx] = useState(0);
  const selected = useMemo(
    () => paintings.find((p) => p.id === selectedId) ?? null,
    [paintings, selectedId]
  );

  if (selected) {
    const versions = selected.versions;
    const vCount = versions.length;
    const safeIdx = Math.min(compareIdx, Math.max(0, vCount - 2));
    const left = vCount >= 2 ? versions[safeIdx] : versions[0];
    const right = vCount >= 2 ? versions[vCount - 1] : versions[0];
    const pct = progressPercentFromPainting(selected);

    return (
      <div className="animate-slide-up space-y-4 px-4 pb-28 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectPainting(null);
              setCompareIdx(0);
            }}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Back to studio list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-normal text-slate-900">{selected.title}</h2>
            <p className="text-xs text-slate-500">
              {selected.style} · {selected.medium} · {vCount} version{vCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {vCount >= 2 ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500" htmlFor="compare-slider">
              Before / after
            </label>
            <input
              id="compare-slider"
              type="range"
              min={0}
              max={vCount - 2}
              value={safeIdx}
              onChange={(e) => setCompareIdx(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="grid grid-cols-2 gap-2">
              <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={left.imageDataUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                <figcaption className="p-2 text-[10px] text-slate-500">
                  v{safeIdx + 1} · {formatShortDate(left.createdAt)}
                </figcaption>
              </figure>
              <figure className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
                <img src={right.imageDataUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                <figcaption className="p-2 text-[10px] text-slate-500">
                  Latest · {formatShortDate(right.createdAt)}
                </figcaption>
              </figure>
            </div>
          </div>
        ) : (
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img src={versions[0]?.imageDataUrl} alt="" className="w-full object-contain max-h-80 bg-slate-100" />
          </figure>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onResubmit(selected)}
            className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-md"
          >
            <Camera className="h-4 w-4" />
            New version
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this painting and all versions?')) onDelete(selected.id);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>

        <CritiquePanels critique={versions[versions.length - 1]!.critique} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 px-4 pb-28 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Back home"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="font-display text-2xl font-normal text-slate-900">Studio</h2>
          <p className="text-sm text-slate-500">Saved paintings and version history</p>
        </div>
      </div>

      {paintings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nothing saved yet. Complete a critique and tap “Save to studio.”
        </div>
      ) : (
        <ul className="space-y-3">
          {paintings.map((p) => {
            const last = p.versions[p.versions.length - 1];
            const pct = progressPercentFromPainting(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectPainting(p.id)}
                  className="flex w-full gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {last?.imageDataUrl ? (
                      <img src={last.imageDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="truncate font-semibold text-slate-800">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      {p.style} · {p.medium}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {CRITERIA.length} criteria · {p.versions.length} version
                      {p.versions.length !== 1 ? 's' : ''} · {formatShortDate(last?.createdAt ?? '')}
                    </p>
                    <div className="mt-2 h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
