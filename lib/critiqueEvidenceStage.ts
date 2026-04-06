import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import {
  EVIDENCE_STAGE_CLOSE_READING,
  EVIDENCE_STAGE_ASSESSMENT_PROTOCOL,
} from '../shared/critiqueVoiceA.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import {
  weakWorkCompositionGuidance,
  weakWorkEvidenceGuidance,
  weakWorkRepairExamples,
} from './critiqueWeakWorkContracts.js';

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

${EVIDENCE_STAGE_CLOSE_READING}

${EVIDENCE_STAGE_ASSESSMENT_PROTOCOL}

Observation-bank rules:
- Produce reusable, image-grounded notes rather than criterion-by-criterion criticism.
- Give every passage a stable id like "p1", "p2", or "p3". Later stages will reuse the passage by id and should be able to copy the label verbatim.
- Every passage must be pointable on the canvas. Prefer carrier grammar such as "[thing] against [thing]", "[thing] where it meets [thing]", "[thing] across [field]", "[thing] under [thing]", "[thing] above [thing]", or "[path/band] leading toward [thing]".
- Do not use summary labels such as "transition from flowers to background", "interaction of forms", "movement of the train", or "overall atmosphere". Name the pointable passage itself.
- At least one visibleFacts line for each passage must restate the same concrete nouns from that label and describe what is visibly happening there.
- Every visibleEvents entry must stay event-first: what narrows, widens, cuts, overlaps, aligns, tilts, bends, stacks, separates, stays lighter/darker, warmer/cooler, softer/harder, or lands against what.
- Every visibleEvents entry and intentCarriers entry must point back to one existing passage id and copy that passage label verbatim.
- Do not use scene-family labels, mood labels, or art-summary language as a substitute for a locatable passage.
- intentCarriers must still be physical passages on the canvas, not abstractions like "the mood", "the story", "the energy", or "the overall presence".
- Spread passages across the canvas and across kinds of evidence: value/light, color, edge/focus, space/drawing, and surface/medium.
- Keep the schema compact and reusable. Later stages will map these shared notes into the eight criteria.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

${mediumEvidenceGuardrails(medium)}

Return JSON only.`;
}

function buildEvidencePrompt(style: string, medium: string): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  const weakWorkRules = weakWorkEvidenceGuidance().map((rule) => `- ${rule}`).join('\n');
  const weakWorkCompositionRules = weakWorkCompositionGuidance().map((rule) => `- ${rule}`).join('\n');
  const weakWorkExamples = weakWorkRepairExamples().map((rule) => `- ${rule}`).join('\n');
  return `You are stage 1 of a painting critique system.

Your job is NOT to critique yet. Your job is only to extract visible evidence and tensions from the painting.

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
- Top-level evidence fields must follow the same rule. Do NOT open with flattering summaries like "whimsical charm", "idyllic rural life", "lively atmosphere", or artist-comparison praise unless the criterion evidence already supports that level of control.
- For weak work, write intentHypothesis, strongestVisibleQualities, and comparisonObservations in plain visual language first. Good: "The painting appears to organize the scene around a path, a small house, and bright flower bands." Bad: "The painting evokes whimsical charm and idyllic rural life."
- For strong work too, keep top-level fields visible and concrete first. Good: "The painting appears to organize the scene around a low sun, a dark boat, and a broken vertical reflection crossing the harbor water." Bad: "The painting captures a serene atmospheric moment in a characteristically impressionist way."
- comparisonObservations may be empty. If you include them, prefer formal visual comparisons without artist names. Good: "The image uses broken color, soft edge transitions, and a high horizon to keep the harbor read atmospheric rather than architectural." Bad: "This feels like Monet at his best."
- Generalization rule: do not solve the task by reaching for a memorized scene label. Solve it by reading concrete passages, relationships, and visual events in this specific painting. Scene-family examples in this prompt are examples of the required level of specificity, not a checklist of allowed subjects.
${weakWorkRules}
- For each criterion, pick ONE concrete anchor first: a locatable junction or passage such as "the jaw edge against the dark collar" or "the orange sleeve where it meets the blue-gray wall." Downstream stages will be forced to stay with that anchor, so do not use broad areas like "the background" or "the left side."
- For conceptual criteria such as Intent and necessity or Presence, point of view, and human force, the anchor must STILL be a physical carrier on the canvas: the passage that makes the intent or force legible.
- Preferred anchor grammar for conceptual criteria: a visible thing in relation to another visible thing or path, such as "[thing] against [thing]", "[thing] beside [thing]", "[thing] across [thing]", "[thing] under [thing]", "[thing] where it meets [thing]", or "[path/band] leading toward [thing]". The rule is not about approved nouns. The rule is whether a teacher could point to the carrier passage on the canvas.
- For Intent and necessity, prefer the passage that carries the painting's commitment or pressure, not just the strongest compositional device. A diagonal, horizon, pole row, or abstract overlap is only a valid anchor if the evidence explains why that exact passage carries the intent rather than merely organizing the picture.
- For Presence, point of view, and human force, prefer the passage that carries bodily pressure, viewpoint, or address. Do not default to a strong abstract shape, smoke trail, wave band, or telegraph-pole rhythm unless that passage is truly the visible carrier of force or presence.
- Avoid theme-only anchors such as "the overall mood", "the composition overall", "the story", "the movement", "the energy", or "the painting's emotional tone". Replace them with one locatable carrier passage.
- Anchor wording rule: the anchor must name visible things, not a flattering summary of them. Bad: "the arrangement of flowers in the foreground", "the cozy house amidst the vibrant garden", "the vibrant flowers flanking the path", "the narrative journey of the path". Better: "the path bend under the red house", "the red roof against the blue wash behind it", "the purple flower patch where it meets the path edge".
- If a shared observation-bank passage already names the right carrier, reuse that exact label verbatim as the anchor. Do not paraphrase it into a looser version like "transition from flowers to background" or "interaction of forms".
- Anchor-to-evidence alignment rule: for EACH criterion, at least one visibleEvidence line must explicitly reuse the same concrete nouns from the anchor so a validator can see that the evidence really supports that exact passage. Do not anchor to "the jaw edge against the dark collar" and then list only unrelated wall or window observations.

Edge / focus and surface / medium (avoid lazy defaults):
- **Edge and focus control:** Record **specific** reads: where hard vs soft edges sit, what wins first attention, lost-and-found, and whether blur or flattening might be **capture** (JPEG, motion, glare) vs **painted** ambiguity. If hierarchy is unclear only because the photo is soft, say so in tensionRead and lower **confidence** for this criterion—not a generic “edges need work” without zones.
- **Surface and medium handling:** Name **actual** mark behavior (direction, thickness, wet/dry, scumble, tooth, correction layers) visible in the image. The anchor must STILL name one locatable mark-bearing passage or boundary in the painting, not a medium label. Bad anchors: "brushwork", "paint handling", "surface quality", "the paint surface". Better anchors: "the wall hatching where it meets the smoother shirt passage", "the dry scumble across the cheek turning into the green shadow under the eye", "the loaded highlight stroke on the vase rim against the dark table." Do **not** down-rank this axis only because the photo hides fine texture; distinguish “cannot see handling in this capture” (confidence low / note in tensionRead) from “handling looks inconsistent on the canvas.”
- Photo limits belong in **photoQualityRead**; do not treat “small file / phone mush” as automatic proof that **both** edge and surface are a full band weaker than composition, value, color, drawing, intent, and presence unless the **visible canvas evidence** supports that.

Context:
- Declared style: ${style}
- Declared medium: ${medium}
- Benchmarks for what "Master" means in this style: ${benchmarks}

Criterion-specific four-band rubric for this style (use visible evidence and the stated band boundaries, not generic vibe):
${rubricBlock}

${mediumEvidenceGuardrails(medium)}

For each criterion, provide:
- observationPassageId: the chosen observation-bank passages[].id for this criterion. Prefer reusing one existing passage instead of inventing a paraphrased variant.
- anchor: one concrete, locatable passage or junction for this criterion. Make it specific enough that a teacher could point to the exact place on the canvas without ambiguity.
- anchor must copy the chosen observation-bank passage label verbatim when that passage genuinely fits the criterion. observationPassageId and anchor must point to the same source passage.
- anchor for conceptual criteria is still a physical passage, not a painting-wide abstraction. If the criterion is Intent and necessity or Presence, point of view, and human force, name the visible passage carrying that intent, mood, or address.
- anchor for Surface and medium handling is still a physical passage, not a material label. Name where the mark behavior is happening: a hatch field against a smoother passage, a loaded edge against a dry drag, a scumble over a darker underlayer.
- On weak landscapes or garden scenes, prefer object-pair or junction anchors over scene summaries: a path bend under a house, a roof edge against a sky wash, a flower patch meeting a path edge, a fence post against foliage, or smoke against sky.
- visibleEvidence: 4–8 junction-level observations (see schema). Each must name TWO identifiable things in the painting and describe the specific visual relationship between them (value break, color shift, edge event, spatial overlap, alignment). Stay inside the anchored passage and its immediate touching neighbors; do NOT tour unrelated areas of the canvas just to sound comprehensive. NEVER write area-level generalities like "the background is well-handled" or "some transitions could be smoother." Instead: "the clerk’s white cuff against the dark ledger creates a sharp value accent that draws the eye before the face does."
- visibleEvidence must support the anchor directly: at least one line must name that same passage again with the same concrete nouns, then describe what is visibly happening there.
- The FIRST visibleEvidence line must be that anchor-echo support line. Restate the same anchor passage and describe one visible event there before widening to nearby evidence.
- The SECOND visibleEvidence line should still stay on that same passage or on an immediately touching neighboring fact that shares the anchor nouns.
- For conceptual criteria, visibleEvidence lines must describe the visible event first, not just the interpretive effect. Bad: "the anchored passage creates atmosphere", "the anchored passage creates movement", or "the anchored passage creates presence." Better: say what narrows, bends, meets, overlaps, sits below, stays lighter/darker, or separates against what in that same passage.
- For conceptual criteria, at least one visibleEvidence line must explain why this passage is the carrier for that criterion instead of a nearby structural passage. Example shape: "the head against the wall stays darker/lighter than the shirt below it, so the pressure stays centered there instead of dropping into the torso."
- For Composition and shape structure, at least TWO visibleEvidence lines must use structural-event language such as "narrows", "widens", "cuts", "leaves a gap", "stacks", "overlaps", "aligns", or "tilts" while naming the concrete forms involved.
- On weak or developing work, generic summaries are worse than blunt accuracy. If a visibleEvidence line could fit many landscape paintings by swapping one noun, it is too vague and must be rewritten.
- Do not fall back to product summaries, psychology summaries, or motion summaries like "the object feels elegant", "the figure has personality", or "the scene creates movement". Keep every line at passage level: what edge, overlap, alignment, tilt, band, or mark is doing what against its neighbor.
- For Composition and shape structure, do NOT rely on stock composition talk such as "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact structural passage producing that effect.
- For Composition and shape structure on ANY work, name structure as a visible event between forms, not as a verdict. Good: "the reflection cuts down through the horizontal harbor bands", "the boat silhouette sits left of the reflection and leaves a wider water field on one side", "the masts echo the reflection as thinner verticals above the horizon." Bad: "the reflection organizes the composition", "the boat creates balance", "the horizon adds depth."
- For Composition and shape structure on any subject, use event language too. Good: "the upper edge lands just behind the darker shape and leaves a thinner strip above it." Bad: "the form is centered", "the passage is well-balanced", or "the edge creates strong structure."
- On abstract, simplified, or object-led work, do NOT stop at phrases like "layered structure", "adds complexity", "creates movement", "grounds the composition", or "provides a base." Write the exact event instead: which block overlaps which, which band cuts which field, which shape leaves a thinner strip, or which object sits under or beside the next one.
- On still life or object-study passages, avoid filler like "the dark shapes support the banana" or "the overlap creates a layered effect." Replace it with the pointable event: what the banana covers, where the bottle neck narrows under the pump head, or how one object leaves a wider side space than the other.
- For Intent and necessity or Presence, point of view, and human force on abstract or still-life work, do NOT use focal-summary evidence like "draws attention", "suggests importance", or "becomes the focal point" as a substitute for the carrier event. Name what contrast, overlap, compression, or placement makes that passage carry the force.
${weakWorkCompositionRules}
- strengthRead: name the specific passage and relationship that works for this criterion. Not "good value structure" but "the progression from the bright foreground shirts through the mid-tone desks to the dim back wall creates a clear three-plane depth stack."
- strengthRead may interpret what the anchored passage accomplishes, but it still must name that same passage directly. visibleEvidence cannot stop at "creates focus", "creates movement", or "creates atmosphere" without first describing the visible event causing that read.
- For conceptual criteria, strengthRead and preserve should preferably reuse the anchor nouns directly. Do not switch to theme words like "warmth", "presence", "energy", or "story" if the concrete carrier passage is what actually supports the read.
- For Intent and necessity or Presence, strengthRead and preserve must still name the same visible carrier passage. Do NOT write "preserve the narrative journey", "preserve the inviting warmth", or "preserve the sense of life". Name the actual passage instead.
- If a conceptual criterion reuses the same anchor as Composition and shape structure, make sure the conceptual lines justify why that same passage carries intent or presence, not merely structure. If you cannot do that concretely, choose a different anchor.
- tensionRead: name what is genuinely unresolved and WHERE. If nothing is truly unresolved, say "This criterion reads resolved at the level the painting is working at" rather than manufacturing a problem. Forced tensions produce bad downstream advice.
- preserve: name the specific relationship that must survive revision—the passage and the visual event, not an abstract quality.
- confidence: high / medium / low

Weak-work examples:
${weakWorkExamples}

Return JSON only.`;
}

export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildEvidencePrompt(style, medium);
}

export function buildObservationStagePrompt(style: string, medium: string): string {
  return buildObservationPrompt(style, medium);
}
