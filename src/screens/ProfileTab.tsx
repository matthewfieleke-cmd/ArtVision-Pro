import { useState } from 'react';
import { applyFontPreset, FONT_PRESETS, getStoredFontPresetId } from '../fontTheme';

export function ProfileTab() {
  const [activeId, setActiveId] = useState(() => getStoredFontPresetId());

  return (
    <div className="animate-fade-in space-y-6 px-4 pb-28 pt-4">
      <header>
        <h2 className="font-display text-2xl font-normal text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Preferences and growth charts can plug in here. This prototype keeps everything on-device in your browser.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Typography</h3>
        <p className="mt-1 text-sm text-slate-600">
          Tap a pairing to preview it across the app. Your choice is saved on this device.
        </p>
        <ul className="mt-4 space-y-2">
          {FONT_PRESETS.map((p) => {
            const on = activeId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    applyFontPreset(p.id);
                    setActiveId(p.id);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    on
                      ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20'
                      : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-semibold text-slate-900">{p.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{p.vibe}</span>
                  <span
                    className="mt-2 block font-display text-lg text-slate-800"
                    style={{ fontFamily: p.display }}
                  >
                    The quick brown fox
                  </span>
                  <span className="mt-1 block text-sm text-slate-600" style={{ fontFamily: p.sans }}>
                    Painting critique in eight criteria — composition, value, color.
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Privacy</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Photos and critiques are stored locally unless you add a backend. For production, use a small API to call a
          vision model and store encrypted thumbnails.
        </p>
      </section>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tip</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Re-shoot under consistent, diffuse light and fill the frame with your canvas for the fairest before/after
          comparisons.
        </p>
      </section>
    </div>
  );
}
