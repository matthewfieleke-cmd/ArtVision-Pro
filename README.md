# ArtVision Pro

Mobile-first PWA for painting critique: style and medium selection, camera or upload capture, eight-criteria ratings (Beginner → Master) with actionable feedback, local save/version history, and before/after comparison notes.

## Run locally

```bash
npm install
```

**UI only** (heuristic critique in the browser):

```bash
npm run dev
```

**Full vision critique** (OpenAI): add `OPENAI_API_KEY` to `.env.local`, then run API + Vite together:

```bash
npm run dev:full
```

Vite proxies `/api/*` to `http://127.0.0.1:8787` so the app calls `/api/critique` without CORS issues.

## Deploy (Vercel)

1. Set environment variable `OPENAI_API_KEY` in the Vercel project.
2. Deploy this repo; the serverless route is `api/critique.ts`.
3. In Vite build, set `VITE_CRITIQUE_API_URL` to your deployment origin (e.g. `https://your-app.vercel.app`) so the PWA calls the same host’s `/api/critique`.

## Deploy (GitHub Pages) + Add to Home Screen

GitHub Pages only serves static files, but the **installed PWA** still gets full client functionality: camera (HTTPS), upload, local storage, offline shell via the service worker, and heuristic critique. For **OpenAI** critique from the installed app, host `api/critique` elsewhere and point the build at it.

1. **Enable Pages**: Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`; the workflow `.github/workflows/deploy-pages.yml` builds with `VITE_BASE=/<repo>/` so scripts, icons, and the service worker load under `https://<user>.github.io/<repo>/`.
3. **Install**: Open the site in **Safari** (iOS) or **Chrome** (Android), use **Share → Add to Home Screen** / **Install app**. The manifest uses `display: standalone` and a scoped `start_url` so the shortcut opens the full app.
4. **Vision API from Pages**: Add a repository secret **`VITE_CRITIQUE_API_URL`** (e.g. `https://your-vercel-api.vercel.app`, no trailing slash). The Action passes it into the build so fetches go to your API (CORS must allow your `github.io` origin). Without it, the app uses **local heuristic** critique only.

`public/.nojekyll` is included so GitHub does not skip files that start with `_`.

For a **user site** at `https://<user>.github.io/` (repo named `<user>.github.io`), set `VITE_BASE=/` in the workflow instead of `/<repo>/`.

## Build

```bash
npm run build
npm run preview
```

**Project Pages dry run** (replace `YourRepo`):

```bash
VITE_BASE=/YourRepo/ npm run build && npm run preview
```

If the API is unreachable, the app **falls back** to the in-browser heuristic analysis.
