export function ProfileTab() {
  return (
    <div className="animate-fade-in space-y-6 px-4 pb-28 pt-4">
      <header>
        <h2 className="font-display text-2xl font-normal text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Preferences and growth charts can plug in here. This prototype keeps everything on-device in your browser.
        </p>
      </header>
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
