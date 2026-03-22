import { ArrowLeft, BookMarked, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { advanceDailyMasterpieceIndex } from '../dailyMasterpieceCycle';
import { getMasterBySlug } from '../data/masterCatalog';

function goHomeFromArticle(navigate: ReturnType<typeof useNavigate>): void {
  advanceDailyMasterpieceIndex();
  navigate('/');
}

export function MasterArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const entry = slug ? getMasterBySlug(slug) : undefined;

  if (!entry) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-lg pt-8">
          <p className="text-slate-600">No article found for this link.</p>
          <Link
            to="/"
            onClick={() => advanceDailyMasterpieceIndex()}
            className="mt-4 inline-block font-semibold text-violet-600"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-soft backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : goHomeFromArticle(navigate))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-violet-600">{entry.style}</p>
            <p className="truncate font-display text-lg text-slate-900">{entry.displayName}</p>
          </div>
          <Link
            to="/"
            onClick={() => advanceDailyMasterpieceIndex()}
            className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-700"
          >
            Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-3xl font-normal tracking-tight text-slate-900">{entry.displayName}</h1>
        <p className="mt-2 text-lg text-violet-700/90">{entry.tagline}</p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">Scholarly use & images</p>
          <p className="mt-1 leading-relaxed">
            These pages synthesize widely accepted art-historical scholarship and close looking at specific works.
            Illustrations are drawn from{' '}
            <a className="font-medium underline" href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>{' '}
            and museum open-access programs where files are marked public domain or CC; works still under copyright
            (e.g. Rothko, Pollock) link to institutional pages instead of reproducing protected photographs. Always
            verify terms for your own publication or commercial use.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overview</h2>
          <p className="mt-2 text-slate-700 leading-relaxed">{entry.intro}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Historical placement</h2>
          <p className="mt-2 text-slate-700 leading-relaxed">{entry.historicalPlacement}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Why a “Master” in this style</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700 leading-relaxed">
            {entry.whyMaster.map((pt) => (
              <li key={pt.slice(0, 40)}>{pt}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-xl text-slate-900">
            <BookMarked className="h-5 w-5 text-violet-600" />
            Works & technique
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Each example ties observable features of the work to skills you can study in your own practice (value,
            edge, color, composition, surface).
          </p>

          <div className="mt-6 space-y-12">
            {entry.figures.map((fig) => (
              <figure key={fig.workTitle} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <figcaption className="mb-3">
                  <span className="font-display text-lg text-slate-900">{fig.workTitle}</span>
                  {fig.year ? (
                    <span className="text-slate-500"> · {fig.year}</span>
                  ) : null}
                  {fig.medium ? <p className="text-sm text-slate-500">{fig.medium}</p> : null}
                  {fig.collection ? <p className="text-sm text-slate-500">{fig.collection}</p> : null}
                </figcaption>

                {fig.imageUrl ? (
                  <a
                    href={fig.moreInfoUrl ?? fig.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl bg-slate-100"
                  >
                    <img
                      src={fig.imageUrl}
                      alt={fig.imageAlt}
                      className="max-h-[min(70vh,520px)] w-full object-contain"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                    <p>
                      In-copyright works: use the museum’s authorized viewer for high-resolution study images (rights
                      vary by country and use).
                    </p>
                    {fig.moreInfoUrl ? (
                      <a
                        href={fig.moreInfoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 font-semibold text-violet-600 hover:text-violet-700"
                      >
                        Open collection record <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                )}

                <p className="mt-4 text-sm leading-relaxed text-slate-700">{fig.analysis}</p>
                <p className="mt-3 text-xs text-slate-500">{fig.credit}</p>
                {fig.moreInfoUrl ? (
                  <a
                    href={fig.moreInfoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    File / collection source <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Further reading</h2>
          <ul className="mt-3 space-y-2">
            {entry.readings.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  {r.label} <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
