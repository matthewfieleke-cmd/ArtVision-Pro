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
      className="flex min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:aspect-[16/9] lg:max-h-[min(32vh,260px)]"
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
    <div className="min-h-[100dvh] bg-slate-50 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:px-0 lg:pb-0">
      <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 shadow-soft backdrop-blur-md sm:px-6 lg:static lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto flex w-full max-w-none items-center gap-3">
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

      <article className="mx-auto w-full max-w-none flex-1 px-4 py-8 sm:px-6 lg:grid lg:min-h-0 lg:grid-cols-12 lg:gap-8 lg:overflow-y-auto lg:px-8 lg:py-4 xl:gap-10 xl:px-12 2xl:px-16">
        <div className="lg:col-span-4 lg:flex lg:min-h-0 lg:flex-col lg:gap-3">
          <p className="text-lg leading-snug text-violet-800/95 lg:text-base xl:text-lg">{entry.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 lg:mt-0 lg:text-[13px] lg:leading-6 xl:text-sm">
            {entry.intro}
          </p>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 lg:mt-2 lg:p-3 lg:text-xs xl:text-sm">
            <p className="font-semibold text-amber-900">Images & rights</p>
            <p className="mt-1 leading-relaxed lg:leading-snug">
              Illustrations are from{' '}
              <a className="font-medium underline" href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
                Wikimedia Commons
              </a>{' '}
              and similar open programs where marked public domain or CC. Verify terms before commercial reuse.
            </p>
          </div>

          <h2 className="mt-8 font-display text-xl text-slate-900 lg:mt-3 lg:text-lg xl:text-xl">
            Two paintings that excel here
          </h2>
          <p className="mt-1 text-sm text-slate-500 lg:text-xs xl:text-sm">
            Read for what to notice in your own work—not to copy these artists, but to calibrate your eye.
          </p>
        </div>

        <div className="mt-8 space-y-10 lg:col-span-8 lg:mt-0 lg:grid lg:min-h-0 lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:gap-6">
          {entry.examples.map((ex, idx) => (
            <section
              key={ex.workTitle}
              className="flex min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:p-3 xl:p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Example {idx + 1}</p>
              <h3 className="mt-1 font-display text-lg text-slate-900 lg:text-base xl:text-lg">
                {ex.workTitle}
                <span className="font-normal text-slate-600"> · {ex.artist}</span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {[ex.year, ex.medium, ex.collection].filter(Boolean).join(' · ')}
              </p>

              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:mt-2">
                <ExampleImage src={ex.imageUrl} alt={ex.imageAlt} linkHref={ex.moreInfoUrl} />
                <div className="min-h-0 flex-1 lg:max-h-[min(28vh,220px)] lg:overflow-y-auto lg:pr-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Why it excels at {entry.criterion.toLowerCase()}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700 lg:text-[12px] lg:leading-5 xl:text-[13px] xl:leading-6">
                    {ex.whyExcellence}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500">{ex.credit}</p>
                  <a
                    href={ex.moreInfoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-700"
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
