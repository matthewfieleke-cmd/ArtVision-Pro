# ArtVision Pro — Improvement Backlog

Tracked items for future work, ordered by reliability impact.

---

## Priority 1 — Schema / Type Unification

**Status: DONE** (lib/critiqueZodSchemas.ts)

The same critique data shape was defined independently in several places. OpenAI JSON schemas for API calls now come from Zod in `lib/critiqueZodSchemas.ts`. `lib/critiqueSchemas.ts` only holds user-message field lists (`buildVoiceA/BSchemaInstruction`). Remaining duplication to watch:

1. Stage result types (`VoiceBStageResult` in `lib/critiqueWritingStage.ts`) vs Zod-inferred types
2. Server DTOs (`VoiceBPlanDTO` in `lib/critiqueTypes.ts`)
3. Client types (`VoiceBPlan` in `src/types.ts`)

A single field rename requires coordinated edits across all four with no
compile-time enforcement that the JSON schema objects match the TypeScript
types. The `intendedRead` / `expectedRead` mismatch that broke Voice B was
a direct consequence.

**Fix:** Introduce a single-source-of-truth schema library (Zod) that
derives JSON schemas and TypeScript types from one definition.

## Priority 2 — Schema Round-Trip Tests

**Status: DONE** (testZodSchemaRoundTrip in run-architecture-tests.ts)

Round-trip tests verify that Voice B plan / step / anchor / editPlan mocks
parse back through the Zod schemas. Negative tests confirm that field-name
mismatches (e.g. `intendedRead` instead of `expectedRead`) are caught. The
earlier `validateCritiqueResult` part of this test was retired along with
the pre-gpt-5 validation stack; the Zod round-trip checks remain because
OpenAI Structured Outputs guarantees shape only if our Zod schemas stay in
sync with the TypeScript types.

## Priority 3 — AI Pipeline Error Handling

The pipeline now runs as three stages (vision → parallel per-criterion
critique → synthesis) with zero custom retry logic; per-criterion failures
degrade to evidence-derived fallback prose in `runParallelCriteriaStage`,
and a synthesis failure falls through to `composeFallbackCritique`. What's
still missing:

- No shared exponential backoff on 429 / 5xx (each call uses raw `fetch`).
- Truncation detection only exists in the vision stage; per-criterion and
  synthesis calls trust `finish_reason` implicitly.
- No request-level idempotency, so a user retrying during a flaky network
  can produce two critiques.

**Fix:** Extract a shared `callOpenAI` helper with truncation detection
and exponential backoff on 429/5xx. Per-stage retry is cheap now that the
pipeline is fanned out.

## Priority 4 — Prompt / Schema Description Drift

**Status: PARTIALLY DONE.** The retired `critiqueValidation.ts` +
`critiqueTextRules.ts` stack used to keep two copies of the same behavior
rules — one in Zod schema `.describe()` blocks, one in the system prompt.
That is now gone; behavior lives in `shared/critiqueVoiceA.ts` + the
per-stage system messages, and Zod descriptions stay minimal and factual.
Remaining risk: the `critiqueZodSchemas.ts` field descriptions still
occasionally carry "do not write X" language. Future cleanup can move any
remaining behavior text out of the schemas and into the system prompts.

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
