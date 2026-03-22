import { Camera, ChevronRight } from 'lucide-react';
import type { SavedPainting } from '../types';
import { DAILY_MASTERPIECES } from '../types';
import { formatShortDate, progressPercentFromPainting } from '../utils';

type Props = {
  paintings: SavedPainting[];
  onNewCritique: () => void;
  onOpenPainting: (id: string) => void;
};

export function HomeTab({ paintings, onNewCritique, onOpenPainting }: Props) {
  const dayIndex =
    Math.floor(Date.now() / 86400000) % DAILY_MASTERPIECES.length;
  const daily = DAILY_MASTERPIECES[dayIndex];
  const wip = [...paintings].sort(
    (a, b) =>
      new Date(b.versions[b.versions.length - 1]?.createdAt ?? 0).getTime() -
      new Date(a.versions[a.versions.length - 1]?.createdAt ?? 0).getTime()
  );

  return (
    <div className="animate-fade-in space-y-8 px-4 pb-28 pt-4">
      <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600/90">Daily masterpiece</p>
        <p className="mt-2 font-display text-xl text-slate-900">
          <span className="text-violet-700">{daily.artist}</span>
          <span className="text-slate-300"> — </span>
          <em className="not-italic text-slate-800">{daily.work}</em>
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">{daily.style}</p>
      </section>

      <header className="text-center">
        <h2 className="font-display text-3xl font-normal tracking-tight text-slate-900">Ready for a critique?</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          Capture your painting, choose style and medium, and get structured feedback on eight criteria—benchmarked
          against the masters.
        </p>
      </header>

      <button
        type="button"
        onClick={onNewCritique}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-left text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-500 hover:to-violet-500 active:scale-[0.99]"
      >
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/20 p-3 ring-1 ring-white/30">
              <Camera className="h-8 w-8" strokeWidth={2} />
            </div>
            <div>
              <div className="text-lg font-bold">New critique</div>
              <div className="text-sm text-violet-100/95">Style, medium, capture</div>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 opacity-90 transition group-hover:translate-x-0.5" />
        </div>
      </button>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Work in progress</h3>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {wip.length === 0 ? (
            <div className="min-h-[11rem] min-w-[100%] rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No paintings saved yet. Run a critique and tap “Save to studio.”
            </div>
          ) : (
            wip.map((p) => {
              const last = p.versions[p.versions.length - 1];
              const pct = progressPercentFromPainting(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenPainting(p.id)}
                  className="w-36 shrink-0 text-left"
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
                    <div className="relative aspect-[3/4] bg-slate-100">
                      {last?.imageDataUrl ? (
                        <img
                          src={last.imageDataUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/85 to-transparent p-2 pt-8">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                          <div
                            className="h-full rounded-full bg-violet-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-slate-800">{p.title}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {p.style} · {formatShortDate(last?.createdAt ?? '')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
