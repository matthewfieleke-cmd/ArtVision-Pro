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
- suggestedPaintingTitles: exactly 3 objects, each { category, title, rationale }. One "formalist" (from Composition, Value, Color, Drawing criteria — name the dominant structural element), one "tactile" (from Style, Medium, Surface, Edge criteria — name the physical execution), one "intent" (from Intent and Presence criteria — name the mood/psychology). Title Case, no quotes, no cliché or generic names. Each rationale: 1–2 sentences explaining how the specific criterion scores/feedback generated this title.
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
- voiceBPlan: structured teacher notes for this criterion — currentRead, bestNextMove, expectedRead, plus optional mainProblem/mainStrength/avoidDoing/storyIfRelevant; fields must not duplicate the same prose
- actionPlanSteps: exactly 1 structured Voice B step per criterion, with { area, currentRead, move, expectedRead, preserve, priority }; for non-Master criteria this must be a real on-canvas change, and for Master it must be preserve-only
- phase3: { teacherNextSteps } — Voice B one-paragraph rendering of actionPlanSteps only, no extra duplicate moves. It may optionally start with "1." for UI compatibility, but it must still read as one polished paragraph. Master only: may start with "Don't change a thing." then brief praise. Any other level: one grounded instructional move only. Do not park Edge and Surface one band below everything else by default.
- confidence
- evidenceSignals: 2–4 lines, each distilling a distinct visibleEvidence line for this criterion—no new claims
- preserve
- nextTarget
- anchor: { areaSummary, evidencePointer, region } — same exact passage used by feedback, actionPlan, overlay, and edit plan
- editPlan: { targetArea, preserveArea, issue, intendedChange, expectedOutcome, editability } — machine-readable and aligned to anchor
- subskills`;
}

export function buildVoiceASchemaInstruction(): string {
  return `Return JSON with:
- summary — Voice A one-sentence synopsis for THIS painting only; name at least one recognizable passage from the evidence rather than giving generic praise
- suggestedPaintingTitles: exactly 3 objects { category, title, rationale }. One "formalist", one "tactile", one "intent". Title Case, no quotes, no cliché. Rationale explains how the specific criterion data generated the title.
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
- actionPlanSteps: exactly 1 structured Voice B step, with { area, currentRead, move, expectedRead, preserve, priority }
- voiceBPlan: structured teacher notes for this criterion — { currentRead, mainProblem, mainStrength, bestNextMove, optionalSecondMove, avoidDoing, expectedRead, storyIfRelevant }
- phase3: { teacherNextSteps } — one-paragraph rendering matching actionPlanSteps only—no extra steps or repeated moves
- anchor: { areaSummary, evidencePointer, region }
- editPlan: { targetArea, preserveArea, issue, intendedChange, expectedOutcome, editability }`;
}
