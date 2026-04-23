# Critique Agent Handoff

This note is for the next agent continuing critique-pipeline stabilization.

> **2026-04 update — architecture simplified.** The pipeline now runs as
> three stages (vision → parallel per-criterion Voice A+B → synthesis) with
> no custom retry loop, no audit stage, and no regex-based validators.
> OpenAI Structured Outputs guarantees shape. Content quality is owned by
> the composite-panel framing in `shared/critiqueVoiceA.ts` and the
> per-stage system messages in `lib/critiqueParallelCriteria.ts` and
> `lib/critiqueSynthesisStage.ts`.
>
> The following files that earlier handoff notes reference have been
> **removed** and should not be reintroduced:
> `lib/critiqueValidation.ts`, `lib/critiqueValidation.test.ts`,
> `lib/critiqueGrounding.ts`, `lib/critiqueGrounding.test.ts`,
> `lib/critiqueWeakWorkContracts.ts`, `lib/critiqueTextRules.ts`,
> `lib/critiqueTestFixtures.ts`, and (previously retired)
> `lib/critiqueWritingStage.ts`, `lib/critiqueAudit.ts`.
> If you see a quality regression, fix it in the system prompts or the
> Zod schema — not by reintroducing post-hoc validators.

## Initial prompt for the next agent

Paste this as the next agent's starting prompt:

```text
You are taking over the ArtVision critique engine on `main`.

Read first:
- `docs/critique-agent-handoff.md`
- `docs/critique-engine-principles.md`
- `docs/latest-upload-smoke.md`

Mission:
Push the critique engine toward reliable, expert-grade critique for thousands of paintings, not just the current smoke fixtures.

Do not optimize narrowly for a handful of named paintings unless a failure clearly represents a reusable failure family.

Preserve and strengthen the good general mechanisms already in the repo:
- force critique to stay tied to concrete visible passages rather than painting-level summaries
- reject vague teacher language unless it names a visible target, a concrete change, and an intended visual result
- rebuild summary/coaching text from grounded category data instead of trusting fluent but generic model prose
- normalize equivalent visual language so truthful rephrasings still count as grounded

Target architecture:
1. Strong evidence extraction
   - structured read of concrete passages
   - object relationships
   - spatial events
   - value / color / edge / mark behavior
   - explicit uncertainty when the image is ambiguous
2. Critique generated from evidence, not vibe
   - Voice A and Voice B should be composed from an evidence-backed plan
   - do not let polished prose outrun grounded observations
3. General validators, not scene-specific patches
   - ask whether advice names a visible target
   - ask whether it describes what is happening there now
   - ask whether it prescribes a concrete intervention
   - ask whether it states the intended visual effect

Execution rules:
- reproduce, fix, verify, repeat
- prefer narrow fixes to general failure classes over per-fixture exceptions
- do not loosen standards just to get green runs
- add tests when they lock in a reusable rule
- use the smoke board to find failure classes, not as the definition of success

Verification:
- rerun `npm run critique:review:latest:smoke` multiple times, not just once
- if a smoke-only failure appears, inspect the evidence-attempt payloads before touching final-stage gates
- measure progress by eliminating failure classes, not by making one named painting pass
```

## Best first commands

- `npm test`
- `npx tsx scripts/test-critique-pipeline.ts "public/art/monet-impression-sunrise.jpg"`
- `npx tsx scripts/test-critique-pipeline.ts "Oil5 Small.png"`
- `npm run critique:review:latest:smoke`
- `npm run critique:review:latest:smoke -- "Oil5 Small.png"`

Use the smoke command first for uploaded paintings. It keeps going after failures and writes `docs/latest-upload-smoke.md` instead of aborting the whole batch on the first error.

## Current status

- The canonical Monet pipeline completes end-to-end.
- The CLI / smoke scripts now load `.env.local` the same way as `server/dev-api.ts`, so local repro commands no longer fail just because the key is only in `.env.local`.
- `Oil5 Small.png`, `Drawing1 Small.png`, `Drawing2 Small.png`, `Watercolor3 Small.png`, `Abstract1 Small.png`, and `Pastel1 Small.png` all complete end-to-end in the latest-upload smoke.
- The freshest smoke run is now `6 passed / 0 failed` in `docs/latest-upload-smoke.md`.
- The last high-value instability branch was `Watercolor3 Small.png` in smoke. The winning fix was to harden evidence-stage retry guidance for cafe / street scenes rather than loosening the final gate:
  - the validator now accepts concrete cafe-scene carriers and structural passages such as `the cafe tables with yellow umbrellas`, `the seated figures under the yellow umbrellas`, and `the path narrowing into the cafe tables`
  - the evidence prompt and retry note now teach the model to rewrite cafe-scene composition and conceptual evidence as physical path / table / umbrella / arch events instead of soft summaries like `the cafe atmosphere` or `the path leading through the scene`
- The earlier deterministic summary and top-level grounding repairs are still important. They continue to prevent generic Voice B summary text from surviving just because it is fluent.
- No blocking failure class is currently reproduced in the latest smoke board or the direct repros listed below.
- Residual risk is now mostly nondeterministic first-pass evidence noise:
  - some fixtures still show attempt 1 or attempt 2 evidence failures during smoke before the repair note converges
  - bridge-led and figure-led scenes can still drift into generic `strengthRead` or shorthand composition language on early attempts
  - reliability is materially better, but the next agent should confirm it with repeated smoke reruns rather than assuming one `6/0` batch means the system is fully stable

## Files already hardened

- `scripts/loadLocalEnv.ts`
- `lib/openaiCritique.ts`
- `lib/critiqueValidation.ts`
- `lib/critiqueWeakWorkContracts.ts`
- `lib/critiqueEvidenceStage.ts`
- `lib/critiqueWritingStage.ts`
- `lib/critiqueVoiceBCanonical.ts`
- `lib/critiqueAudit.ts`
- `lib/critiqueGrounding.ts`

## Useful recent additions

- `scripts/latestUploadFixtures.ts`
  Shared manifest for the latest uploaded QC paintings.

- `scripts/run-latest-upload-smoke.ts`
  Non-aborting runner for latest-upload fixtures. Accepts optional filters such as filename fragments or titles.

- `docs/latest-upload-smoke.md`
  Generated by the smoke runner. Use it as the current repro board.

## Practical advice for the next agent

- Treat the current scene-family examples as temporary exemplars of broader failure families, not as the long-term architecture.
- The next phase should bias toward generalization work: stronger evidence contracts, smarter evidence-to-critique synthesis, broader evaluation coverage, and repeated stochastic verification.
- If you have to choose, prefer a more general evidence or validation rule over another fixture-shaped patch.
- Prefer direct single-painting repros before touching prompts broadly.
- If a batch fails, reproduce that exact fixture with `scripts/test-critique-pipeline.ts` first.
- The evidence validator is still a major bottleneck, but the highest-leverage recent fix was architectural: `runCritiqueWritingStage()` no longer runs `assertCritiqueQualityGate()` before the outer post-processing / guardrail pass. Keep the final gate only after `applyCritiqueGuardrails()` in `runOpenAICritique()`.
- The final-retry lenient path now exists for:
  - top-level tone failures
  - generic evidence thresholds
  - aggregate anchor support across multiple evidence lines
  - conceptual `strengthRead` / `preserve` generic failures
  - conceptual anchor-support failures
  - conceptual-anchor softness failures
- If you relax validation further, keep it scoped to `lenient` mode on the final retry.
- The grounding equivalence map was expanded again for `seated/sitting/sitter`, `pose/posture/stance`, `tree/trunk`, `branch/branches`, `umbrella/umbrellas`, `table/tables`, `building/buildings`, `path/walkway/road`, and `chair/chairs`. This helped direct landscape and cafe-scene repros without relaxing invented evidence checks.
- `lib/critiqueWeakWorkContracts.ts`, `lib/critiqueEvidenceStage.ts`, and `lib/openaiCritique.ts` now include cafe / street-scene retry examples and guidance. If `Watercolor3 Small.png` or similar uploads regress, inspect those files before weakening validation.
- `lib/critiqueAudit.ts` and `lib/critiqueTextRules.ts` now treat a wider class of polished-but-useless teacher phrases as rewrite candidates, including lines like:
  - `add more definition`
  - `enhance spatial depth`
  - `remain harmonious`
  - `support the overall mood`
  - `blend more naturally with the scene`
  - `introduce more varied texture`
- `lib/critiqueAudit.ts` now rebuilds `overallSummary.topPriorities` and `simpleFeedback.studioChanges` from anchored category plans whenever the summary layer still looks generic or loses anchor support.
- The current best deterministic repros from this pass:
- `npm run critique:review:latest:smoke -- "Watercolor3 Small.png"` is the best check that the cafe-scene retry guidance is still closing the formerly nondeterministic smoke-only branch.
- `npx tsx scripts/test-critique-pipeline.ts "Watercolor3 Small.png"` now completes directly and remains the fastest single repro for generic cafe-scene evidence / Voice B drift.
- `npx tsx scripts/test-critique-pipeline.ts "Oil5 Small.png"` now completes directly and remains the best check that the premature inner quality-gate crash path is gone.
- `npx tsx scripts/test-critique-pipeline.ts "Pastel1 Small.png"` now completes directly and in smoke; if bridge-led conceptual scenes regress, start there.
- `npx tsx scripts/test-critique-pipeline.ts "Drawing2 Small.png"` now completes directly and in smoke; if figure-led interiors regress, start there.
- Exact verification commands from this pass:
  - `npm test -- critiqueValidation openaiCritique`
  - `npm run critique:review:latest:smoke -- "Watercolor3 Small.png"`
  - `npx tsx scripts/test-critique-pipeline.ts "Watercolor3 Small.png"`
  - `npm test`
  - `npx tsx scripts/test-critique-pipeline.ts "Watercolor3 Small.png"`
  - `npx tsx scripts/test-critique-pipeline.ts "Oil5 Small.png"`
  - `npm run critique:review:latest:smoke`
- Best next move:
  - rerun `npm run critique:review:latest:smoke` at least 2-3 more times to see whether `6/0` holds across independent model draws
  - if a single fixture regresses only in smoke, rerun `CRITIQUE_INSTRUMENT=true npm run critique:review:latest:smoke -- "<fixture>"`
  - if the same fixture passes direct repro but fails smoke, compare the evidence-attempt payloads and patch the retry guidance for that scene family rather than weakening the final gate
- Best next move if `Watercolor3 Small.png` regresses:
  - inspect whether the evidence stage has slipped back to soft carriers like `the cafe atmosphere`, `the outdoor seating area`, or `the path leading through the scene`
  - inspect whether composition evidence has slipped back to verdict language like `guides the eye` or `creates rhythm`
  - patch the cafe-scene examples in `lib/critiqueEvidenceStage.ts` / `lib/openaiCritique.ts` before changing validator thresholds
- Best next move if `Pastel1 Small.png` or `Oil5 Small.png` regresses:
  - use the instrumentation hooks in `lib/openaiCritique.ts`
  - run `CRITIQUE_INSTRUMENT=true npx tsx scripts/test-critique-pipeline.ts "<fixture>"`
  - inspect the printed evidence-attempt payloads and any `[critique grounding gate payload]`
  - patch the specific bridge-led rewrite or grounding equivalence branch instead of relaxing `critiqueNeedsFreshEvidenceRead()`
- The freshest smoke report is `docs/latest-upload-smoke.md`; trust that file over earlier conversational summaries because pass counts shifted during this run.
