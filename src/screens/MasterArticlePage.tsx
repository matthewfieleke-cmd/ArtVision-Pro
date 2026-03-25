import { useState } from 'react';
import { ArrowLeft, BookMarked, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { advanceDailyMasterpieceIndex } from '../dailyMasterpieceCycle';
import { getMasterBySlug } from '../data/masterCatalog';
import { setReturnTabIntent } from '../navIntent';

function MasterWorkImage({ src, alt, linkHref }: { src: string; alt: string; linkHref: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a
        href={linkHref}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600"
      >
        Image preview unavailable. Open the file or museum link below for the work.
      </a>
    );
  }
  return (
    <a
      href={linkHref}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:aspect-[16/9] lg:max-h-[min(34vh,280px)]"
    >
      <img
        src={src}
        alt={alt}
        className="max-h-[min(92vh,40rem)] w-full object-contain object-center lg:max-h-full lg:max-w-full lg:object-contain"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export function MasterArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const entry = slug ? getMasterBySlug(slug) : undefined;

  if (!entry) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-lg pt-8 lg:max-w-2xl">
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
    <div className="min-h-[100dvh] bg-slate-50 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:px-0 lg:pb-0">
      <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 shadow-soft backdrop-blur-md sm:px-6 lg:static lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto flex w-full max-w-none items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setReturnTabIntent('benchmarks');
              navigate('/');
            }}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Back to Masters"
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

      <article className="mx-auto w-full max-w-none flex-1 px-4 py-8 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-4 xl:px-12 2xl:px-16">
        <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-normal tracking-tight text-slate-900 lg:text-3xl xl:text-4xl">
              {entry.displayName}
            </h1>
            <p className="mt-1 text-lg text-violet-700/90 lg:mt-0.5 lg:text-base xl:text-lg">{entry.tagline}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 lg:mt-3 lg:p-3 lg:text-xs xl:text-sm">
          <p className="font-semibold text-amber-900">Scholarly use & images</p>
          <p className="mt-1 leading-relaxed lg:leading-snug">
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

        <div className="mt-6 space-y-8 lg:mt-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 xl:gap-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overview</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 lg:text-[13px] lg:leading-6 xl:text-sm xl:leading-relaxed">
              {entry.intro}
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Historical placement</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 lg:text-[13px] lg:leading-6 xl:text-sm xl:leading-relaxed">
              {entry.historicalPlacement}
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Why a “Master” in this style</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-700 lg:text-[13px] lg:leading-6 xl:text-sm">
              {entry.whyMaster.map((pt) => (
                <li key={pt.slice(0, 40)}>{pt}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-8 lg:mt-5">
          <h2 className="flex items-center gap-2 font-display text-xl text-slate-900 lg:text-lg">
            <BookMarked className="h-5 w-5 shrink-0 text-violet-600" />
            Works & technique
          </h2>
          <p className="mt-1 text-sm text-slate-500 lg:text-xs xl:text-sm">
            Each example ties observable features of the work to skills you can study in your own practice (value,
            edge, color, composition, surface).
          </p>

          <div className="mt-4 space-y-8 lg:space-y-5">
            {entry.figures.map((fig) => (
              <figure
                key={fig.workTitle}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:p-4"
              >
                <figcaption className="mb-3 lg:mb-2 lg:grid lg:grid-cols-[1fr_auto] lg:items-baseline lg:gap-4">
                  <span className="font-display text-lg text-slate-900 lg:text-base">
                    {fig.workTitle}
                    {fig.year ? <span className="text-slate-500"> · {fig.year}</span> : null}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500 lg:mt-0 lg:text-right lg:text-xs">
                    {[fig.medium, fig.collection].filter(Boolean).join(' · ')}
                  </span>
                </figcaption>

                <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:gap-8">
                  <div className="min-w-0">
                    {fig.imageUrl ? (
                      <MasterWorkImage src={fig.imageUrl} alt={fig.imageAlt} linkHref={fig.moreInfoUrl ?? fig.imageUrl} />
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 lg:flex lg:aspect-[16/9] lg:max-h-[min(34vh,280px)] lg:min-h-0 lg:flex-col lg:items-center lg:justify-center lg:p-4 lg:text-xs">
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
                  </div>
                  <div className="min-w-0 lg:max-h-[min(38vh,300px)] lg:overflow-y-auto lg:pr-1">
                    <p className="mt-4 text-sm leading-relaxed text-slate-700 lg:mt-0 lg:text-[13px] lg:leading-6 xl:text-sm">
                      {fig.analysis}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{fig.credit}</p>
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
                  </div>
                </div>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-slate-200 pt-6 lg:mt-5 lg:pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Further reading</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-1">
            {entry.readings.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 lg:text-xs xl:text-sm"
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
