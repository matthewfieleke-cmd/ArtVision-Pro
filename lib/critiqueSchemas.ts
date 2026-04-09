import {
  phaseSchemaSummaryLines,
  phaseVoiceASummaryLines,
  phaseVoiceBSummaryLines,
} from './critiquePhasePromptBlocks.js';

/**
 * User-message field lists for OpenAI structured outputs.
 * Canonical JSON shapes live in critiqueZodSchemas.ts (Zod → OpenAI schema).
 */

export function buildCritiqueSchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 objects, each { category, title, rationale }. One "formalist" (Composition, Value, Color, Drawing — what holds the design), one "tactile" (Style, Medium, Surface, Edge — how it is materially built), one "intent" (Intent, Presence — how it feels or reads). Plain working titles: 2–8 words, sentence case or light title case, no quotes. Avoid exhibition clichés and repeated templates ("… Study", "… Tension", "Symphony of …"). Each rationale: one clear sentence tying the title to this painting’s evidence—no thesis tone.
- overallSummary: { analysis, topPriorities } — analysis is Voice A only; topPriorities = 1–2 Voice B priorities
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A: composite art-historical critic (see full system prompt); do not name critics. Two paragraphs; every claim anchored in THIS painting (named passages from evidence). Must align with the eight category levels; no overlap between the two paragraphs.
- studioChanges: 2–5 items, each { text, previewCriterion } — Voice B: composite studio teacher (see system prompt); responds to Voice A + evidence; do not name teachers. Each text names where and how on THIS canvas; previewCriterion from CRITERIA_ORDER.
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- level: Voice A’s ranking for that criterion alone—Beginner / Intermediate / Advanced / Master—eight independent integrated judgments from the evidence; no single-feature shortcuts; not one grade repeated eight times unless truly warranted.
${phaseSchemaSummaryLines()}
- plan: { currentRead, move, expectedRead, preserve, editability } — canonical Voice B teaching plan for this criterion; one concrete visible current read, one concrete move, one expected read, and one preserve field. Use empty string for preserve if there is nothing specific to protect.
- phase3: { teacherNextSteps } — Voice B one-paragraph rendering of plan only, no extra duplicate moves. It may optionally start with "1." for UI compatibility, but it must still read as one polished paragraph. Master only: may start with "Don't change a thing." then brief praise. Any other level: one grounded instructional move only. Do not park Edge and Surface one band below everything else by default.
- confidence
- evidenceSignals: 2–4 lines, each distilling a distinct visibleEvidence line for this criterion—no new claims
- preserve
- nextTarget
- anchor: { areaSummary, evidencePointer, region } — same exact passage used by feedback, canonical plan, overlay, and any derived edit plan
- subskills`;
}

export function buildVoiceASchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 objects { category, title, rationale }. One "formalist", one "tactile", one "intent". Sketchbook-plain titles (2–8 words); sentence case or light title case; no quotes; no stock poetic or template endings. Rationale: one sentence, grounded in this painting’s criterion data.
- overallSummary: { analysis } — Voice A only
- studioAnalysis: { whatWorks, whatCouldImprove } — Voice A only; two paragraphs must not duplicate each other
- comparisonNote
- overallConfidence
- photoQuality
- categories

For each criterion:
- level: Voice A’s ranking for that criterion alone
${phaseVoiceASummaryLines()}
- confidence
- evidenceSignals: 2–4 short lines, each from a distinct visibleEvidence entry—no new locations
- preserve
- nextTarget
- subskills`;
}

export function buildVoiceBSchemaInstruction(): string {
  return `Return JSON with:
- overallSummary: { topPriorities } — Voice B only
- studioChanges: 2–5 items, each { text, previewCriterion }
- categories

For each criterion:
${phaseVoiceBSummaryLines()}
- plan: { currentRead, move, expectedRead, preserve, editability } — canonical Voice B teaching plan for this criterion. Use empty string for preserve if there is nothing specific to protect.
- phase3: { teacherNextSteps } — one-paragraph rendering matching plan only—no extra steps or repeated moves
- anchor: { areaSummary, evidencePointer, region }
- Legacy compatibility fields may be derived later; do not invent alternate restatements of the same move.`;
}
