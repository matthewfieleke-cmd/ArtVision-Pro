# ArtVision Pro

Mobile-first PWA for painting critique: pick **style** and **medium** (with optional auto style classification), then **camera** or **upload**. The model returns feedback across **eight criteria**. **Criterion cards are rating-free** (no Beginner→Master bands or scores)—each expands into **critic’s analysis**, **teacher’s next steps**, optional **preserve** notes, optional **confidence**, and—when the pipeline supplies them—an approximate **stage-lighting region** on your photo plus a **Learn more** link to exemplar paintings and teaching copy (`#/learn/criterion/...`; HashRouter keeps deep links working on GitHub Pages under a subpath). Very old saved critiques may still carry legacy `level` metadata that surfaces only in secondary copy (e.g. some AI preview captions).

**Overall summary** rolls up narrative synthesis, **finished vs in progress** when the API attaches it, and **vs. previous** notes when you resubmit from **Studio**. **Suggested titles** offers three tap-to-use options. **Studio** stores saved works **locally** with version history. **Masters** (gold-standard artists) and **Glossary** (studio terms) are separate tabs; **Profile** holds typography presets and the on-host **privacy policy** link.

**Optional monetization (Stripe):** When `STRIPE_SECRET_KEY`, `STRIPE_CHECKOUT_JWT_SECRET` (32+ random characters), and `STRIPE_CHECKOUT_ORIGIN` are set on the server, each **critique** costs **$1.49** and each **AI preview image** costs **$0.99** (USD), enforced before OpenAI runs. Style/medium auto-detect stays free. Omit those env vars for a fully free API.

**Privacy policy (store listings):** After deploy, use **`https://<your-host>/privacy.html`** (Vercel also serves **`/privacy`**). Edit the contact block in `public/privacy.html` before submitting to an app store.

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

**AI preview (image edit):** After a critique, you can run **Generate AI edit** on **each criterion** that has an anchor (and switch between multiple previews in one session). The default preview target follows the **first suggested studio change** from synthesis (each change names its `previewCriterion`); if that list is missing—e.g. some older saved JSON—the client falls back to the **first criterion** in the response. The server calls OpenAI **image edit** (`gpt-image-2` by default), uses **sharp** to read the upload’s pixel size, pick the closest allowed API canvas (`1024×1024`, `1536×1024`, or `1024×1536`), then **resizes the model output back to the same width × height** as your upload so the compare slider aligns exactly. Optional env: `OPENAI_IMAGE_EDIT_MODEL` (override to `gpt-image-1.5` if you want the older model), `OPENAI_IMAGE_EDIT_QUALITY` (defaults to **medium**, the fastest tier whose output still reads clean after the sharp-rescale to the upload's native dimensions; set `high` for slower/higher-fidelity previews or `low` for the fastest), `OPENAI_IMAGE_EDIT_CANDIDATES` (defaults to **1** so previews return quickly; set `2`–`4` to generate multiple candidates in parallel and return the one that best matches the upload—gpt-image-2 only accepts `n: 1` per request, so multi-candidate mode fans out across parallel requests). `input_fidelity=high` is only sent for `gpt-image-1.*` models; gpt-image-2 applies high-fidelity reference handling automatically and rejects that parameter.

1. **Create a Vercel project** from this GitHub repo (Import → select repo → Deploy).  
   `vercel.json` sets the Vite build output and SPA fallback so `/api/*` stays on the serverless routes.

2. **Add the secret in Vercel**  
   Project → **Settings → Environment Variables**:
   - `OPENAI_API_KEY` = your OpenAI API key (enable for **Production** and **Preview**).  
   - Optional: `OPENAI_MODEL` (default `gpt-5.4` for shared chat/classify fallback).
   - Optional: `OPENAI_CRITIQUE_MODEL` for critique-stage fallback.
   - Optional stage-specific critique overrides: `OPENAI_MODEL_CLASSIFY`, `OPENAI_MODEL_EVIDENCE`, `OPENAI_MODEL_CALIBRATION`, `OPENAI_MODEL_WRITE`, `OPENAI_MODEL_VALIDATE`, `OPENAI_MODEL_FALLBACK`, `OPENAI_MODEL_CLARITY` (optional prose-polish pass; defaults to `gpt-5.4` via `OPENAI_MODEL` when unset).
   - Optional: `OPENAI_REASONING_EFFORT` (`low` | `medium` | `high`) — global override for the `reasoning_effort` sent to gpt-5 family / o-series reasoning models. Each stage picks a sensible default (low for classify, medium for per-criterion writing, high for the vision and synthesis passes); this env var forces one effort for every stage. Ignored for non-reasoning chat models like gpt-4o or `gpt-5-chat-latest`, which use `temperature` instead.
   - Optional **clarity pass** (rewrites user-visible strings for fluent, plain language after guardrails; preserves anchors and teaching-plan intent; skipped if validation fails): set `OPENAI_CLARITY_PASS=true` (adds one chat completion per critique).
   - Optional: set `OPENAI_SKIP_ANCHOR_REGION_REFINE=true` to skip the extra vision pass that realigns stage-lighting boxes to the photograph (uses the validation-stage model; adds one chat completion with the image per critique).

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

**Critique quality (maintainers):** See `docs/CRITIQUE_PIPELINE_PHILOSOPHY.md` for the helpfulness bar and how stages connect. To print **advisory** repetition/length signals from a saved critique JSON: `npm run critique:signals -- path/to/critique.json`.
