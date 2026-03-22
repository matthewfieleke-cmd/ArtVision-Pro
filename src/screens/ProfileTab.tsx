export function ProfileTab() {
  return (
    <div className="animate-fade-in space-y-6 px-4 pb-28 pt-4">
      <header>
        <h2 className="font-display text-2xl font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-ink-400">
          Preferences and growth charts can plug in here. This prototype keeps everything on-device in your browser.
        </p>
      </header>
      <section className="rounded-2xl border border-white/10 bg-ink-800/50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Privacy</h3>
        <p className="mt-2 text-sm text-ink-300 leading-relaxed">
          Photos and critiques are stored locally unless you add a backend. For production, use a small API to call a
          vision model and store encrypted thumbnails.
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 bg-ink-800/50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Tip</h3>
        <p className="mt-2 text-sm text-ink-300 leading-relaxed">
          Re-shoot under consistent, diffuse light and fill the frame with your canvas for the fairest before/after
          comparisons.
        </p>
      </section>
    </div>
  );
}
