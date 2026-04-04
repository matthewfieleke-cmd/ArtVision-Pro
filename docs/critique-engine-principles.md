# Critique Engine Principles

This note is for any agent or engineer working on the critique engine.

## Goal

Build a critique engine that produces accurate, detailed, specific critique for thousands of paintings across the supported styles and media. Do not optimize only for the current smoke fixtures.

## What should remain true

- Critique must stay tied to concrete visible passages, not painting-level summaries.
- Teacher advice must name:
  - a visible target
  - what is happening there now
  - a concrete intervention
  - the intended visual result
- Summary and coaching layers should be rebuilt from grounded category data when fluent prose drifts generic.
- Truthful rephrasings of the same visible fact should still count as grounded when the language is genuinely equivalent.

## Target architecture

### 1. Strong evidence extraction

The evidence stage should produce a structured read of:

- concrete passages
- object relationships
- spatial events
- value behavior
- color behavior
- edge behavior
- mark / surface behavior
- explicit uncertainty when the photo is ambiguous

The system should prefer "what is visibly happening where" over evaluative shorthand.

### 2. Critique from evidence, not vibe

Voice A and Voice B should be composed from an evidence-backed plan.

Avoid letting polished prose outrun the structured evidence. If the freeform writing drifts generic, repair it from grounded category data rather than trusting the fluent sentence.

### 3. General validators, not scene-shaped patches

Prefer validators that ask universal questions:

- Does the advice name a visible target?
- Does it describe what is happening there now?
- Does it prescribe a concrete change?
- Does it state the intended visual effect?
- Does the wording still trace back to the same evidence anchor?

These are better long-term controls than adding more and more scene-specific exceptions.

## How to use fixtures correctly

Fixtures are useful for reproducing failure classes. They are not the product definition.

When a fixture fails, ask:

- What reusable failure class does this represent?
- Can the fix improve evidence extraction, grounded synthesis, or generic validation more broadly?
- Am I about to patch one image, or strengthen a rule that applies to many paintings?

If a change mainly teaches the system a new named scene instead of a broader visual rule, treat it as a temporary stopgap.

## Preferred direction of travel

- Strengthen evidence contracts
- Improve evidence-to-critique planning
- Keep validators scene-agnostic where possible
- Expand evaluation coverage across many painting families
- Rerun smoke multiple times to measure stochastic reliability

## Anti-goals

- Do not loosen standards only to get green runs.
- Do not trust grammatically clean critique if it is generic or weakly grounded.
- Do not confuse one successful smoke run with full reliability.
- Do not keep stacking narrow patches when a more general rule is available.
