import {
  CRITIQUE_AUDIENCE_FRAMING,
  EVIDENCE_STAGE_ASSESSMENT_PROTOCOL,
  EVIDENCE_STAGE_CLOSE_READING,
} from '../shared/critiqueVoiceA.js';
import { OBSERVATION_BANK_DEPTH_GUIDANCE } from './critiquePipelineGuidance.js';

/**
 * Vision-stage prompt builder.
 *
 * The vision stage is now observation-bank-only: one call that sees the
 * image, produces the shared observation bank and a top-level read
 * (intent hypothesis, strongest visible qualities, main tensions, photo
 * quality, completion, comparison observations). Per-criterion evidence,
 * anchors, bounding-box regions, Voice A / Voice B prose, and editPlan all
 * happen later, in the eight parallel per-criterion writer calls which each
 * see the image themselves.
 *
 * The old unified prompt is gone: building 8 criterion evidence blocks and
 * 8 anchor regions inside a single serial vision call was the slowest thing
 * in the pipeline by a wide margin.
 */

function mediumEvidenceGuardrails(medium: string): string {
  switch (medium) {
    case 'Drawing':
      return `Medium-specific evidence rules for Drawing:
- Treat "color relationships" as value harmony, paper tone, and mark-family relationships unless actual color media is clearly present.
- Pay extra attention to line weight, pressure, erasure, proportion, edge hierarchy, and value grouping.`;
    case 'Watercolor':
      return `Medium-specific evidence rules for Watercolor:
- Notice transparency, paper reserve, wet-into-wet diffusion, hard-vs-soft edges, blooms/backruns, and whether washes stay clean.
- Do not treat softness or luminous paper as automatic weakness. Record if a passage would be damaged by overworking.`;
    case 'Pastel':
      return `Medium-specific evidence rules for Pastel:
- Notice tooth, layering, broken color, soft transitions, pressure changes, and whether the surface stays breathable.
- Record whether softness and dust-like vibration are functioning as strengths rather than defects.`;
    case 'Acrylic':
      return `Medium-specific evidence rules for Acrylic:
- Notice flat opaque passages, quick-drying edge decisions, layered corrections, and whether the surface stays crisp or deadened.
- Do not assume oil-like blending time if the paint is intentionally sharper and flatter.`;
    case 'Oil on Canvas':
      return `Medium-specific evidence rules for Oil on Canvas:
- Notice massing, scumble, glaze/opaque contrast, edge drag, brush direction, and whether reworking has enriched or dulled the surface.
- Do not treat painterly texture, drag, or broken passages as problems unless they clearly weaken the read.`;
    default:
      return `Medium-specific evidence rules:
- Let the declared medium change what counts as control, finish, softness, and correction. Do not recommend moves that fight the medium's natural strengths.`;
  }
}

const HARD_RULES_BLOCK = `
Hard rules (apply to every field you write):
- Ground every observation in what is visible in THIS photograph. Do not describe passages that are not there.
- Never name any critic, teacher, artist, famous artwork, or art-historical movement. The reader never sees those names.
- Separate what you can clearly see from what you are inferring. Lower confidence when the capture is ambiguous.
- Stay at the level of observation: passages, visible events, intent carriers, medium cues, photo caveats, and a short top-level read. Do not prescribe fixes here; that belongs to the per-criterion writer stage.
- The framework is painting-agnostic. Figurative, landscape, still life, abstract, representational, non-objective — use passage grammar that fits what is actually on the canvas (a jaw edge against the hair; a bright cadmium strip against an olive field; a ridge line where it meets the sky; a heavy impasto cluster in the lower right).
`.trim();

/**
 * Vision stage — observation bank + top-level read only.
 *
 * The prompt is deliberately short. The vision pass is predominantly
 * perception (reading the image and producing a shared passage bank the
 * per-criterion writers will reuse); the writers now own per-criterion
 * evidence, anchors, regions, prose, and editPlan. Keeping this prompt
 * focused is the single largest pipeline-latency lever.
 */
export function buildObservationBankStagePrompt(style: string, medium: string): string {
  return `You are the vision stage of a painting critique system. See the painting image and produce ONE compact observation bank plus a short top-level read of the painting. You are NOT critiquing, not rating, not picking per-criterion anchors, and not locating bounding boxes — the per-criterion writer stage does all of that, with the image, after you.

${CRITIQUE_AUDIENCE_FRAMING}

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

Observation-bank rules:
- Every passage must be pointable on the canvas. Use carrier grammar that names a visible passage on the actual image: "[thing] against [thing]", "[thing] where it meets [thing]", "[thing] across [field]", "[thing] under [thing]", "[thing] above [thing]", or "[path/band] leading toward [thing]".
- Give every passage a stable id like "p1", "p2", "p3". Downstream writers will reuse the passage by id and copy its label verbatim.
- At least one visibleFacts line for each passage must restate the concrete nouns from that passage label and describe what is visibly happening there.
- Every visibleEvents entry is event-first (what narrows, widens, cuts, overlaps, aligns, tilts, bends, stacks, separates, stays lighter/darker, warmer/cooler, softer/harder, or lands against what) and cites one existing passage id.
- intentCarriers are physical passages on the canvas where pressure, address, contact, or bodily/viewpoint force is visible. Rank the most direct carrier first.
- Spread passages across the image and across kinds of evidence (value/light, color, edge/focus, space/drawing, surface/medium).

Top-level read (must come with the observation bank):
- intentHypothesis: one sentence on what this painting is genuinely going for, on the evidence.
- strongestVisibleQualities: 2–4 short lines naming what is clearly working in the image.
- mainTensions: 2–4 short lines naming what is clearly unresolved. If the painting is strong across the board, keep this short and honest — do not manufacture tensions.
- photoQualityRead: poor / fair / good, a one-sentence summary, and 0–4 specific issues if any.
- completionRead: unfinished / likely_finished / uncertain, with confidence and 1–4 visible cues + a short rationale.
- comparisonObservations: 0–4 optional formal comparisons (no artist names).

${HARD_RULES_BLOCK}

Context:
- Declared style: ${style}
- Declared medium: ${medium}

${mediumEvidenceGuardrails(medium)}

${OBSERVATION_BANK_DEPTH_GUIDANCE}

Return JSON only.`;
}

/**
 * Back-compat export. The architecture test imports this name and spot-checks
 * that the prompt carries the core invariants. The observation-bank prompt is
 * the only stage where those invariants live now.
 */
export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildObservationBankStagePrompt(style, medium);
}
