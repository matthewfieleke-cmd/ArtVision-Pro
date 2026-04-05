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
- For conceptual criteria such as Intent and necessity or Presence, point of view, and human force, the anchor must STILL be a physical carrier on the canvas: the passage that makes the intent or force legible. Good: "the red path narrowing toward the dark shed opening" or "the sitter's downturned face against the flat green wall." Bad: "the overall mood", "the composition overall", "the story", or "the painting's emotional tone."
- Preferred anchor grammar for conceptual criteria: a visible thing in relation to another visible thing or path, such as "[object] against [object]", "[object] beside [object]", "[object] across [object]", "[object] under [object]", "[object] where it meets [object]", or "[path] leading to [object]". The rule is not about approved nouns. The rule is whether a teacher could point to the carrier passage on the canvas.
- On figure-in-landscape paintings, Presence and Intent still need one physical carrier, not a scenic summary. Good: "the small seated figure against the pale shore", "the dark figure beside the leaning tree trunk", or "the figure's hat against the bright water." Bad: "the figures interacting with the landscape", "a narrative moment by the sea", or "human presence in nature."
- On figure-led interiors or portraits, Presence and Intent still need one physical carrier passage, not a psychology label. Good: "the shoulder edge against the pillow", "the head against the dark wall", or "the forearm across the white sheet." Bad: "the dramatic pose", "the sitter's emotion", "the figure's personality", or "the contemplative mood."
- On train-led or industry-led scenes, Presence and Intent still need one physical carrier passage, not a motion summary. Good: "the engine against the pale sky", "the train across the ground bands", "the smoke trail above the roofline", or "the leaning telegraph poles beside the train." Bad: "the train's movement", "the momentum of the scene", "industrial energy", or "dramatic speed."
- On object studies and still lifes, Presence and Intent still need a physical carrier passage, not a product summary or theme label. Good: "the pump head against the bottle neck", "the floral label on the glass bottle", or "the red door under the lit window." Bad: "the elegance of the object", "the festive house", "the decorated bottle", or "the holiday mood."
- On house, facade, or holiday-light scenes, Presence and Intent still need a physical carrier passage, not a seasonal summary. Good: "the red door under the lit window", "the lit window against the dark facade", or "the roofline above the window stack." Bad: "the welcoming house", "the festive mood", "the holiday atmosphere", or "the warmth inside."
- For weak landscapes, do not rely on vague scene labels for Intent or Presence. If you use a route carrier such as "the path leading to the house", the evidence must still state what that path is visibly doing where it narrows, bends, meets the doorway, or separates against nearby shapes.
- For cafe or street scenes, avoid pure scene labels like "the outdoor seating area" or "the cafe atmosphere". Use a visible carrier instead, such as tables, umbrellas, arches, figures, or a path relation that is described concretely.
- Anchor wording rule: the anchor must name visible things, not a flattering summary of them. Bad: "the arrangement of flowers in the foreground", "the cozy house amidst the vibrant garden", "the vibrant flowers flanking the path", "the narrative journey of the path". Better: "the path bend under the red house", "the red roof against the blue wash behind it", "the purple flower patch where it meets the path edge".
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
- anchor: one concrete, locatable passage or junction for this criterion. Make it specific enough that a teacher could point to the exact place on the canvas without ambiguity.
- anchor for conceptual criteria is still a physical passage, not a painting-wide abstraction. If the criterion is Intent and necessity or Presence, point of view, and human force, name the visible passage carrying that intent, mood, or address.
- anchor for Surface and medium handling is still a physical passage, not a material label. Name where the mark behavior is happening: a hatch field against a smoother passage, a loaded edge against a dry drag, a scumble over a darker underlayer.
- On weak landscapes or garden scenes, prefer object-pair or junction anchors over scene summaries: a path bend under a house, a roof edge against a sky wash, a flower patch meeting a path edge, a fence post against foliage, or smoke against sky.
- visibleEvidence: 4–8 junction-level observations (see schema). Each must name TWO identifiable things in the painting and describe the specific visual relationship between them (value break, color shift, edge event, spatial overlap, alignment). Cover different areas of the canvas across the list when possible. NEVER write area-level generalities like "the background is well-handled" or "some transitions could be smoother." Instead: "the clerk’s white cuff against the dark ledger creates a sharp value accent that draws the eye before the face does."
- visibleEvidence must support the anchor directly: at least one line must name that same passage again with the same concrete nouns, then describe what is visibly happening there.
- For conceptual criteria, visibleEvidence lines must describe the visible event first, not just the interpretive effect. Bad: "the path leading to the house creates a directional flow" or "the red door under the lit window creates a welcoming mood." Better: "the path leading to the house narrows before the doorway and stays lighter than the flower patch beside it" or "the red door under the lit window stays warmer than the snow band around it and sits below the brightest window stack."
- For Composition and shape structure, at least TWO visibleEvidence lines must use structural-event language such as "narrows", "widens", "cuts", "leaves a gap", "stacks", "overlaps", "aligns", or "tilts" while naming the concrete forms involved.
- On weak or developing work, generic summaries are worse than blunt accuracy. If a visibleEvidence line could fit many landscape paintings by swapping one noun, it is too vague and must be rewritten.
- For object studies, building facades, and other non-figure subjects, do not fall back to product-summary wording like "the object feels elegant", "the house feels festive", "the bottle is centered", or "the form is well-defined." Keep the line at passage level: what edge, overlap, alignment, tilt, window stack, roofline, pump, label, or base is doing what against its neighbor.
- For figure-led interiors or portraits, do not fall back to psychology-summary wording like "the figure feels emotional", "the pose creates drama", or "the sitter has personality." Keep the line at passage level: what shoulder, head, forearm, pillow, wall, sheet, or chair passage is doing what against its neighbor.
- For train-led scenes, do not fall back to motion-summary wording like "the train creates movement", "the engine feels dramatic", or "the poles create rhythm." Keep the line at passage level: what engine, smoke, pole, track, roofline, or ground band cuts, leans, repeats, or separates against its neighbor.
- For Composition and shape structure on weak landscapes, do NOT rely on stock composition talk such as "balanced composition", "dynamic tension", "guides the eye", or "adds interest" unless the same sentence names the exact structural passage producing that effect.
- For Composition and shape structure on cafe or street scenes, do NOT rely on summaries like "the path guides the eye", "the tables create rhythm", or "the umbrellas create a focal point" unless the same sentence names the exact path/table/arch passage and the visible difference it produces.
- For Composition and shape structure on figure-led or train-led scenes, do NOT rely on summaries like "the pose adds drama", "the figure creates presence", "the train creates movement", or "the poles create rhythm" unless the same sentence names the exact shoulder/chair/engine/pole passage and the visible difference it produces.
- For Composition and shape structure on ANY work, name structure as a visible event between forms, not as a verdict. Good: "the reflection cuts down through the horizontal harbor bands", "the boat silhouette sits left of the reflection and leaves a wider water field on one side", "the masts echo the reflection as thinner verticals above the horizon." Bad: "the reflection organizes the composition", "the boat creates balance", "the horizon adds depth."
- For Composition and shape structure on object studies or architecture, use event language too. Good: "the pump head sits slightly left of the bottle centerline and leaves a wider shoulder on one side", "the roofline steps down into the window stack", or "the bottle base lands on the table line and leaves a thinner shadow on the right than on the left." Bad: "the bottle is centered", "the house is well-proportioned", or "the roof creates a strong structure."
${weakWorkCompositionRules}
- strengthRead: name the specific passage and relationship that works for this criterion. Not "good value structure" but "the progression from the bright foreground shirts through the mid-tone desks to the dim back wall creates a clear three-plane depth stack."
- strengthRead may interpret what the anchored passage accomplishes, but it still must name that same passage directly. visibleEvidence cannot stop at "creates focus", "creates movement", or "creates atmosphere" without first describing the visible event causing that read.
- For conceptual criteria, strengthRead and preserve should preferably reuse the anchor nouns directly. If the anchor is "the red door under the lit window", strengthRead and preserve should still say "the red door under the lit window", not switch to theme words like "warmth", "presence", or "festive mood."
- For Intent and necessity or Presence on weak landscapes, strengthRead and preserve must still name the same visible carrier passage. Do NOT write "preserve the narrative journey", "preserve the inviting warmth", or "preserve the sense of life". Name the path bend, smoke-against-sky, roof-against-wash, or other concrete carrier instead.
- For figure-in-landscape Presence, strengthRead and preserve must keep naming the same physical carrier passage. Do NOT write "the figures add narrative", "the scene feels contemplative", or "human presence enlivens the setting" unless the same sentence also names the exact figure-against-ground relationship carrying that read.
- For figure-led interiors or portraits, strengthRead and preserve must keep naming the same physical carrier passage. Do NOT write "the pose creates emotion", "the sitter has personality", or "the figure feels vulnerable" unless the same sentence also names the exact shoulder/head/forearm passage carrying that read.
- For train-led scenes, strengthRead and preserve must keep naming the same physical carrier passage. Do NOT write "the train creates movement", "the scene has momentum", or "the engine adds drama" unless the same sentence also names the exact engine/smoke/pole passage carrying that read.
- For house, facade, object-study, or still-life Intent/Presence, strengthRead and preserve must keep naming the same carrier passage too. Do NOT write "the windows create warmth", "the house feels welcoming", "the bottle feels elegant", or "the object suggests celebration" unless the same sentence also names the exact door/window/pump/label passage and the visible relation that carries that read.
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
