import type { Style } from '../types';
import { ARTISTS_BY_STYLE, STYLES } from '../types';

export function BenchmarksTab() {
  return (
    <div className="animate-fade-in space-y-6 px-4 pb-28 pt-4">
      <header>
        <h2 className="font-display text-2xl font-normal text-slate-900">Gold standard artists</h2>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          “Master” ratings in ArtVision Pro are framed against the technical and expressive bar of these painters—not
          for imitation, but for clear standards of composition, value, color, and voice.
        </p>
      </header>
      <div className="space-y-3">
        {STYLES.map((s: Style) => (
          <section
            key={s}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <h3 className="font-display text-lg font-medium text-violet-700">{s}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {ARTISTS_BY_STYLE[s].map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                  {name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
