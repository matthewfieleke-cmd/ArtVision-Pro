import { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { advanceDailyMasterpieceIndex } from '../dailyMasterpieceCycle';
import { getCriterionLearnEntryBySlug } from '../data/criterionExcellence';
import { setReturnTabIntent, setReturnViewIntent } from '../navIntent';

function ExampleImage({ src, alt, linkHref }: { src: string; alt: string; linkHref: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a
        href={linkHref}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600"
      >
        Image preview unavailable. Open the source link below for the work.
      </a>
    );
  }
  return (
    <a
      href={linkHref}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:aspect-[16/9] lg:max-h-[min(50vh,32rem)]"
    >
      <img
        src={src}
        alt={alt}
        className="max-h-[min(88vh,36rem)] w-full object-contain object-center lg:max-h-full lg:max-w-full"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export function CriterionLearnPage() {
  const { criterionSlug } = useParams<{ criterionSlug: string }>();
  const navigate = useNavigate();
  const entry = getCriterionLearnEntryBySlug(criterionSlug);

  if (!entry) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-lg pt-8 lg:max-w-2xl">
          <p className="text-slate-600">No guide found for this criterion.</p>
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
    <div className="min-h-[100dvh] bg-slate-50 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-10">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white px-4 py-3 shadow-soft backdrop-blur-md sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-4xl items-center gap-3 xl:max-w-6xl 2xl:max-w-7xl">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
                return;
              }
              setReturnViewIntent({ kind: 'studio', selectedPaintingId: '' });
              navigate('/');
            }}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-violet-600">Criterion guide</p>
            <p className="truncate font-display text-lg text-slate-900">{entry.criterion}</p>
          </div>
          <Link
            to="/"
            onClick={() => setReturnTabIntent('benchmarks')}
            className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-700"
          >
            Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10 xl:max-w-6xl 2xl:max-w-7xl">
        <p className="text-lg leading-relaxed text-violet-800/95 lg:text-xl">{entry.tagline}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 lg:text-[15px] lg:leading-7">{entry.intro}</p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">Images & rights</p>
          <p className="mt-1 leading-relaxed">
            Illustrations are from{' '}
            <a className="font-medium underline" href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>{' '}
            and similar open programs where marked public domain or CC. Verify terms before commercial reuse.
          </p>
        </div>

        <h2 className="mt-10 font-display text-xl text-slate-900 lg:text-2xl">Two paintings that excel here</h2>
        <p className="mt-2 text-sm text-slate-500 lg:text-[15px]">
          Read for what to notice in your own work—not to copy these artists, but to calibrate your eye.
        </p>

        <div className="mt-8 space-y-14 lg:space-y-16">
          {entry.examples.map((ex, idx) => (
            <section key={ex.workTitle} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Example {idx + 1}</p>
              <h3 className="mt-2 font-display text-xl text-slate-900 lg:text-2xl">
                {ex.workTitle}
                <span className="font-normal text-slate-600"> · {ex.artist}</span>
              </h3>
              {ex.year ? <p className="mt-1 text-sm text-slate-500">{ex.year}</p> : null}
              {ex.medium ? <p className="text-sm text-slate-500">{ex.medium}</p> : null}
              {ex.collection ? <p className="text-sm text-slate-500">{ex.collection}</p> : null}

              <div className="mt-6 flex flex-col gap-6 lg:gap-8">
                <div className="min-w-0 lg:w-full">
                  <ExampleImage src={ex.imageUrl} alt={ex.imageAlt} linkHref={ex.moreInfoUrl} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Why it excels at {entry.criterion.toLowerCase()}
                  </h4>
                  <div className="mt-2 lg:columns-2 lg:gap-x-10 lg:[column-fill:balance]">
                    <p className="text-sm leading-relaxed text-slate-700 lg:text-[15px] lg:leading-7">{ex.whyExcellence}</p>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{ex.credit}</p>
                  <a
                    href={ex.moreInfoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    File / collection source <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
