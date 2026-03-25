import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import { CritiquePanels } from '../components/CritiquePanels';
import { PreviewEditBlendCard } from '../components/PreviewEditBlendCard';
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
  isDesktop?: boolean;
};

function previewTargetForVersion(
  critique: CritiqueResult,
  criterion: (typeof CRITERIA)[number]
) {
  const cat = critique.categories.find((c) => c.criterion === criterion);
  return cat ?? critique.categories[0]!;
}

export function StudioTab({
  paintings,
  onBack,
  onDelete,
  onResubmit,
  onSelectPainting,
  selectedId,
  isDesktop = false,
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
    const latest = versions[vCount - 1]!;
    const pct = progressPercentFromPainting(selected);
    const latestPreview = latest.previewEdit;

    const shell = isDesktop
      ? 'animate-slide-up flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-1'
      : 'animate-slide-up space-y-4 px-4 pb-28 pt-2 md:pb-8';

    return (
      <div className={shell}>
        <div className="flex shrink-0 items-center gap-2">
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

        <div
          className={
            isDesktop ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1' : 'contents'
          }
        >
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
            <img
              src={versions[0]?.imageDataUrl}
              alt=""
              className={`w-full bg-slate-100 object-contain ${isDesktop ? 'max-h-[min(42vh,22rem)]' : 'max-h-80'}`}
            />
          </figure>
        )}

        {latestPreview ? (
          <section className="rounded-2xl border border-violet-200/80 bg-white p-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">Saved AI preview</h3>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Blend slider uses this version’s photo and the illustrative edit saved from critique.
            </p>
            <div className="mt-3">
              <PreviewEditBlendCard
                originalSrc={latest.imageDataUrl}
                revisedSrc={latestPreview.imageDataUrl}
                target={previewTargetForVersion(latest.critique, latestPreview.criterion)}
              />
            </div>
          </section>
        ) : null}

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
      </div>
    );
  }

  const listShell = isDesktop
    ? 'animate-fade-in flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-1'
    : 'animate-fade-in space-y-4 px-4 pb-28 pt-4 md:pb-8';

  return (
    <div className={listShell}>
      <div className="flex shrink-0 items-center gap-2">
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
        <ul
          className={`space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 ${
            isDesktop ? 'min-h-0 flex-1 overflow-y-auto pb-1 lg:grid-cols-3' : ''
          }`}
        >
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
