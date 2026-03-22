# ArtVision Pro

Mobile-first PWA for painting critique: style and medium selection, camera or upload capture, eight-criteria ratings (Beginner → Master) with actionable feedback, local save/version history, and before/after comparison notes.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Critique analysis in this prototype runs in the browser from image statistics (value, edges, color spread, texture proxy). For production, add a small backend and a vision LLM; keep API keys server-side.
