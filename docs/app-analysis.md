# ArtVision Pro — Application Analysis

## Executive Summary

**ArtVision Pro** is a mobile-first Progressive Web App (PWA) for **painting critique**. Users photograph or upload a painting, select its style and medium, and receive an AI-powered critique across eight artistic criteria — complete with per-criterion scores, actionable feedback, studio-change recommendations, and optional AI-generated "preview edits" that visualize proposed improvements.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript (strict) | ~5.6 |
| Frontend framework | React | 18.3 |
| Build tool | Vite | 5.4 |
| Routing | React Router (HashRouter) | 6.30 |
| Styling | Tailwind CSS + PostCSS | 3.4 |
| PWA | vite-plugin-pwa | 0.21 |
| Icons | Lucide React | 0.468 |
| Image processing | Sharp (server-side) | 0.34 |
| Geometry | perspective-transform | 1.1 |
| Serverless runtime | Vercel (@vercel/node) | 3.2 |
| Local dev server | Node http + tsx | — |
| Package manager | npm | — |
| Analytics | @vercel/analytics | 2.0 |

**Codebase size:** ~86 source files, ~18,450 lines of TypeScript/TSX/MJS.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (PWA)                        │
│  ┌──────────────┐                 ┌──────────────────┐ │
│  │  React App   │                 │  localStorage    │ │
│  │  (src/)      │                 │  persistence     │ │
│  │  HashRouter  │                 │  (paintings)     │ │
│  └──────┬───────┘                 └──────────────────┘ │
│         │ fetch /api/*                                  │
└─────────┼───────────────────────────────────────────────┘
          │
    ┌─────┴──────────────────────────────────┐
    │         API Layer (lib/)               │
    │   apiHandlers.ts → route dispatcher    │
    │   ┌──────────────────────────────────┐ │
    │   │  openaiCritique.ts               │ │
    │   │  openaiClassifyStyle.ts          │ │
    │   │  openaiClassifyMedium.ts         │ │
    │   │  openaiPreviewEdit.ts            │ │
    │   └──────────────────────────────────┘ │
    │              │                         │
    │         OpenAI API                     │
    └────────────────────────────────────────┘
    Hosted as:
      • Vercel serverless (api/*.ts)   — production
      • Node http server (server/)     — local dev
```

This is a **single-product, client-heavy architecture** — not a monorepo or microservice system. One `package.json`, one build pipeline, one deployment artifact.

---

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | React SPA — UI components, screens, hooks, state management, API clients |
| `lib/` | Server-side logic — API handler dispatch, OpenAI integrations, critique pipeline (validation, audit, calibration, writing stages) |
| `api/` | Vercel serverless function entrypoints — thin wrappers delegating to `lib/apiHandlers.ts` |
| `server/` | Local dev HTTP server (`dev-api.ts`) — mirrors Vercel routes for development parity |
| `shared/` | Cross-cutting domain data — criteria order, rubrics, anchors, voice templates, artist catalogs |
| `scripts/` | Build automation (art image fetch, PWA icon generation) and QA tooling (critique review runners, architecture tests) |
| `docs/` | Engineering notes, critique workflow documentation, QA fixtures |

---

## Frontend Architecture

### Entry Point & Routing

- **`index.html`** → **`src/main.tsx`** bootstraps `React.StrictMode` with `HashRouter`.
- **Hash-based routing** enables deep links on GitHub Pages under arbitrary subpaths.
- Three routes:
  - `/` — Main app shell (`App.tsx`)
  - `/master/:slug` — Master artist article pages
  - `/learn/criterion/:criterionSlug` — Criterion learning pages

### App Shell (`App.tsx`)

`App.tsx` (~1,800 lines) is the central orchestrator managing:

- **Tab navigation** — `home`, `studio`, `benchmarks`, `profile` (via `useState`, not URL-driven)
- **Critique flow** — a typed state machine (`critiqueFlow.ts`) progressing through `setup` → `capture` → `analyzing` → `results`
- **Camera/upload** — live camera capture, file upload, image cropping (`ImageCropModal`)
- **Analysis lifecycle** — wake lock, abort controller, background retry on visibility change
- **Preview edits** — AI-generated image previews with blend/compare overlay
- **Persistence** — auto-save to `localStorage`

### Screens & Components

| Screen | Description |
|--------|-------------|
| `HomeTab` | Landing with daily masterpiece, quick-start actions |
| `StudioTab` | Saved paintings gallery, version history |
| `BenchmarksTab` | Performance benchmarks and comparisons |
| `ProfileTab` | User preferences and settings |
| `MasterArticlePage` | Educational article about a master artist |
| `CriterionLearnPage` | Deep-dive into a specific critique criterion |

Key components: `BottomNav`, `DesktopSidebar`, `CritiquePanels`, `ImageCropModal`, `PreviewEditBlendCard`, `PreviewCompareOverlay`.

### State Management

- **React `useState` / `useRef`** — no external state library (no Redux, Zustand, or React Query).
- **`sessionStorage`** (`navIntent.ts`) — preserves tab and critique flow state when navigating to hash routes and back.
- **`localStorage`** (`storage.ts`) — persists saved paintings under `artvision-pro-paintings-v1` with forward-compatible migrations.

### Analysis Path

The app sends the image to `/api/critique` → OpenAI vision model → structured critique response. All critique, classification, and preview-edit features require a reachable API.

---

## API Surface

All endpoints are POST-only JSON APIs, dispatched through `lib/apiHandlers.ts`:

| Endpoint | Purpose | Key Input |
|----------|---------|-----------|
| `/api/critique` | Full painting critique | `imageDataUrl`, `style`, `medium`, optional prior version |
| `/api/classify-style` | Detect painting style | `imageDataUrl` |
| `/api/classify-medium` | Detect painting medium | `imageDataUrl` |
| `/api/preview-edit` | AI-generated edit preview | Image + criterion + edit plan; deduplication via `requestId` |

**Server guard:** Returns 503 if `OPENAI_API_KEY` is not set. CORS headers are applied for cross-origin deployments.

---

## Data Model

The core domain types (from `src/types.ts`):

- **`SavedPainting`** — Top-level entity: `id`, `title`, `style`, `medium`, `versions[]`
- **`PaintingVersion`** — A critique snapshot: `imageDataUrl`, `createdAt`, `critique`, `previewEdits[]`
- **`CritiqueResult`** — Full critique: `categories[]`, `summary`, `overallSummary`, `simple` (studio feedback), `comparisonNote`, `photoQuality`, `completionRead`
- **`CritiqueCategory`** — Per-criterion breakdown: `criterion`, `level`, `feedback`, `actionPlan`, `actionPlanSteps`, `voiceBPlan`, `confidence`, `evidenceSignals`, `subskills`, `anchor`, `editPlan`
- **`SavedPreviewEdit`** — AI illustrative edit image paired with a criterion

**Styles:** Realism, Impressionism, Expressionism, Abstract Art  
**Mediums:** Oil on Canvas, Acrylic, Pastel, Drawing, Watercolor  
**Rating levels:** Defined in `shared/criteria.ts`

**No server-side database.** All persistence is `localStorage` in the browser.

---

## Critique Pipeline (Server)

The `lib/` directory implements a multi-stage critique pipeline:

1. **Classification** — Style and medium detection via OpenAI vision
2. **Calibration** — Score calibration against rubric anchors
3. **Evidence** — Observable signal extraction for each criterion
4. **Writing** — Prose generation for feedback, action plans, studio changes
5. **Validation** — Schema and content validation (`critiqueValidation.ts`)
6. **Audit** — Quality audit of generated critiques (`critiqueAudit.ts`)
7. **Evaluation** — Critique quality scoring (`critiqueEval.ts`)

Supporting infrastructure:
- `criterionExemplars.ts` — Example critiques per criterion
- `previewEditJobStore.ts` — In-memory deduplication of concurrent preview-edit requests (TTL-based)
- `previewImageResize.ts` — Image resizing for the preview pipeline via Sharp

---

## Deployment

### Vercel (Full Stack)

- `vercel.json` configures Vite framework, `dist` output, SPA rewrites for non-API paths.
- `/api/*` routes are served by Vercel serverless functions.
- Environment variables: `OPENAI_API_KEY`, optional model overrides.

### GitHub Pages (Static Only)

- `.github/workflows/deploy-pages.yml` — Node 20, `npm ci`, `VITE_BASE=/<repo>/` build, upload `dist`.
- API hosted separately; `VITE_CRITIQUE_API_URL` points to the Vercel deployment.

### Local Development

- `npm run dev` — Runs Vite + local API server concurrently.
- Vite proxies `/api/*` to `127.0.0.1:8787` (the local Node server).
- `npm run dev:ui` — UI only (no API server); for front-end work that doesn't need critique.

---

## Build Pipeline

```
npm run prebuild          # fetch art images + generate PWA icons
npm run build             # tsc -b → server typecheck → vite build
```

- **TypeScript** uses project references: `tsconfig.app.json` (browser), `tsconfig.server.json` (Node), `tsconfig.node.json` (build tooling).
- **Vite** bundles the SPA with React plugin, Tailwind, and PWA service worker.
- **`VITE_BASE`** controls the base path for GitHub Pages subpath deploys.

---

## Testing & Quality

- **No Vitest/Jest** — no traditional test runner configured.
- **Architecture tests** (`scripts/run-architecture-tests.ts`) — import-time validation of flow helpers, API handlers, critique validation using Node `assert`.
- **Preview resize tests** (`scripts/test-preview-resize.ts`) — unit-style assertions for image resize logic.
- **Critique QA review scripts** — multiple `critique:review:*` npm scripts that batch-run critiques against sample paintings and evaluate output quality.
- **ESLint** — configured for browser (`src/`) and Node (`server/`, `lib/`, `api/`, `shared/`) environments.

---

## Authentication & Security

- **No user authentication** — no login, sessions, or JWT.
- **Single-tenant model** — the server holds `OPENAI_API_KEY`; the browser only makes HTTP requests to the API.
- **CORS** headers are applied in `apiHandlers.ts` for cross-origin scenarios (Pages → Vercel API).

---

## Notable Design Patterns

1. **Dual runtime API parity** — Production Vercel handlers and local dev server share the same `handleApiRequest` / `resolveApiRoute` logic, ensuring identical behavior.

2. **Typed state machine** — `critiqueFlow.ts` models the wizard as discriminated unions by `step` and `mode` (`new` vs `resubmit`), eliminating impossible states.

3. **Preview-edit job deduplication** — `previewEditJobStore.ts` prevents duplicate OpenAI calls for the same logical request using a TTL-keyed map.

4. **Hash routing for static hosting** — `HashRouter` sidesteps server-side routing requirements on GitHub Pages.

5. **Progressive enhancement** — PWA with service worker, offline-capable for previously loaded content; wake lock during analysis; visibility-change retry.

6. **Forward-compatible persistence** — `storage.ts` includes migration paths for older save formats (e.g., `previewEdit` → `previewEdits[]`).

---

## Potential Areas for Improvement

| Area | Observation |
|------|-------------|
| **App.tsx complexity** | At ~1,800 lines, this file manages too many concerns (tabs, camera, analysis, preview, persistence). Extracting custom hooks or context providers would improve maintainability. |
| **No formal test framework** | Architecture and preview-resize tests use raw `assert`. Adopting Vitest (already Vite-native) would enable better coverage, watch mode, and CI integration. |
| **No external state management** | All state lives in `App.tsx` `useState` calls. As the app grows, a lightweight solution (Zustand, Jotai) or React Context + reducers would reduce prop drilling. |
| **localStorage-only persistence** | No server-side storage means paintings are lost if the user clears browser data. A sync layer or export feature would improve data durability. |
| **No rate limiting or abuse protection** | API endpoints have no rate limiting or request throttling beyond the `OPENAI_API_KEY` check. |
| **Single-file API handler** | `apiHandlers.ts` handles all routes in one dispatcher. As endpoints grow, splitting into per-route modules would improve organization. |
