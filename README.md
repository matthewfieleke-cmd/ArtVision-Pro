# ArtVision Pro

Mobile-first PWA for painting critique: style and medium selection, camera or upload capture, eight-criteria ratings (Beginner → Master) with actionable feedback, local save/version history, and before/after comparison notes. **Masters** links open in-app articles; each criterion has a **Learn more** link to two exemplar paintings and teaching copy (`#/learn/criterion/...`, HashRouter so deep links work on GitHub Pages under a subpath).

## Run locally

```bash
npm install
```

**Default (full vision)** — starts the local API and Vite together. Add `OPENAI_API_KEY` to `.env.local`:

```bash
npm run dev
```

Same as `npm run dev:full`. Vite proxies `/api/*` to `http://127.0.0.1:8787` so the app calls `/api/critique`, `/api/classify-style`, and `/api/preview-edit` without CORS issues.

**UI only** (no API process — for front-end work that doesn't need critique):

```bash
npm run dev:ui
```

**Masters / Daily / Learn images:** `npm run build` runs `scripts/fetch-art-images.mjs`, which downloads PD-art JPEGs into `public/art/` (skipped if already present). The app serves them from your own origin so mobile browsers are not blocked by Wikimedia hotlink limits. To refresh after a clean clone, run `node scripts/fetch-art-images.mjs` once (needs network).

## Deploy (Vercel) — full vision + style API

The OpenAI calls run **only** on the server (`api/critique.ts`, `api/classify-style.ts`, `api/preview-edit.ts`). The browser never sees your key.

**Phase 1 preview:** After a critique, **Generate preview** calls OpenAI **image edit** (`gpt-image-1` by default) on the analyzed photo for the **lowest-rated** criterion. The server uses **sharp** to read the upload’s pixel size, pick the closest allowed API canvas (`1024×1024`, `1536×1024`, or `1024×1536`), then **resizes the model output back to the same width × height** as your upload so the compare slider aligns exactly. Optional env: `OPENAI_IMAGE_EDIT_MODEL`, `OPENAI_IMAGE_EDIT_QUALITY` (defaults to **high** for sharper previews; set `medium` or `low` to reduce cost).

1. **Create a Vercel project** from this GitHub repo (Import → select repo → Deploy).  
   `vercel.json` sets the Vite build output and SPA fallback so `/api/*` stays on the serverless routes.

2. **Add the secret in Vercel**  
   Project → **Settings → Environment Variables**:
   - `OPENAI_API_KEY` = your OpenAI API key (enable for **Production** and **Preview**).  
   - Optional: `OPENAI_MODEL` (default `gpt-4o` for chat/classify). For critique only, you can set `OPENAI_CRITIQUE_MODEL` instead (falls back to `OPENAI_MODEL`).

3. **Redeploy** after saving env vars (Deployments → ⋮ → Redeploy), or push a new commit.

4. **Same host (recommended)**  
   If the PWA is served from the same Vercel deployment (e.g. `https://your-app.vercel.app`), **do not** set `VITE_CRITIQUE_API_URL`. The app will call `https://your-app.vercel.app/api/critique` and `/api/classify-style` on the same origin.

5. **GitHub Pages + Vercel API**  
   If the UI is on `https://user.github.io/Repo/`, set repository secret **`VITE_CRITIQUE_API_URL`** to your Vercel origin **without a trailing slash** (e.g. `https://your-app.vercel.app`). Re-run the Pages workflow so the build bakes in that URL. CORS on the API reflects the browser `Origin`, so `*.github.io` is allowed.

**Verify the API**

```bash
curl -sS -X POST "https://YOUR_DEPLOYMENT.vercel.app/api/classify-style" \
  -H "Content-Type: application/json" \
  -d '{"imageDataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}'
```

You should get JSON with `style` and `rationale`, not `503` / `Server missing OPENAI_API_KEY`.

## Deploy (GitHub Pages) + Add to Home Screen

GitHub Pages only serves static files, but the **installed PWA** still gets full client functionality: camera (HTTPS), upload, local storage, and offline shell via the service worker. For **OpenAI** critique from the installed app, host `api/critique` elsewhere and point the build at it.

1. **Enable Pages**: Repository **Settings → Pages → Build and deployment → Source → GitHub Actions** (not “Deploy from a branch”). If you leave the source on a branch with no `index.html` at that path, the site will be **empty or 404**.
2. Push to `main` or `master`; open **Actions** and confirm **Deploy to GitHub Pages** completes. If the **deploy** job shows “Waiting” for an environment, open the run → **Review deployments** → approve **github-pages** (first time only for some repos).
3. **Open the project URL** (include the repo name in the path):  
   `https://<github-username-or-org>.github.io/<repository-name>/`  
   Example: repo `ArtVision-Pro` → `https://YOUR_USER.github.io/ArtVision-Pro/`  
   The root `https://YOUR_USER.github.io/` is a **different site** and will not show this app unless this is a user/org Pages repo named `<user>.github.io`.
4. **Install**: Open that URL in **Safari** (iOS) or **Chrome** (Android), use **Share → Add to Home Screen** / **Install app**. The manifest uses `display: standalone` and a scoped `start_url` so the shortcut opens the full app.
5. **Vision API from Pages**: Add a repository secret **`VITE_CRITIQUE_API_URL`** (e.g. `https://your-vercel-api.vercel.app`, no trailing slash). The Action passes it into the build so fetches go to your API (CORS must allow your `github.io` origin). Without it, critique is unavailable on the Pages deploy.

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

The app requires a reachable API for critique, style classification, and preview edits.
