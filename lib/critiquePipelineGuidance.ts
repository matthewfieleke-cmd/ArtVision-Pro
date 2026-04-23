/**
 * Shared prompt-guidance blocks used by the evidence (vision) stage.
 *
 * The pre-gpt-5 pipeline also carried separate Voice A / Voice B / clarity
 * guidance here; those stages now consume their framing directly from
 * `shared/critiqueVoiceA.ts` (which defines the composite-panel system
 * messages and the per-voice paragraph shapes). Only the evidence-stage
 * blocks remain.
 */

/** Stage 0 — observation bank: maximize locatable detail for downstream stages. */
export const OBSERVATION_BANK_DEPTH_GUIDANCE = `
Depth goal (stage 0):
- Treat this bank as the **inventory** Voice A and Voice B will share. Favor **many distinct, findable facts** over sparse summaries.
- Each passage should give a painter something they could **point to on the canvas**: named parts in a named relationship (what meets what, how light or color behaves there).
- **Spread** observations across the image where the picture allows—top, middle, bottom, major masses, and key transitions—so later criteria are not all fighting over one corner.
- **Stay descriptive before judgment:** visibleFacts and visibleEvents read like a careful look; verdicts and teaching belong in later stages.
- **Stay adaptable:** figure paintings, landscapes, abstractions, and still lifes need different mixes of passages—cover what this image actually offers, not a fixed checklist of topics.
`.trim();

/** Stage 1 — evidence: use the bank so each criterion gets specific, non-fungible lines. */
export const EVIDENCE_RICHNESS_GUIDANCE = `
Rich evidence (stage 1):
- Pull the **strongest fitting** passages from the observation bank per criterion. When several passages could work, prefer the one that yields the most **specific** visibleEvidence for **that** axis (value vs color vs edge vs surface, etc.).
- Aim for blocks that would **not** make sense if you swapped them between two criteria: if two criterion write-ups are interchangeable, deepen anchor language and junction detail until they are not.
- You are still documenting **what is visible and what tensions read there**—not prescribing studio fixes (that comes later).
`.trim();

/** How the pipeline fits together; keeps stages from overreaching each other's jobs. */
export const PIPELINE_STAGE_CONNECTION = `
How the pipeline fits together:
- Stages 0–1 produce a **shared factual layer** (passages + per-criterion evidence) that every later stage reuses.
- Voice A turns that layer into **per-criterion judgment** (critical prose tied to evidence).
- Voice B turns the same layer plus Voice A into **actionable studio guidance** for this canvas only.
- **Adapt to the painting:** strong work gets modest, precise diagnosis; fragile work gets blunt, located description—avoid a single rhetorical temperature for every image.
`.trim();
