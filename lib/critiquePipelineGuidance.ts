/**
 * Roadmap-aligned instruction blocks for the critique pipeline.
 * Framed as clear goals and flexible discipline—not brittle phrase bans.
 */

/** Phase 1 — observation bank: maximize locatable detail for downstream stages. */
export const OBSERVATION_BANK_DEPTH_GUIDANCE = `
Depth goal (stage 0):
- Treat this bank as the **inventory** Voice A and Voice B will share. Favor **many distinct, findable facts** over sparse summaries.
- Each passage should give a painter something they could **point to on the canvas**: named parts in a named relationship (what meets what, how light or color behaves there).
- **Spread** observations across the image where the picture allows—top, middle, bottom, major masses, and key transitions—so later criteria are not all fighting over one corner.
- **Stay descriptive before judgment:** visibleFacts and visibleEvents read like a careful look; verdicts and teaching belong in later stages.
- **Stay adaptable:** figure paintings, landscapes, abstractions, and still lifes need different mixes of passages—cover what this image actually offers, not a fixed checklist of topics.
`.trim();

/** Phase 1 — evidence: use the bank so each criterion gets specific, non-fungible lines. */
export const EVIDENCE_RICHNESS_GUIDANCE = `
Rich evidence (stage 1):
- Pull the **strongest fitting** passages from the observation bank per criterion. When several passages could work, prefer the one that yields the most **specific** visibleEvidence for **that** axis (value vs color vs edge vs surface, etc.).
- Aim for blocks that would **not** make sense if you swapped them between two criteria: if two criterion write-ups are interchangeable, deepen anchor language and junction detail until they are not.
- You are still documenting **what is visible and what tensions read there**—not prescribing studio fixes (that comes later).
`.trim();

/** Phase 2 — how stages connect; reduces role drift and empty eloquence. */
export const PIPELINE_STAGE_CONNECTION = `
How the pipeline fits together:
- Stages 0–1 produce a **shared factual layer** (passages + per-criterion evidence) that every later stage reuses.
- Voice A turns that layer into **per-criterion judgment** (levels + critical prose tied to evidence).
- Voice B turns the same layer plus Voice A into **actionable studio guidance** for this canvas only.
- **Adapt to the painting:** strong work gets modest, precise diagnosis; fragile work gets blunt, located description—avoid a single rhetorical temperature for every image.
`.trim();

/** Phase 3 — Voice A: mature critic, plain and traceable. */
export const VOICE_A_MATURE_ANALYSIS_GUIDANCE = `
Voice A — mature assessment (from evidence only):
- Write for a painter who might **disagree with you**: important claims should be traceable to that criterion's anchor and visibleEvidence.
- **Specific before evaluative:** In phase1 and phase2, lead with **named visible things** (objects, bands, intervals, temperatures, edge types) from the anchor and visibleEvidence. Ban standalone vague zones: never end a thought on “the composition,” “the overall structure,” “the picture,” or “the scene” without naming **which** forms or junctions you mean in **this** image.
- **Prefer plain technical language** over elevated or literary tone: concrete nouns (shapes, planes, edges, values, temperatures, marks), short sentences, one main idea per sentence when possible.
- The eight criteria are **eight different questions.** Let ratings and prose **diverge** naturally when the picture is strong in one axis and weaker in another—uniform rows are uncommon in real work.
- Ask implicitly: *What would I need to see on the canvas to read this criterion one band higher?* Use that to stay honest without inventing problems.
- phase1 stays **descriptive**; phase2 states **what those observed facts do** in the picture (formally and perceptually)—still without saying how to fix it on the easel (that is Voice B).
`.trim();

/** Phase 4 — Voice B: clear teaching derived from plan + evidence. */
export const VOICE_B_CLEAR_TEACHING_GUIDANCE = `
Voice B — clear teaching:
- The reader should know **what to try**, **where on the painting**, and **what should look different** afterward—without re-grading Voice A.
- **Locate first, then instruct:** The first clause of teacherNextSteps (and of plan.currentRead) should make it obvious **which passage** on the canvas you mean—reuse anchor.areaSummary or its concrete nouns—then describe edges, values, or color behavior there. If a stranger could not point at the photo while reading your sentence, rewrite it.
- Favor **procedural** wording (verbs of making: group, separate, soften, sharpen, reserve, darken, restate, glaze) tied to the **named passage**.
- Let **one primary move** per non-Master criterion carry the paragraph so advice stays executable, not a list of vague aspirations.
- **Scale instruction to level:** lower bands call for foundational, legible moves; higher bands call for smaller calibrations—match the size of the advice to Voice A's level for that row.
- Teach in the **spirit of the declared medium** when the evidence supports it; stay technique-neutral when the photo or evidence does not justify a specific medium move.
`.trim();

/** Phase 6 — clarity pass: polish without inflating tone or dropping located detail. */
export const CLARITY_SUBSTANCE_GUIDANCE = `
Readability pass:
- Make sentences easier to read, not more **ornate** or impressive. If the input was plain, keep it plain.
- Do **not** add filler that sounds authoritative but adds no located content.
- Shortening is welcome when **no** anchored detail or judgment is lost.
`.trim();
