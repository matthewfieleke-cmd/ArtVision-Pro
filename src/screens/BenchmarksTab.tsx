import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMasterSlug } from '../data/masterCatalog';
import type { Style } from '../types';
import { ARTISTS_BY_STYLE, STYLES } from '../types';

type Props = { isDesktop?: boolean };

export function BenchmarksTab({ isDesktop = false }: Props) {
  const [openSections, setOpenSections] = useState<Record<Style, boolean>>(() =>
    Object.fromEntries(STYLES.map((style) => [style, false])) as Record<Style, boolean>
  );

  return (
    <div
      className={`animate-fade-in space-y-6 ${
        isDesktop
          ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-1'
          : 'px-4 pb-28 pt-4 md:pb-8'
      }`}
    >
      <header className={isDesktop ? 'shrink-0' : ''}>
        <h2 className="font-display text-2xl font-normal text-slate-900">Gold standard artists</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          “Master” ratings are framed against the technical and expressive bar of these painters—including modern
          acrylic benchmarks (Photorealism, Hockney, Basquiat, Frankenthaler)—not for imitation, but for clear
          standards of composition, value, color, and voice. Tap a name for an overview and work-based technique notes.
        </p>
      </header>
      <div
        className={`space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 ${
          isDesktop ? 'min-h-0 flex-1 overflow-y-auto lg:grid-cols-3 xl:grid-cols-4' : ''
        }`}
      >
        {STYLES.map((s: Style) => (
          <section key={s} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            {isDesktop ? (
              <>
                <h3 className="font-display text-lg font-medium text-violet-700">{s}</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  {ARTISTS_BY_STYLE[s].map((name) => (
                    <li key={`${s}-${name}`}>
                      <Link
                        to={`/master/${getMasterSlug(s, name)}`}
                        className="flex items-center gap-2 rounded-lg py-1.5 pl-0 pr-2 font-medium text-violet-700 transition hover:bg-violet-50 hover:text-violet-900"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                        {name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOpenSections((cur) => ({ ...cur, [s]: !cur[s] }))}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={openSections[s]}
                  aria-controls={`masters-group-${s}`}
                >
                  <h3 className="font-display text-lg font-medium text-violet-700">{s}</h3>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-violet-500 transition-transform ${
                      openSections[s] ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {openSections[s] ? (
                  <ul id={`masters-group-${s}`} className="mt-3 space-y-1 text-sm">
                    {ARTISTS_BY_STYLE[s].map((name) => (
                      <li key={`${s}-${name}`}>
                        <Link
                          to={`/master/${getMasterSlug(s, name)}`}
                          className="flex items-center gap-2 rounded-lg py-1.5 pl-0 pr-2 font-medium text-violet-700 transition hover:bg-violet-50 hover:text-violet-900"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                          {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
