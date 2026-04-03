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
- For each criterion, pick ONE concrete anchor first: a locatable junction or passage such as "the jaw edge against the dark collar" or "the orange sleeve where it meets the blue-gray wall." Downstream stages will be forced to stay with that anchor, so do not use broad areas like "the background" or "the left side."

Edge / focus and surface / medium (avoid lazy defaults):
- **Edge and focus control:** Record **specific** reads: where hard vs soft edges sit, what wins first attention, lost-and-found, and whether blur or flattening might be **capture** (JPEG, motion, glare) vs **painted** ambiguity. If hierarchy is unclear only because the photo is soft, say so in tensionRead and lower **confidence** for this criterion—not a generic “edges need work” without zones.
- **Surface and medium handling:** Name **actual** mark behavior (direction, thickness, wet/dry, scumble, tooth, correction layers) visible in the image. Do **not** down-rank this axis only because the photo hides fine texture; distinguish “cannot see handling in this capture” (confidence low / note in tensionRead) from “handling looks inconsistent on the canvas.”
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
- visibleEvidence: 4–8 junction-level observations (see schema). Each must name TWO identifiable things in the painting and describe the specific visual relationship between them (value break, color shift, edge event, spatial overlap, alignment). Cover different areas of the canvas across the list when possible. NEVER write area-level generalities like "the background is well-handled" or "some transitions could be smoother." Instead: "the clerk’s white cuff against the dark ledger creates a sharp value accent that draws the eye before the face does."
- strengthRead: name the specific passage and relationship that works for this criterion. Not "good value structure" but "the progression from the bright foreground shirts through the mid-tone desks to the dim back wall creates a clear three-plane depth stack."
- tensionRead: name what is genuinely unresolved and WHERE. If nothing is truly unresolved, say "This criterion reads resolved at the level the painting is working at" rather than manufacturing a problem. Forced tensions produce bad downstream advice.
- preserve: name the specific relationship that must survive revision—the passage and the visual event, not an abstract quality.
- confidence: high / medium / low

Return JSON only.`;
}

export function buildEvidenceStagePrompt(style: string, medium: string): string {
  return buildEvidencePrompt(style, medium);
}
