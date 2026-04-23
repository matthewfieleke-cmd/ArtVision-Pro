## Engineering Improvement Roadmap

This roadmap prioritizes the next architectural moves for the critique system.

### 1. Make critique generation explicitly three-stage
**Status:** Done

The critique pipeline now runs as three stages with clean boundaries:

- Stage 1 — **vision** (`lib/openaiCritique.ts`, prompt in `lib/critiqueEvidenceStage.ts`): observation bank + per-criterion evidence + anchor regions in ONE OpenAI call, using a strict Zod-backed JSON schema.
- Stage 2 — **per-criterion writing** (`lib/critiqueParallelCriteria.ts`): eight concurrent Voice A + Voice B critiques, each anchored to stage-1 evidence. Per-call failures degrade to evidence-derived prose with zero retries.
- Stage 3 — **synthesis** (`lib/critiqueSynthesisStage.ts`): single call that rolls the eight criterion critiques into overall summary, top priorities, studio analysis, studio changes, and suggested titles.

The pre-gpt-5 validation / audit / calibration / clarity stages and their supporting regex libraries (`critiqueValidation.ts`, `critiqueGrounding.ts`, `critiqueWeakWorkContracts.ts`, `critiqueTextRules.ts`, `critiqueTestFixtures.ts`) have been retired — OpenAI Structured Outputs guarantees shape, and content quality is now owned by the composite-panel framing in `shared/critiqueVoiceA.ts` + the per-stage system messages.

### 2. Unify wire format and UI format for critiques
**Status:** In progress

Problem:
- critique data has evolved through DTOs, client types, compatibility mapping, and storage migration

Why this matters:
- fewer shape mismatches
- easier review tooling
- easier persistence and migration

Next step:
- define one normalized internal critique shape and explicitly map all server responses into it before UI/storage use

### 3. Turn evaluation into a first-class subsystem
**Status:** In progress

Current strengths:
- curated fixtures
- review scripts
- review markdown outputs

Why this matters:
- quality work should be repeatable
- prompt or architecture changes need measurable regression checks

Next step:
- add machine-readable review summaries
- add automatic flags for common failure patterns
- compare runs before and after architecture changes

### 4. Add stronger “good work / modest intervention” handling
**Status:** Needed

Problem:
- the critique system still tends to assume it must always find a meaningful correction

Why this matters:
- strong paintings may need preservation and small refinements, not forced criticism

Next step:
- create explicit strong-work mode in the writing and audit stages
- let the system say “no urgent structural correction” when appropriate

### 5. Modularize critique policy code
**Status:** Done

Critique policy is now split into small focused modules:

- `shared/critiqueVoiceA.ts` — audience framing, composite-critic / composite-teacher panels, Voice A + Voice B paragraph shapes, synthesis priorities shape.
- `lib/critiquePipelineGuidance.ts` — observation-bank / evidence-richness / pipeline-stage-connection guidance blocks consumed by the evidence prompt.
- `lib/critiqueEvidenceStage.ts` — the vision-stage prompt builders (observation bank + evidence + anchor regions).
- `lib/critiqueParallelCriteria.ts` — the per-criterion system + user prompts and the fan-out runner.
- `lib/critiqueSynthesisStage.ts` — the synthesis system + user prompt and the runner.
- `lib/critiqueZodSchemas.ts` — Zod schemas that drive OpenAI Structured Outputs and produce the TypeScript types downstream stages consume.

Historical note:
- separate:
  - schemas
  - evidence prompt
  - writing prompt
  - audit rules
  - validation helpers
  - review heuristics

### 6. Add stronger operational observability
**Status:** Needed

Problem:
- limited request-level visibility into where critique quality or failures break down

Why this matters:
- easier debugging
- easier cost/latency analysis
- better production reliability

Next step:
- add request IDs
- add structured logs for evidence stage, writing stage, and audit stage
- record validation/audit failures in a machine-readable way

### 7. Reduce duplication in API handling
**Status:** Needed

Problem:
- route-level patterns like CORS and response handling are repeated

Why this matters:
- easier maintenance
- fewer inconsistencies

Next step:
- extract shared API utilities for:
  - CORS
  - consistent JSON errors
  - request parsing
  - response helpers

### 8. Add regression tests around the critique engine
**Status:** Needed

Why this matters:
- the critique engine is now a product-critical subsystem

Next step:
- add tests for:
  - criterion migrations
  - evidence validation
  - critique validation
  - audit rewrites
  - fixture-review smoke cases

### Recommended implementation order
1. Strengthen the audit stage
2. Normalize internal critique shape
3. Add machine-readable eval summaries
4. Add strong-work / modest-intervention mode
5. Modularize critique engine
6. Add test coverage and observability
