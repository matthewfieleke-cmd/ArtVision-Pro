import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import {
  EVIDENCE_STAGE_CLOSE_READING,
  EVIDENCE_STAGE_ASSESSMENT_PROTOCOL,
} from '../shared/critiqueVoiceA.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';

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

Edge / focus and surface / medium (critic-grade evidence—avoid both inflation and automatic pessimism):
- **Edge and focus control:** A critic asks: (1) Is there a **hierarchy** of sharp vs lost edges that supports the picture’s attention and depth? (2) Are transitions **purposeful** (even if soft or open) or **accidental** (uniform mush, every contour equally loud, no focal edge logic)? Record **zones**: silhouettes vs internal modeling, foreground vs depth, focal vs supporting passages. State whether blur or flattening is likelier **capture** (JPEG, motion, glare) vs **painted**. If the photo hides edge truth, set **confidence** low and say what cannot be verified—not “edges need work” without pictorial specifics.
- **Surface and medium handling:** A critic asks: (1) Does **facture** (mark scale, direction, layering, transparency/opacity, wet/dry, scumble, drag, correction) **cohere** with the declared medium and the picture’s aim? (2) Is variation **economical** (repeatable vocabulary, decisive passages) or **incoherent** (scrubbed, overworked, hesitant)? Name **observable** behavior in at least one named area. If fine texture is illegible in this capture, set **confidence** low and separate “cannot see handling here” from “handling on the canvas reads weak or inconsistent.”
- **Do not** use “other criteria look strong” as a reason to **assume** edge and surface are strong—each axis needs its own visibleEvidence. **Do not** treat a soft photo as automatic proof that both execution criteria sit a full band below structure/color unless **canvas evidence** supports that.
- Photo limits belong in **photoQualityRead**; keep execution evidence tied to what the painting still shows (e.g. large-scale edge contrast, visible stroke scale) even when fine detail is uncertain.

Context:
- Declared style: ${style}
- Declared medium: ${medium}
- Benchmarks for what "Master" means in this style: ${benchmarks}

Style-specific master signals:
${rubricBlock}

${mediumEvidenceGuardrails(medium)}

For each criterion, provide:
- visibleEvidence: short concrete observations tied to areas of the canvas
- strengthRead: what already works in that criterion
- tensionRead: what seems unresolved, if anything
- preserve: what should survive revision
- confidence: high / medium / low

Return JSON only.`;
}

export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildEvidencePrompt(style, medium);
}
