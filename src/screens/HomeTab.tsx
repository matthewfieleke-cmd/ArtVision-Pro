import { useEffect, useState } from 'react';
import { Camera, ChevronRight, ExternalLink, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMasterSlug } from '../data/masterCatalog';
import { DAILY_MASTERPIECES } from '../data/dailyMasterpieces';
import { getDailyMasterpieceIndex } from '../dailyMasterpieceCycle';
import type { SavedPainting } from '../types';
import { formatShortDate, progressPercentFromPainting } from '../utils';

type Props = {
  paintings: SavedPainting[];
  onNewCritique: () => void;
  onOpenPainting: (id: string) => void;
  isDesktop?: boolean;
};

export function HomeTab({ paintings, onNewCritique, onOpenPainting, isDesktop = false }: Props) {
  const daily = DAILY_MASTERPIECES[getDailyMasterpieceIndex()];
  const masterSlug = getMasterSlug(daily.style, daily.artist);
  const [masterpieceImgFailed, setMasterpieceImgFailed] = useState(false);
  useEffect(() => {
    setMasterpieceImgFailed(false);
  }, [daily.imageUrl, daily.artist, daily.work]);
  const wip = [...paintings].sort(
    (a, b) =>
      new Date(b.versions[b.versions.length - 1]?.createdAt ?? 0).getTime() -
      new Date(a.versions[a.versions.length - 1]?.createdAt ?? 0).getTime()
  );

  const masterpieceImageClass = isDesktop
    ? 'max-h-[min(34vh,16rem)] w-full object-contain object-center bg-slate-100 lg:max-h-[min(38vh,18rem)]'
    : 'max-h-[min(85vh,36rem)] w-full object-contain object-center bg-slate-100';

  const masterpieceSection = (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-card">
      <p className="shrink-0 px-4 pt-4 text-xs font-semibold uppercase tracking-widest text-violet-600/90 lg:px-5 lg:pt-5">
        Daily masterpiece
      </p>
      <div className="flex min-h-0 flex-col px-4 pb-4 pt-2 lg:px-5 lg:pb-5">
        <p className="font-display text-lg text-slate-900 lg:text-xl">
          <span className="text-violet-700">{daily.artist}</span>
          <span className="text-slate-300"> — </span>
          <em className="not-italic text-slate-800">{daily.work}</em>
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">{daily.style}</p>

        {daily.imageUrl && !masterpieceImgFailed ? (
          <a
            href={daily.paintingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
          >
            <img
              src={daily.imageUrl}
              alt={daily.imageAlt}
              className={masterpieceImageClass}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setMasterpieceImgFailed(true)}
            />
          </a>
        ) : daily.imageUrl && masterpieceImgFailed ? (
          <a
            href={daily.paintingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-[6rem] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-center text-sm text-slate-500 shadow-sm"
          >
            Preview unavailable — open the museum link below to view the work.
          </a>
        ) : null}

        <p className={`mt-3 text-sm leading-relaxed text-slate-600 ${isDesktop ? 'line-clamp-4 lg:line-clamp-5' : ''}`}>
          {daily.blurb}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={daily.paintingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
          >
            {daily.paintingLinkLabel}
            <ExternalLink className="h-3.5 w-3.5 opacity-90" />
          </a>
          <Link
            to={`/master/${masterSlug}`}
            className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            Master profile: {daily.artist}
          </Link>
        </div>
        {daily.imageCredit ? (
          <p className="mt-2 text-[10px] text-slate-400">{daily.imageCredit}</p>
        ) : null}
      </div>
    </section>
  );

  const ctaBlock = (
    <>
      <header className={isDesktop ? 'text-left' : 'text-center'}>
        <h2 className="font-display text-2xl font-normal tracking-tight text-slate-900 lg:text-3xl">
          Ready for a critique?
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 lg:max-w-none">
          {isDesktop
            ? 'Upload your painting, choose style and medium, and get structured feedback on eight criteria—benchmarked against the masters.'
            : 'Capture your painting, choose style and medium, and get structured feedback on eight criteria—benchmarked against the masters.'}
        </p>
      </header>

      <button
        type="button"
        onClick={onNewCritique}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 p-5 text-left text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-500 hover:to-violet-500 active:scale-[0.99] lg:p-6"
      >
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/20 p-3 ring-1 ring-white/30">
              {isDesktop ? (
                <Upload className="h-8 w-8" strokeWidth={2} />
              ) : (
                <Camera className="h-8 w-8" strokeWidth={2} />
              )}
            </div>
            <div>
              <div className="text-lg font-bold">New critique</div>
              <div className="text-sm text-violet-100/95">
                {isDesktop ? 'Style, medium, upload' : 'Style, medium, capture'}
              </div>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 opacity-90 transition group-hover:translate-x-0.5" />
        </div>
      </button>
    </>
  );

  const wipSection = (
    <section className="flex min-h-0 flex-col">
      <h3 className="shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400">Work in progress</h3>
      <div
        className={`mt-3 gap-3 pb-2 ${
          isDesktop
            ? 'grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            : 'flex overflow-x-auto'
        }`}
      >
        {wip.length === 0 ? (
          <div
            className={`min-h-[9rem] rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm ${
              isDesktop ? 'col-span-full' : 'min-w-[100%]'
            }`}
          >
            No paintings saved yet. Run a critique—it saves to Studio automatically.
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
                className={`text-left ${isDesktop ? 'w-full' : 'w-36 shrink-0'}`}
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
                  <div className="relative aspect-[3/4] bg-slate-100">
                    {last?.imageDataUrl ? (
                      <img src={last.imageDataUrl} alt="" className="h-full w-full object-cover" />
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
                  <div className="p-2">
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
  );

  if (isDesktop) {
    return (
      <div className="animate-fade-in flex min-h-0 flex-1 flex-col gap-0">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch lg:gap-6">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{masterpieceSection}</div>
          <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
            <div className="shrink-0 space-y-4">{ctaBlock}</div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{wipSection}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 px-4 pb-28 pt-4 md:pb-8">
      {masterpieceSection}
      {ctaBlock}
      {wipSection}
    </div>
  );
}
