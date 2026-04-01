# ArtVision Pro — Improvement Backlog

Tracked items for future work. These are not blocking but represent meaningful
opportunities discovered during codebase analysis.

---

## 1. App.tsx Complexity

`src/App.tsx` is ~1,800 lines managing tabs, camera, analysis flow, preview
edits, and persistence in a single component. Extract into custom hooks
(`useCritiqueFlow`, `usePreviewSession`, `usePaintingStorage`) or React
context providers to improve readability and testability.

## 2. Formal Test Framework

Architecture and preview-resize tests use raw Node `assert`. Adopting
**Vitest** (already Vite-native) would enable better coverage reporting,
watch mode, snapshot testing, and CI integration without adding a separate
build tool.

## 3. State Management

All UI state lives in `App.tsx` `useState` calls with prop drilling.
As the app grows, a lightweight solution (Zustand, Jotai, or React Context +
`useReducer`) would reduce coupling between components.

## 4. localStorage-Only Persistence

Paintings are lost if the user clears browser data or switches devices.
Options: JSON export/import, optional cloud sync, or IndexedDB for larger
storage budgets.

## 5. API Rate Limiting / Abuse Protection

Endpoints have no rate limiting or throttling beyond the `OPENAI_API_KEY`
server guard. Adding per-IP rate limits (e.g., via Vercel Edge middleware)
would reduce risk of runaway API costs.

## 6. Single-File API Handler

`lib/apiHandlers.ts` dispatches all routes in one function. Splitting into
per-route handler modules would improve readability as the API surface grows.
