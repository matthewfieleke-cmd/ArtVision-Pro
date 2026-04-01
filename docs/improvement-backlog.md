# ArtVision Pro — Improvement Backlog

Tracked items for future work, ordered by reliability impact.

---

## Priority 1 — Schema / Type Unification

**Status: DONE** (lib/critiqueZodSchemas.ts)

The same critique data shape is defined independently in four places:

1. OpenAI JSON schema objects (`lib/critiqueSchemas.ts`)
2. Stage result types (`VoiceBStageResult` in `lib/critiqueWritingStage.ts`)
3. Server DTOs (`VoiceBPlanDTO` in `lib/critiqueTypes.ts`)
4. Client types (`VoiceBPlan` in `src/types.ts`)

A single field rename requires coordinated edits across all four with no
compile-time enforcement that the JSON schema objects match the TypeScript
types. The `intendedRead` / `expectedRead` mismatch that broke Voice B was
a direct consequence.

**Fix:** Introduce a single-source-of-truth schema library (Zod) that
derives JSON schemas and TypeScript types from one definition.

## Priority 2 — Schema Round-Trip Tests

**Status: DONE** (testZodSchemaRoundTrip in run-architecture-tests.ts)

Round-trip tests verify that mock Voice B responses conforming to the Zod
schema also pass through `validateCritiqueResult`. Negative tests confirm
that field-name mismatches (e.g. `intendedRead` instead of `expectedRead`)
are caught.

## Priority 3 — AI Pipeline Error Handling

- `runSchemaStage` had no truncation detection (now fixed, but only for
  writing stages; the evidence stage still uses a separate fetch call
  without this check).
- No retry on transient failures (rate limits, network timeouts).
- The one-shot retry in `openaiCritique.ts` re-runs the entire
  evidence + calibration + writing pipeline — expensive and blunt.

**Fix:** Extract a shared `callOpenAI` helper with truncation detection,
exponential backoff on 429/5xx, and per-stage retry rather than full
pipeline restart.

## Priority 4 — Prompt / Schema Description Drift

Schema `description` fields duplicate guidance that also lives in the
system prompt, creating two sources of truth that can silently diverge.
The step-count conflict (schema said `≥3`, prompt said `1–3`) was one
instance; there may be others.

**Fix:** Keep schema descriptions minimal and factual (field semantics
only). Move all behavioral guidance — tone, step counts, anti-patterns —
exclusively into the system prompt.

## Priority 5 — App.tsx Complexity

`src/App.tsx` is ~1,800 lines managing tabs, camera, analysis flow,
preview edits, and persistence in one component. Extract into custom hooks
(`useCritiqueFlow`, `usePreviewSession`, `usePaintingStorage`) or React
context providers to improve readability and testability.

## Priority 6 — Formal Test Framework (Vitest)

Architecture and preview-resize tests use raw Node `assert`. Adopting
**Vitest** (already Vite-native) would enable better coverage reporting,
watch mode, snapshot testing, and CI integration without adding a separate
build tool. Motivated primarily by Priority 2 (schema round-trip tests).

---

## Lower Priority (Quality of Life)

These are valid but not causing production failures.

### State Management

All UI state lives in `App.tsx` `useState` calls with prop drilling. A
lightweight solution (Zustand, Jotai, or React Context + `useReducer`)
would reduce coupling as the app grows.

### localStorage-Only Persistence

Paintings are lost if the user clears browser data. Options: JSON
export/import, optional cloud sync, or IndexedDB for larger storage.

### API Rate Limiting

Endpoints have no rate limiting beyond the `OPENAI_API_KEY` server guard.
Per-IP rate limits via Vercel Edge middleware would reduce runaway cost risk.

### Single-File API Handler

`lib/apiHandlers.ts` dispatches all routes in one function. Splitting into
per-route modules would improve readability as the API surface grows.
