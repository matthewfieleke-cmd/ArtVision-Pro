import { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { advanceDailyMasterpieceIndex } from '../dailyMasterpieceCycle';
import { getCriterionLearnEntryBySlug } from '../data/criterionExcellence';

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
        Image preview unavailable. Open the Commons / museum link below for the work.
      </a>
    );
  }
  return (
    <a href={linkHref} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-100">
      <img
        src={src}
        alt={alt}
        className="max-h-[min(88vh,36rem)] w-full object-contain object-center"
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
      <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-lg pt-8">
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
    <div className="min-h-[100dvh] bg-slate-50 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-soft backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
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
            onClick={() => advanceDailyMasterpieceIndex()}
            className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-700"
          >
            Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg leading-relaxed text-violet-800/95">{entry.tagline}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{entry.intro}</p>

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

        <h2 className="mt-10 font-display text-xl text-slate-900">Two paintings that excel here</h2>
        <p className="mt-2 text-sm text-slate-500">
          Read for what to notice in your own work—not to copy these artists, but to calibrate your eye.
        </p>

        <div className="mt-8 space-y-14">
          {entry.examples.map((ex, idx) => (
            <section key={ex.workTitle} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Example {idx + 1}</p>
              <h3 className="mt-2 font-display text-xl text-slate-900">
                {ex.workTitle}
                <span className="font-normal text-slate-600"> · {ex.artist}</span>
              </h3>
              {ex.year ? <p className="mt-1 text-sm text-slate-500">{ex.year}</p> : null}
              {ex.medium ? <p className="text-sm text-slate-500">{ex.medium}</p> : null}
              {ex.collection ? <p className="text-sm text-slate-500">{ex.collection}</p> : null}

              <div className="mt-4">
                <ExampleImage src={ex.imageUrl} alt={ex.imageAlt} linkHref={ex.moreInfoUrl} />
              </div>

              <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Why it excels at {entry.criterion.toLowerCase()}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{ex.whyExcellence}</p>

              <p className="mt-3 text-xs text-slate-500">{ex.credit}</p>
              <a
                href={ex.moreInfoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
              >
                File / collection source <ExternalLink className="h-3 w-3" />
              </a>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
