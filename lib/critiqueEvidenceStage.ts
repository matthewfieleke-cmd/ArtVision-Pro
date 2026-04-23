import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import {
  CRITIQUE_AUDIENCE_FRAMING,
  EVIDENCE_STAGE_ASSESSMENT_PROTOCOL,
  EVIDENCE_STAGE_CLOSE_READING,
} from '../shared/critiqueVoiceA.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import {
  EVIDENCE_RICHNESS_GUIDANCE,
  OBSERVATION_BANK_DEPTH_GUIDANCE,
  PIPELINE_STAGE_CONNECTION,
} from './critiquePipelineGuidance.js';

/**
 * Evidence-stage prompt builders for the vision pass.
 *
 * History note: earlier versions of this file were written for a much
 * weaker vision model and carried a large amount of defensive scaffolding —
 * repeated "never name artists" reminders, long lists of "do NOT write X /
 * rewrite as Y" examples, and separate weak-work / composition-repair
 * clauses that the retired validators used to police after the fact. On
 * gpt-5.4 those instructions consistently underperformed a shorter, more
 * positive version: the model already obeys compact positive discipline
 * and the negative-example lists were competing with the real rules for
 * attention. The prompt has been rewritten as positive instructions
 * organised by what the model is actually building (observation bank →
 * evidence → anchor regions).
 */

function isStyleKey(s: string): s is StyleKey {
  return Object.prototype.hasOwnProperty.call(ARTISTS_BY_STYLE, s);
}

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
- Separate what you can clearly see from what you are inferring. Lower confidence when the capture is ambiguous; say so in tensionRead when the photo itself is the limiting factor.
- Stay at the level of evidence, tensions, and what should be preserved. Do not prescribe fixes here; that belongs to later stages.
- Eight criteria are eight different questions. Let different criteria reach different reads on the same painting.
`.trim();

function buildObservationPrompt(style: string, medium: string): string {
  return `You are stage 0 of a painting critique system.

Build one compact observation bank of locatable passages that every later stage can reuse. You are NOT critiquing and NOT rating anything.

${CRITIQUE_AUDIENCE_FRAMING}

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

Observation-bank rules:
- Every passage must be pointable on the canvas. Use carrier grammar: "[thing] against [thing]", "[thing] where it meets [thing]", "[thing] across [field]", "[thing] under [thing]", "[thing] above [thing]", or "[path/band] leading toward [thing]".
- Give every passage a stable id like "p1", "p2", "p3". Downstream stages reuse the passage by id and copy its label verbatim.
- At least one visibleFacts line for each passage must restate the same concrete nouns from that passage label and describe what is visibly happening there.
- Every visibleEvents entry is event-first: what narrows, widens, cuts, overlaps, aligns, tilts, bends, stacks, separates, stays lighter/darker, warmer/cooler, softer/harder, or lands against what — and every entry cites one existing passage id and copies that passage label verbatim.
- intentCarriers are still physical passages on the canvas. Pick the passages where pressure, address, contact, or bodily/viewpoint force is visible in the passage itself; rank the most direct carrier first. Passages that only prove rhythm, balance, or route are weaker intent carriers than passages where one form presses against, cuts into, or holds another visible thing.
- Spread passages across the image and across kinds of evidence (value/light, color, edge/focus, space/drawing, surface/medium) so downstream criteria are not all fighting over one corner.

${HARD_RULES_BLOCK}

Context:
- Declared style: ${style}
- Declared medium: ${medium}

${mediumEvidenceGuardrails(medium)}

${OBSERVATION_BANK_DEPTH_GUIDANCE}

Return JSON only.`;
}

function buildEvidencePrompt(style: string, medium: string): string {
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  return `You are stage 1 of a painting critique system.

Extract visible evidence and tensions from the painting. You are NOT critiquing yet.

${CRITIQUE_AUDIENCE_FRAMING}

${PIPELINE_STAGE_CONNECTION}

The user message includes a shared observation bank already grounded in the image. Reuse those passages wherever they genuinely fit; if one observation-bank passage fits a criterion, copy its passages[].label verbatim as this criterion's anchor rather than paraphrasing it.

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

${HARD_RULES_BLOCK}

Additional discipline:
- If a painting is already strong on a criterion, say so plainly. If nothing on an axis is genuinely unresolved, say so in tensionRead rather than manufacture a problem. Forced tensions produce bad downstream advice.
- If the work reads convincing overall, still look for the one or two relationships that remain least resolved.
- Distinguish deliberate stylization (bold, simplified, distorted, or high-contrast but internally controlled) from rudimentary execution. Do not confuse novice work for successful Expressionism or Abstract Art, and do not punish bold handling the evidence shows is earned.
- If value compression, softness, atmospheric openness, or ambiguity appear intentional, record that as a condition of the work, not an automatic flaw.
- Distinguish photo-capture limits ("this capture hides the fine handling") from canvas-state problems ("handling looks inconsistent on the canvas"). Photo limits belong in photoQualityRead and should lower confidence for affected criteria rather than downgrade every axis by a band.

Anchors (the single most important instruction in this stage):
- For each criterion, pick ONE concrete anchor: a locatable junction or passage specific enough that a teacher could point to the exact place on the canvas without ambiguity.
- Prefer object-pair or junction anchors over scene summaries. "The band under the block", "the edge against the wash", "the clustered patch meeting a lighter strip" — not "the background" or "the left side".
- For conceptual criteria (Intent and necessity; Presence, point of view, and human force) the anchor is STILL a physical carrier passage. Use carrier grammar: "[thing] against [thing]", "[thing] beside [thing]", "[thing] where it meets [thing]", "[path/band] leading toward [thing]". The rule is whether a teacher could point to that passage; the rule is not a list of approved nouns.
- Anchor grammar is a noun phrase, not a predicate. Downstream prose writes "In [anchor], …", so the anchor must grammatically fit after "in". Pose, action, or state go into visibleEvidence lines, never into the anchor.
  - Correct: "the foreground figure and the vine-covered field behind it"; "the jaw edge where it meets the shadow side"; "the lower-left diagonal band".
  - Wrong: "the figure's hands resting on the chair"; "the horizon stretching across the canvas".
- observationPassageId and anchor must point to the same observation-bank passage. Copy that passage's label verbatim when it fits.

Visible evidence lines:
- 4–8 junction-level observations per criterion. Each names TWO identifiable things and describes the specific relationship between them (value break, color shift, edge event, spatial overlap, alignment).
- The FIRST visibleEvidence line must reuse the same concrete nouns as the anchor and describe one visible event there. The SECOND line should stay on that passage or an immediately touching neighbor. Only then should you widen to nearby evidence.
- For Composition and shape structure, at least two lines describe structural events — narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, tilts — while naming the concrete forms involved.
- For conceptual criteria, lead with the visible event. At least one line should explain WHY this passage carries intent or presence rather than a nearby structural passage.
- A line that could fit many paintings by swapping one noun is too generic; rewrite it with the visible event specific to THIS canvas.

strengthRead / tensionRead / preserve:
- strengthRead names the specific passage and relationship that works. It may interpret what the passage accomplishes, but it must name the passage directly.
- tensionRead names what is genuinely unresolved and WHERE. If nothing is, say so plainly.
- preserve names the specific relationship that must survive revision — the passage and the visual event, not an abstract quality.
- For conceptual criteria, strengthRead and preserve should reuse the anchor nouns; do not switch to theme words like "warmth", "presence", or "story".

Edge / focus and surface / medium (avoid lazy defaults):
- Edge and focus control: record where hard vs. soft edges sit, what wins first attention, where lost-and-found is functioning, and whether softness is photographic capture or painted ambiguity. If the photo itself blurs the hierarchy, lower this criterion's confidence and note the capture limit — do not issue a generic "edges need work".
- Surface and medium handling: name actual mark behavior — direction, thickness, wet/dry, scumble, tooth, correction layers — visible in the image. The anchor names a locatable mark-bearing passage, not a medium label. Distinguish "cannot see handling in this capture" from "handling looks inconsistent on the canvas".

Context:
- Declared style: ${style}
- Declared medium: ${medium}
- Use the rubric bands below for what "Master" means in this declared style — without naming or comparing to any artist.

Criterion-specific four-band rubric for this style (use the stated band boundaries, not generic vibe):
${rubricBlock}

${mediumEvidenceGuardrails(medium)}

${EVIDENCE_RICHNESS_GUIDANCE}

For each criterion, emit: observationPassageId, anchor, visibleEvidence, strengthRead, tensionRead, preserve, confidence (low / medium / high).

Return JSON only.`;
}

export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildEvidencePrompt(style, medium);
}

/**
 * Anchor-region rules used by the vision stage. The model has the image
 * loaded and produces a normalized bounding box for each criterion's
 * evidence anchor in the same call. These rules are where the bulk of
 * region-finding accuracy lives; they stay verbose deliberately.
 */
const ANCHOR_REGION_RULES = `Anchor-region rules (for "anchorRegions" in the response):
- Output normalized axis-aligned bounding boxes (x, y, width, height) in 0–1 coordinates relative to the full image (x=0 left, y=0 top, width/height as fractions of image width/height).
- "anchorRegions" has exactly one entry per criterion, in the SAME canonical order as evidence.criterionEvidence. Each entry is { "criterion": "<criterion name>", "region": { x, y, width, height } }.
- Each box must contain the visible motifs named by that criterion's evidence anchor (areaSummary + the visibleEvidence lines that echo it) — not empty sky, random background, or a different object.
- Tight fit: most pixels inside each box belong to that passage — except when the anchor names a broad horizontal band, where width should span the scene even if that admits some adjacent pixels at the edges.
- Vertical cues: "foreground", "tables", "figures seated", "umbrellas", "path", "stairs", "bridge", "railing", "near the bottom" → box extends toward the bottom (larger y + height). "Sky", "upper canopy only", "distant treetops" → box sits higher.
- Horizontal boundaries / junctions (phrases like "where X meets Y", "X meeting Y", "horizon", "shoreline", "waterline", "edge of the sea", "sea and sky"): the box must straddle that boundary. Include pixels on both sides so the dividing line lies inside the rectangle; do not place the box entirely in the sky when the text names the sea, the horizon, or both sides of a color break at the horizon. Center the band vertically on that line, typically ~0.06–0.18 of image height.
- Small scattered motifs (flocks, distant birds, boats, figures, buoys, posts): the box is the smallest axis-aligned rectangle that contains EVERY instance matching the description in the relevant band. A box that covers empty sky while the described marks sit outside it is wrong.
- Contrast pairs ("A against B", "A on B"): include BOTH A and the adjacent B so the relationship is visible.
- Named object + secondary context ("X under the sky", "X against the horizon", "distant X"): locate X first. The box must contain the named structure or mass (building, house, boat, figure, etc.); then widen to show the relation. Never return a box that lies entirely in empty background while the named X sits outside.
- Object-first rule: when the anchor names a specific object plus a relation, the named object is the required center of the box. A nearby edge, silhouette, or brightness pattern does not count unless the named object is actually inside the box.
- Specific noun priority: when the anchor includes one specific object plus broader location context, prioritize the most specific named object first and treat the surrounding phrase as context. Example: in "the small boat under the bridge", prioritize BOAT first and "under the bridge" second.
- Text / sign / lettering rule: if the anchor names a sign, quoted word, letters, numbers, label, banner, poster, painted text, or any text-bearing object, the box centers on the actual text-bearing object. Do not substitute a nearby doorway, porch light, or bright ornament in the same area.
- No proxy-object substitution: do not replace the named object with a nearby object just because it is brighter, larger, more central, or easier to see. A nearby glow is not a sign; a skirt fold is not a hand.
- Small-target rule: if the anchor names a small object (hand, cup rim, earring, sign, candle, eye, small window, small boat), prefer a tight local box around that object rather than a medium box centered on the surrounding body or room.
- Plural repeated elements ("posts", "rails", "pickets", "figures", "windows", "boats"): when several clear repeats appear along a line, treat the passage as the group and widen the box so multiple repeats are inside.
- Wide horizontal bands ("sky above…", "cloud band", "treeline against sky", "ridge across the top"): cover most of the image width (typically width ≥ 0.55 unless the motif is clearly localized to one side). Avoid a small corner crop that could be any patch of sky.
- Diagonal structures (bridge, path): use an elongated box along the structure, not a small centered square that misses it.
- If a passage is ambiguous, choose the most literal reading that matches the nouns in the anchor text.`;

/**
 * Merge A + Merge C: produce the observation bank, the evidence object, AND
 * per-criterion anchor regions in a single vision call. Concatenating the
 * three instruction blocks gives the model:
 *
 *   1. A reusable observation bank with stable passage ids.
 *   2. Per-criterion evidence anchored back to those passages.
 *   3. Normalized bounding boxes for each anchor, located in the photo.
 *
 * Doing all three in one call removes the cross-call drift where a
 * downstream stage could pick paraphrased anchors or boxes that disagreed
 * with the evidence, and saves two full vision round-trips.
 *
 * The response shape is:
 *   { observationBank: { ... }, evidence: { ... }, anchorRegions: [ ... ] }
 * which is validated by `visionStageResultSchema`.
 */
export function buildVisionStagePrompt(style: string, medium: string): string {
  return `You are the unified vision-reading stage of a painting critique system. You produce THREE things in ONE JSON response: a reusable observation bank, the evidence object that depends on it, and one normalized bounding box per criterion locating each evidence anchor in the photograph.

The response MUST have exactly these top-level keys:
  - "observationBank": follows the observation-bank rules below.
  - "evidence": follows the evidence rules below, and ALL evidence.criterionEvidence[].observationPassageId values MUST refer to ids that exist in observationBank.passages[].id.
  - "anchorRegions": an array of exactly eight { criterion, region } entries, one per criterion in the SAME order as evidence.criterionEvidence, each box tightly covering the visible passage named by that criterion's evidence anchor.

Build the observation bank first (mentally), then build evidence that reuses those exact passages by id, then locate each criterion's evidence anchor in the actual photograph as a normalized box. Do NOT invent evidence anchors that have no matching passage in the observation bank. When an observation-bank passage already names the right carrier for a criterion, copy that exact passages[].label verbatim into evidence.criterionEvidence[].anchor rather than paraphrasing.

============================================================
PART 1 — OBSERVATION BANK
============================================================

${buildObservationPrompt(style, medium)}

============================================================
PART 2 — EVIDENCE (depends on the observation bank above)
============================================================

${buildEvidencePrompt(style, medium)}

============================================================
PART 3 — ANCHOR REGIONS (depends on evidence above)
============================================================

${ANCHOR_REGION_RULES}

============================================================
RESPONSE FORMAT
============================================================
Return JSON only, with exactly { "observationBank": { ... }, "evidence": { ... }, "anchorRegions": [ ... ] }. Every evidence.criterionEvidence[].observationPassageId must match an id in observationBank.passages[].id, every evidence.criterionEvidence[].anchor that reuses an observation-bank passage must copy that passage's label verbatim, and anchorRegions must contain exactly one box per criterion in canonical order.`;
}
