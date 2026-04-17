import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import {
  EVIDENCE_STAGE_CLOSE_READING,
  EVIDENCE_STAGE_ASSESSMENT_PROTOCOL,
} from '../shared/critiqueVoiceA.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import {
  weakWorkCompositionGuidance,
  weakWorkEvidenceGuidance,
} from './critiqueWeakWorkContracts.js';
import {
  EVIDENCE_RICHNESS_GUIDANCE,
  OBSERVATION_BANK_DEPTH_GUIDANCE,
  PIPELINE_STAGE_CONNECTION,
} from './critiquePipelineGuidance.js';

function isStyleKey(s: string): s is StyleKey {
  return Object.prototype.hasOwnProperty.call(ARTISTS_BY_STYLE, s);
}

function mediumEvidenceGuardrails(medium: string): string {
  switch (medium) {
    case 'Drawing':
      return `Medium-specific evidence rules for Drawing:
- Treat "color relationships" as value harmony, paper tone, and mark-family relationships unless actual color media is clearly present.
- Do not assume the correction is to add hue, chroma, or richer color.
- Pay extra attention to line weight, pressure, erasure, proportion, edge hierarchy, and value grouping.`;
    case 'Watercolor':
      return `Medium-specific evidence rules for Watercolor:
- Notice transparency, paper reserve, wet-into-wet diffusion, hard-vs-soft edges, blooms/backruns, and whether washes stay clean.
- Do not treat softness or luminous paper as automatic weakness.
- Record if a passage would be damaged by overworking or opaque repainting.`;
    case 'Pastel':
      return `Medium-specific evidence rules for Pastel:
- Notice tooth, layering, broken color, soft transitions, pressure changes, and whether the surface stays breathable.
- Do not assume the correction is a watery wash, glazing logic, or slick blending everywhere.
- Record whether softness and dust-like vibration are functioning as strengths.`;
    case 'Acrylic':
      return `Medium-specific evidence rules for Acrylic:
- Notice flat opaque passages, quick-drying edge decisions, layered corrections, and whether the surface stays crisp or deadened.
- Do not assume oil-like blending time or softness if the paint is intentionally sharper and flatter.`;
    case 'Oil on Canvas':
      return `Medium-specific evidence rules for Oil on Canvas:
- Notice massing, scumble, glaze/opaque contrast, edge drag, brush direction, and whether reworking has enriched or dulled the surface.
- Do not treat painterly texture, drag, or broken passages as problems unless they clearly weaken the read.`;
    default:
      return `Medium-specific evidence rules:
- Let the declared medium change what counts as control, finish, softness, and correction.
- Do not recommend solutions that fight the medium's natural strengths.`;
  }
}

function buildObservationPrompt(style: string, medium: string): string {
  return `You are stage 0 of a painting critique system.

Your job is NOT to critique and NOT to rate criteria. Your job is to build one compact observation bank that later stages can reuse.

Never name specific artists, famous artworks, or art-historical figures. Describe only what is visible in this photograph.

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

Observation-bank rules:
- Produce reusable, image-grounded notes rather than criterion-by-criterion criticism.
- Give every passage a stable id like "p1", "p2", or "p3". Later stages will reuse the passage by id and should be able to copy the label verbatim.
- Every passage must be pointable on the canvas. Prefer carrier grammar such as "[thing] against [thing]", "[thing] where it meets [thing]", "[thing] across [field]", "[thing] under [thing]", "[thing] above [thing]", or "[path/band] leading toward [thing]".
- Do not use summary labels such as "transition between areas", "interaction of forms", "overall movement", or "overall atmosphere". Name the pointable passage itself.
- At least one visibleFacts line for each passage must restate the same concrete nouns from that label and describe what is visibly happening there.
- Every visibleEvents entry must stay event-first: what narrows, widens, cuts, overlaps, aligns, tilts, bends, stacks, separates, stays lighter/darker, warmer/cooler, softer/harder, or lands against what.
- Every visibleEvents entry and intentCarriers entry must point back to one existing passage id and copy that passage label verbatim.
- Do not use scene-family labels, mood labels, or art-summary language as a substitute for a locatable passage.
- intentCarriers must still be physical passages on the canvas, not abstractions like "the mood", "the story", "the energy", or "the overall presence".
- intentCarriers are not just any interesting passages. They must be the best candidate carriers for conceptual criteria later. Prefer passages where pressure, address, contact, vulnerability, insistence, or bodily/viewpoint force stays visible in the passage itself.
- If two passages are available, rank the more direct carrier ahead of the more structural one. A passage that only proves speed, balance, depth, rhythm, or movement is weaker than a passage where a form presses against, cuts into, or holds against another visible thing.
- Do not rank rhythm-only, horizon-only, scaffold-only, or route-only summaries above a more direct pressure-bearing passage.
- Do not use "focal point" logic as the reason by itself. Prefer the passage where overlap, compression, contrast, contact, or placement actually makes the force stay.
- Keep intentCarriers ordered best-first. Put the strongest direct carrier first, the next-best second, and so on.
- Spread passages across the canvas and across kinds of evidence: value/light, color, edge/focus, space/drawing, and surface/medium.
- Keep the schema compact and reusable. Later stages will map these shared notes into the eight criteria.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

${mediumEvidenceGuardrails(medium)}

${OBSERVATION_BANK_DEPTH_GUIDANCE}

Return JSON only.`;
}

function buildEvidencePrompt(style: string, medium: string): string {
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  const weakWorkRules = weakWorkEvidenceGuidance().map((rule) => `- ${rule}`).join('\n');
  const weakWorkCompositionRules = weakWorkCompositionGuidance().map((rule) => `- ${rule}`).join('\n');
  return `You are stage 1 of a painting critique system.

Your job is NOT to critique yet. Your job is only to extract visible evidence and tensions from the painting.

Never name specific artists, famous artworks, or art-historical figures; do not compare this image to named painters or movements.

${PIPELINE_STAGE_CONNECTION}

The user message will include a shared observation bank already grounded in the image. Reuse those passages and relations wherever they genuinely fit; do NOT invent eight fresh mini-scenes when the observation bank already gives you a usable passage.
If one observation-bank passage fits a criterion, copy that exact passages[].label verbatim as the anchor instead of paraphrasing it into a nearby summary.

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

Rules:
- Stay at the level of evidence, tensions, and what should be preserved.
- Do not prescribe fixes.
- Do not invent weaknesses just because the painting could be different.
- If a painting is already strong in a criterion, say so plainly.
- Do not confuse childlike, novice, or underdeveloped work with successful stylization just because the image is bold, simplified, distorted, or high-contrast.
- If simplification, distortion, or symbolic mark-making seem present, distinguish clearly between (a) deliberate, controlled stylization and (b) rudimentary or inconsistent execution.
- If attention is distributed, atmospheric, or intentionally open, describe that as a condition of the work instead of forcing a single focal demand.
- If value compression, softness, or ambiguity seem intentional and useful, record that instead of treating it automatically as a flaw.
- completionRead: judge whether the work looks unfinished (open passages, raw substrate, uneven resolution, obvious block-in), likely_finished (consistent finish, resolved edges, presentation-ready read), or uncertain. Base this only on visible cues in the photo. Do not equate "unfinished" with "bad."
- Be conservative with praise from a single photo: balanced composition, pleasant color, or competent finish alone are not proof of exceptional control.
- If something reads strong but not exceptional, say it reads strong.
- If the work is convincing overall, still look for the one or two relationships that remain least resolved instead of defaulting to perfection.
- If the work looks weak, naive, or student-level, become MORE specific, not more charitable. Do not hide behind painting-level summaries like "the sky creates atmosphere", "the figure suggests contemplation", or "the brushwork adds texture." Name the exact junction, object pair, edge break, color collision, or mark bundle that makes you say it.
- On strong or masterwork-level paintings, stay just as concrete. Do NOT replace evidence with verdict phrases like "organizes the composition", "creates a focal point", "harmonious balance", "dynamic tension", or "impressionistic atmosphere" unless the same sentence also names the exact passage and visible difference producing that read.
- Top-level evidence fields must follow the same rule. Do NOT open with flattering summaries, atmosphere claims, or artist-comparison praise unless the criterion evidence already supports that level of control.
- For weak work, write intentHypothesis, strongestVisibleQualities, and comparisonObservations in plain visual language first.
- For strong work too, keep top-level fields visible and concrete first.
- comparisonObservations may be empty. If you include them, prefer formal visual comparisons without artist names.
- Generalization rule: do not solve the task by reaching for a memorized scene label. Solve it by reading concrete passages, relationships, and visual events in this specific painting.
${weakWorkRules}
- For each criterion, pick ONE concrete anchor first: a locatable junction or passage. Downstream stages will be forced to stay with that anchor, so do not use broad areas like "the background" or "the left side."
- For conceptual criteria such as Intent and necessity or Presence, point of view, and human force, the anchor must STILL be a physical carrier on the canvas: the passage that makes the intent or force legible.
- Preferred anchor grammar for conceptual criteria: a visible thing in relation to another visible thing or path, such as "[thing] against [thing]", "[thing] beside [thing]", "[thing] across [thing]", "[thing] under [thing]", "[thing] where it meets [thing]", or "[path/band] leading toward [thing]". The rule is not about approved nouns. The rule is whether a teacher could point to the carrier passage on the canvas.
- For Intent and necessity, prefer the passage that carries the painting's commitment or pressure, not just the strongest compositional device. A diagonal, horizon, pole row, or abstract overlap is only a valid anchor if the evidence explains why that exact passage carries the intent rather than merely organizing the picture.
- For Presence, point of view, and human force, prefer the passage that carries bodily pressure, viewpoint, or address. Do not default to a strong abstract shape, trailing mark, repeated rhythm, or banded structure unless that passage is truly the visible carrier of force or presence.
- Avoid theme-only anchors such as "the overall mood", "the composition overall", "the story", "the movement", "the energy", or "the painting's emotional tone". Replace them with one locatable carrier passage.
- Anchor wording rule: the anchor must name visible things, not a flattering summary of them.
- **Anchor grammar rule (important for downstream rendering):** the anchor must be a *noun phrase* that names a location on the canvas, not a predicate or mini-sentence describing a pose, action, or state. Downstream prose writes "In [anchor], …" and "the color relationships in [anchor] stay cohesive", so the anchor must grammatically fit after "in". Correct: "the foreground figure and the vine-covered field behind it", "the jaw edge where it meets the shadow side", "the lower-left diagonal band". Incorrect (predicate-shaped — do NOT use): "the figure's hands resting on the chair", "the jacket draped over the armrest", "the horizon stretching across the canvas". Put pose, action, or state into visibleEvidence lines, not into the anchor.
- If a shared observation-bank passage already names the right carrier, reuse that exact label verbatim as the anchor. Do not paraphrase it into a looser summary.
- Anchor-to-evidence alignment rule: for EACH criterion, at least one visibleEvidence line must explicitly reuse the same concrete nouns from the anchor so a validator can see that the evidence really supports that exact passage.

Edge / focus and surface / medium (avoid lazy defaults):
- **Edge and focus control:** Record **specific** reads: where hard vs soft edges sit, what wins first attention, lost-and-found, and whether blur or flattening might be **capture** (JPEG, motion, glare) vs **painted** ambiguity. If hierarchy is unclear only because the photo is soft, say so in tensionRead and lower **confidence** for this criterion—not a generic “edges need work” without zones.
- **Surface and medium handling:** Name **actual** mark behavior (direction, thickness, wet/dry, scumble, tooth, correction layers) visible in the image. The anchor must STILL name one locatable mark-bearing passage or boundary in the painting, not a medium label. Do **not** down-rank this axis only because the photo hides fine texture; distinguish “cannot see handling in this capture” (confidence low / note in tensionRead) from “handling looks inconsistent on the canvas.”
- Photo limits belong in **photoQualityRead**; do not treat “small file / phone mush” as automatic proof that **both** edge and surface are a full band weaker than composition, value, color, drawing, intent, and presence unless the **visible canvas evidence** supports that.

Context:
- Declared style: ${style}
- Declared medium: ${medium}
- Use the rubric bands below for what "Master" means in this declared style—without naming or comparing to any artist.

Criterion-specific four-band rubric for this style (use visible evidence and the stated band boundaries, not generic vibe):
${rubricBlock}

${mediumEvidenceGuardrails(medium)}

${EVIDENCE_RICHNESS_GUIDANCE}

For each criterion, provide:
- observationPassageId: the chosen observation-bank passages[].id for this criterion. Prefer reusing one existing passage instead of inventing a paraphrased variant.
- anchor: one concrete, locatable passage or junction for this criterion. Make it specific enough that a teacher could point to the exact place on the canvas without ambiguity.
- anchor must copy the chosen observation-bank passage label verbatim when that passage genuinely fits the criterion. observationPassageId and anchor must point to the same source passage.
- anchor for conceptual criteria is still a physical passage, not a painting-wide abstraction. If the criterion is Intent and necessity or Presence, point of view, and human force, name the visible passage carrying that intent, mood, or address.
- anchor for Surface and medium handling is still a physical passage, not a material label. Name where the mark behavior is happening: a hatch field against a smoother passage, a loaded edge against a dry drag, a scumble over a darker underlayer.
- Prefer object-pair or junction anchors over scene summaries: a band under a block, an edge against a wash, a clustered patch meeting a lighter strip, a vertical mark against a field, or a broken trail against the zone behind it.
- visibleEvidence: 4–8 junction-level observations (see schema). Each must name TWO identifiable things in the painting and describe the specific visual relationship between them (value break, color shift, edge event, spatial overlap, alignment). Stay inside the anchored passage and its immediate touching neighbors; do NOT tour unrelated areas of the canvas just to sound comprehensive. NEVER write area-level generalities.
- visibleEvidence must support the anchor directly: at least one line must name that same passage again with the same concrete nouns, then describe what is visibly happening there.
- The FIRST visibleEvidence line must be that anchor-echo support line. Restate the same anchor passage and describe one visible event there before widening to nearby evidence.
- The SECOND visibleEvidence line should still stay on that same passage or on an immediately touching neighboring fact that shares the anchor nouns.
- For conceptual criteria, visibleEvidence lines must describe the visible event first, not just the interpretive effect. State what narrows, bends, meets, overlaps, sits below, stays lighter/darker, or separates against what in that same passage.
- For conceptual criteria, at least one visibleEvidence line must explain why this passage is the carrier for that criterion instead of a nearby structural passage.
- For Composition and shape structure, at least TWO visibleEvidence lines must use structural-event language such as "narrows", "widens", "cuts", "leaves a gap", "stacks", "overlaps", "aligns", or "tilts" while naming the concrete forms involved.
- On weak or developing work, generic summaries are worse than blunt accuracy. If a visibleEvidence line could fit many landscape paintings by swapping one noun, it is too vague and must be rewritten.
- Do not fall back to product summaries, psychology summaries, or motion summaries like "the object feels elegant", "the figure has personality", or "the scene creates movement". Keep every line at passage level: what edge, overlap, alignment, tilt, band, or mark is doing what against its neighbor.
- For Composition and shape structure, do NOT rely on stock composition talk such as "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact structural passage producing that effect.
- For Composition and shape structure on ANY work, name structure as a visible event between forms, not as a verdict.
- For Composition and shape structure on any subject, use event language too.
- On abstract, simplified, or object-led work, do NOT stop at phrases like "layered structure", "adds complexity", "creates movement", "grounds the composition", or "provides a base." Write the exact event instead: which block overlaps which, which band cuts which field, which shape leaves a thinner strip, or which object sits under or beside the next one.
- On object-led passages, avoid filler like "the darker shape supports the lighter one" or "the overlap creates a layered effect." Replace it with the pointable event: what one shape covers, where one form narrows under another, or how one object leaves a wider side space than the other.
- For Intent and necessity or Presence, point of view, and human force on abstract or still-life work, do NOT use focal-summary evidence like "draws attention", "suggests importance", or "becomes the focal point" as a substitute for the carrier event. Name what contrast, overlap, compression, or placement makes that passage carry the force.
${weakWorkCompositionRules}
- strengthRead: name the specific passage and relationship that works for this criterion.
- strengthRead may interpret what the anchored passage accomplishes, but it still must name that same passage directly. visibleEvidence cannot stop at "creates focus", "creates movement", or "creates atmosphere" without first describing the visible event causing that read.
- For conceptual criteria, strengthRead and preserve should preferably reuse the anchor nouns directly. Do not switch to theme words like "warmth", "presence", "energy", or "story" if the concrete carrier passage is what actually supports the read.
- For Intent and necessity or Presence, strengthRead and preserve must still name the same visible carrier passage. Do NOT write "preserve the narrative journey", "preserve the atmosphere", or "preserve the sense of life". Name the actual passage instead.
- If a conceptual criterion reuses the same anchor as Composition and shape structure, make sure the conceptual lines justify why that same passage carries intent or presence, not merely structure. If you cannot do that concretely, choose a different anchor.
- tensionRead: name what is genuinely unresolved and WHERE. If nothing is truly unresolved, say the criterion reads resolved at the level the painting is working at rather than manufacturing a problem. Forced tensions produce bad downstream advice.
- preserve: name the specific relationship that must survive revision—the passage and the visual event, not an abstract quality.
- confidence: high / medium / low

Return JSON only.`;
}

export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildEvidencePrompt(style, medium);
}

/**
 * Anchor-region rules used by the vision stage (Merge C). Lifted from the
 * deprecated `critiqueAnchorRegionRefine` system prompt so the model that
 * produces evidence anchors can also localise them in the same call. Kept as
 * a separate constant so any future region tooling can reuse the exact same
 * rules without import cycles.
 */
const ANCHOR_REGION_RULES = `Anchor-region rules (for "anchorRegions" in the response):
- Output normalized axis-aligned bounding boxes (x, y, width, height) in **0–1 coordinates relative to the full image** (x=0 left, y=0 top, width/height as fractions of image width/height).
- The "anchorRegions" array must have exactly one entry per criterion, in the SAME canonical order as evidence.criterionEvidence. Each entry has { "criterion": "<criterion name>", "region": { x, y, width, height } }.
- Each box must **contain the visible motifs** named by that criterion's evidence anchor (areaSummary + the visibleEvidence lines that echo it)—not empty sky, random background, or a different object.
- **Tight fit**: most pixels inside each box should belong to that passage—**except** when the anchor names a **broad horizontal band** (see below), where width should span the scene even if that admits some adjacent pixels at the edges.
- **Vertical cues**: "foreground", "tables", "figures seated", "umbrellas", "path", "stairs", "bridge", "railing", "near the bottom" → box must extend **toward the bottom** of the frame (larger y + height). "Sky", "upper canopy only", "distant treetops" → box sits **higher**.
- **Horizontal boundaries / junctions** (phrases like *where X meets Y*, *X meeting Y*, *horizon*, *shoreline*, *waterline*, *edge of the sea*, *sea and sky*): the box must **straddle that boundary**. Include pixels **on both sides** of the line so the **actual dividing line** lies **inside** the rectangle. Do **not** place the box entirely in the sky when the text names the sea, the horizon, or both sides of a color break at the horizon—**center the band vertically on that line** and use enough height (often ~0.06–0.18 of image height) to capture the transition.
- **Small scattered motifs** (flocks, distant birds, boats, figures, buoys, posts): find **every** instance that matches the description in the relevant band of the image; the box must be the **smallest axis-aligned rectangle that contains all of them**. A box that only covers empty sky while the described marks sit **outside** it is wrong. If marks sit in a cluster, center on the cluster, not on an unrelated patch of sky.
- **Contrast pairs** (*A against B*, *A on B*): include **both** A and the adjacent B so the relationship is visible—often extend the box to span from the objects through the background they contrast with.
- **Named object + secondary context** (*X under the sky*, *X against the horizon*, *distant X*, *small X in the field*): **locate X first**. The box must contain the **named structure or mass** (building, house, boat, figure, etc.), not only the sky, trees, or haze around it. After X is included, you may add a modest band of the named context (sky, hill) so the relationship reads—**never** return a box that lies entirely in empty sky or generic background while the named X sits **outside** the rectangle.
- **Object-first rule:** when the anchor names a specific object plus a relation or surrounding context, the **named object itself** is the required center of the box. First locate that object; only then widen enough to show the relation. A similar nearby edge, silhouette, or brightness pattern does **not** count unless the named object is actually inside the box.
- **Anchor hierarchy rule:** if the anchor contains both an object noun and a relational phrase, the object noun has priority. The relation helps define the crop, but it does not replace the requirement to include the named object.
- **Specific noun priority:** when the anchor includes one specific object plus broader location context, prioritize the **most specific named object or passage** first and treat the surrounding phrase as location context only. Example pattern: in "the small boat under the bridge", prioritize **boat** first and **under the bridge** second.
- **Text / sign / lettering rule:** if the anchor names a sign, quoted word, letters, numbers, label, banner, poster, painted text, or any text-bearing object, the box must center on the **actual text-bearing object itself**. Do **not** substitute a nearby doorway, window, porch light, bright ornament, or other more salient feature in the same area.
- **No proxy-object substitution:** do **not** replace the named object with a nearby object just because it is brighter, larger, more central, or easier to see. A nearby glow is not a sign; a skirt fold is not a hand; a torso highlight is not a shoulder passage.
- **Small-target rule:** if the anchor names a small object or local passage (hand, cup rim, earring, sign, candle, eye, small window, lettered decoration, small boat, etc.), prefer a **tight local box** around that object rather than a medium box centered on the surrounding body, building, or room.
- **Plural repeated elements** (*posts*, *rails*, *pickets*, *figures*, *windows*, *boats*): when several clear repeats appear **along a line** (a row in the foreground, a fence, a pier), treat the passage as the **group**: widen (or lengthen) the box so **multiple** repeats are inside—not a single instance on one edge unless only one is visible.
- **Wide horizontal bands** (*sky above…*, *cloud band*, *treeline against sky*, *ridge across the top*): when the text names a **layer** that spans the composition, the box should cover **most of the image width** (typically **width ≥ 0.55** unless the motif is clearly localized to one side). Avoid a small corner crop that could be any patch of sky.
- **Named colors/objects**: if the text names specific colors or objects, the box must include **those** visible elements.
- **Groups of people**: if the text names multiple figures at a table, include **all** of them in one box.
- **Diagonal structures** (bridge, path): use an **elongated** box along the structure, not a small centered square that misses it.
- If a passage is ambiguous, choose the **most literal** reading that matches the nouns in the anchor text.`;

/**
 * Merge A + Merge C: produce the observation bank, the evidence object, AND
 * per-criterion anchor regions in a single vision call. Concatenating the
 * prompts gives the model the full set of rules it needs to:
 *
 *   1. Build a reusable observation bank with stable passage ids.
 *   2. Reuse those passages to anchor per-criterion evidence.
 *   3. Locate each evidence anchor in the photograph with a normalized box.
 *
 * Doing all three in one call removes the cross-call drift where a downstream
 * stage could pick paraphrased anchors or boxes that disagreed with the
 * evidence, and saves two full vision round-trips.
 *
 * The response shape is:
 *
 *   { observationBank: { ... }, evidence: { ... }, anchorRegions: [ ... ] }
 *
 * which is validated by `visionStageResultSchema`.
 */
export function buildVisionStagePrompt(style: string, medium: string): string {
  return `You are the unified vision-reading stage of a painting critique system. You produce THREE things in ONE JSON response: a reusable observation bank, the evidence object that depends on it, and one normalized bounding box per criterion locating each evidence anchor in the photograph.

The response MUST have exactly these top-level keys:
  - "observationBank": follows the observation-bank schema and rules below.
  - "evidence": follows the evidence schema and rules below, and ALL evidence.criterionEvidence[].observationPassageId values MUST refer to ids that exist in observationBank.passages[].id.
  - "anchorRegions": an array of exactly eight { criterion, region } entries, one per criterion in the SAME order as evidence.criterionEvidence, each box tightly covering the visible passage named by that criterion's evidence anchor.

Build the observation bank first (mentally), then build evidence that reuses those exact passages by id, then locate each criterion's evidence anchor in the actual photograph as a normalized box. Do NOT invent evidence anchors that have no matching passage in the observation bank. When an observation-bank passage already names the right carrier for a criterion, copy that exact passages[].label verbatim into evidence.criterionEvidence[].anchor instead of paraphrasing.

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
Return JSON only, with exactly { "observationBank": { ... }, "evidence": { ... }, "anchorRegions": [ ... ] }. Each section must follow its respective schema and rules above. Every evidence.criterionEvidence[].observationPassageId must match an id in observationBank.passages[].id, every evidence.criterionEvidence[].anchor that reuses an observation-bank passage must copy that passage's label verbatim, and the anchorRegions array must contain exactly one box per criterion in canonical order.`;
}
