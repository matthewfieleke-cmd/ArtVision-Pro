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
      <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/80 to-ink-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300/90">Daily masterpiece</p>
        <p className="mt-2 font-display text-lg text-white">
          <span className="text-indigo-200">{daily.artist}</span>
          <span className="text-ink-400"> — </span>
          <em className="not-italic text-ink-100">{daily.work}</em>
        </p>
        <p className="mt-1 text-xs text-ink-500">{daily.style}</p>
      </section>

      <header className="text-center">
        <h2 className="font-display text-3xl font-semibold text-white">Ready for a critique?</h2>
        <p className="mt-2 text-sm text-ink-400 max-w-sm mx-auto">
          Capture your painting, choose style and medium, and get structured feedback on eight criteria—benchmarked
          against the masters.
        </p>
      </header>

      <button
        type="button"
        onClick={onNewCritique}
        className="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 p-6 text-left text-white shadow-xl shadow-indigo-950/50 transition hover:bg-indigo-500 active:scale-[0.99]"
      >
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/20">
              <Camera className="h-8 w-8" strokeWidth={2} />
            </div>
            <div>
              <div className="text-lg font-bold">New critique</div>
              <div className="text-sm text-indigo-100/90">Style, medium, camera</div>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 opacity-80 transition group-hover:translate-x-0.5" />
        </div>
      </button>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500">Work in progress</h3>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {wip.length === 0 ? (
            <div className="min-h-[11rem] min-w-[100%] rounded-2xl border border-dashed border-white/15 bg-ink-800/30 p-6 text-center text-sm text-ink-500">
              No saved paintings yet. Run a critique and tap “Save to studio.”
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
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-lg">
                    <div className="relative aspect-[3/4] bg-ink-950">
                      {last?.imageDataUrl ? (
                        <img
                          src={last.imageDataUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-indigo-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-white">{p.title}</p>
                      <p className="truncate text-[10px] text-ink-500">
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
