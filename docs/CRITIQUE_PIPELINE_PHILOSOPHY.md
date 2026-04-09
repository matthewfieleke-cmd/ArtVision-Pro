# Critique pipeline philosophy (Phase 0 — helpfulness bar)

This document is the **alignment anchor** for anyone changing prompts, validation, or models.

## Who the critique is for

The reader is a **painter returning to the easel**. Success means they can answer:

1. **What** on the painting the feedback refers to (locatable on their reference).
2. **What** is working or not, in terms they can verify by looking.
3. **What to try next** (Voice B), at a scale that matches how strong that part of the work already is.

## What we optimize for

- **Substance over performance:** insight density and traceability to the image, not impressive phrasing.
- **Flexibility:** different genres and skill levels get different mixes of praise, bluntness, and homework—no single template temperature for every painting.
- **Robustness:** clear stage jobs and rich early detail so later stages are not forced to invent parallel descriptions.

## Phases (implementation map)

| Phase | Focus |
|-------|--------|
| 1 | Observation + evidence: dense, shared, locatable detail |
| 2 | Voice A = judgment; Voice B = teaching; same evidence spine |
| 3 | Voice A: plain, per-criterion, honest assessment |
| 4 | Voice B: procedural, ordered, medium-aware when justified |
| 5 | Golden-set and soft signals (`npm run critique:signals`) for regression awareness |
| 6 | Clarity pass: readability without literary inflation |

## Reviewing changes

When you ship a prompt or gate change, spot-check outputs against this bar and, when possible, run **`npm run critique:signals`** on saved JSON to catch repetition or drift—not as a hard gate, but as a **signal**.
