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

## Build

```bash
npm run build
npm run preview
```

If the API is unreachable, the app **falls back** to the in-browser heuristic analysis.
