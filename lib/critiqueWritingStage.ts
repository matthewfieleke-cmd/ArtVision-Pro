import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import type { CritiqueCategory } from '../shared/critiqueContract.js';
import {
  VOICE_A_COMPOSITE_EXPERTS,
  VOICE_B_COMPOSITE_TEACHERS,
} from '../shared/critiqueVoiceA.js';
import { z } from 'zod';
import type { CritiqueCalibrationDTO } from './critiqueCalibrationStage.js';
import type { CritiqueRequestBody, CritiqueResultDTO, StudioChangeDTO } from './critiqueTypes.js';
import {
  buildVoiceASchemaInstruction,
  buildVoiceBSchemaInstruction,
} from './critiqueSchemas.js';
import {
  phaseVoiceAWorkflowRules,
  phaseVoiceBWorkflowRules,
} from './critiquePhasePromptBlocks.js';
import {
  VOICE_A_OPENAI_SCHEMA,
  anchorSchema,
  editPlanSchema,
  studioChangeSchema,
  type VoiceAStageResult,
  type VoiceBStageResult,
  voiceBCanonicalPlanSchema,
  voiceBPlanSchema,
  voiceBStepSchema,
  voiceAStageResultSchema,
  toOpenAIJsonSchema,
} from './critiqueZodSchemas.js';
import {
  validateCritiqueGrounding,
  validateCritiqueResult,
  type CritiqueEvidenceDTO,
  validateVoiceAStageOutput,
  validateVoiceBStageOutput,
} from './critiqueValidation.js';
import { sharesConcreteLanguage, tracesToVisibleEvidence } from './critiqueGrounding.js';
import { getCriterionExemplarBlock } from './criterionExemplars.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import {
  CritiqueRetryExhaustedError,
  CritiqueValidationError,
  errorDetails,
  errorMessage,
} from './critiqueErrors.js';
import { assertCritiqueQualityGate } from './critiqueEval.js';
import { noopCritiqueInstrumenter, type CritiqueInstrumenter } from './critiqueInstrumentation.js';
import {
  deriveActionPlanStepFromCanonical,
  deriveEditPlanFromCanonical,
  deriveLegacyVoiceBPlanFromCanonical,
} from './critiqueVoiceBCanonical.js';
import {
  CRITIQUE_CHANGE_VERB_PATTERN,
  CRITIQUE_DONT_CHANGE_PATTERN,
  CRITIQUE_PRESERVE_VERB_PATTERN,
  isGenericTeacherText,
} from './critiqueTextRules.js';

function isStyleKey(s: string): s is StyleKey {
  return Object.prototype.hasOwnProperty.call(ARTISTS_BY_STYLE, s);
}

function completionToneBlock(evidence: CritiqueEvidenceDTO): string {
  const { state, rationale } = evidence.completionRead;
  const base = `Completion read from evidence (use this to calibrate tone, not to invent new facts): state=${state}. Rationale: ${rationale}`;
  if (state === 'unfinished') {
    return `${base}

- Treat this as a work in progress: prioritize big-structure moves, resolving major passages, and clear next-session goals.
- Avoid language that assumes the piece is ready to sign, frame, or submit; "final polish" should wait until structure reads resolved.
- Voice B should focus on on-canvas moves for the next pass, not off-canvas homework drills.`;
  }
  if (state === 'likely_finished') {
    return `${base}

- Treat this as closer to presentation-ready: focus on selective refinements, protecting what already works, and subtle calibration—not wholesale restructuring unless evidence demands it.
- studioChanges should read as finishing passes: small targeted adjustments, varnish/photo/presentation awareness only when grounded in evidence.
- Avoid pushing the artist to "rebuild big shapes" unless criterion evidence clearly shows structural failure.`;
  }
  return `${base}

- Finish state is ambiguous: balance structure-level and selective advice; name what would change your mind in one more session vs. what is already reading resolved.`;
}

function formatCalibrationCaps(calibration?: CritiqueCalibrationDTO): string {
  if (!calibration) return '';
  return calibration.criterionCaps
    .map((cap) => `- ${cap.criterion}: do not rate above ${cap.maxLevel} (${cap.reason})`)
    .join('\n');
}

function buildVoiceAPrompt(
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO,
  calibration?: CritiqueCalibrationDTO
): string {
  const capBlock = formatCalibrationCaps(calibration);
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  return `You are stage 2A of a painting critique system.

You are now writing the critical judgment only from already extracted evidence.

Voice:
${VOICE_A_COMPOSITE_EXPERTS}

Your job in this stage:
- Output ONLY Voice A fields: summary, suggestedPaintingTitles, overallSummary.analysis, studioAnalysis, overallConfidence, photoQuality, and per-criterion level/phase1/phase2/confidence/evidenceSignals/preserve/nextTarget/subskills.
- Do NOT output any Voice B fields in this stage: no topPriorities, no studioChanges, no anchors, no edit plans, no voiceBPlan, no actionPlanSteps, and no actionPlan.

Full criterion rubric for this declared style (use it actively when deciding each band):
${rubricBlock}

How Voice A drives the eight ratings (required workflow):
- First, from the evidence alone, form Voice A’s judgment of how the painting performs in EACH of the eight criteria (composition, value, color, drawing/space, edges, surface handling, intent/necessity, presence/point of view). Think in full critical terms for each—not a single overall grade copied eight times.
- Then assign categories[].level for each criterion: that level MUST be the formal label (Beginner / Intermediate / Advanced / Master) for Voice A’s judgment in that criterion for this painting.
- For each criterion, decide not just what band fits, but why the work is not one band lower and not one band higher according to the rubric language above.
- Use the declared style and medium actively when calibrating every level. A competent watercolor softness, a useful pastel vibration, or an oil drag edge is not the same thing as weak control.
- Write studioAnalysis.whatWorks and whatCouldImprove as Voice A’s overall read, but ensure they do not contradict the per-criterion levels.

${completionToneBlock(evidence)}

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Do not invent visible claims that are not supported by the evidence.
${phaseVoiceAWorkflowRules()}
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Voice A tone: rigorous but respectful. Be exact, unsentimental, and concrete, but never snide, inflated, or condescending.
- The evidence JSON gives each criterion a concrete anchor passage. Stay traceable to that anchor and the listed visibleEvidence lines; do not drift to a different part of the painting.
- Avoid generic opener verbs such as "captures," "effectively uses," "conveys," "enhances," or "aims to" unless followed immediately by a concrete visual reason in the same sentence.
- Do not sound like a product blurb, museum wall label, or encouraging art-coach template.
- Non-redundancy: categories[].phase1.visualInventory must stay objective and distinct from categories[].phase2.criticsAnalysis. categories[].phase2.criticsAnalysis must not repeat the same sentence, clause, or junction observation twice. categories[].evidenceSignals must be short distillations of distinct lines from that criterion’s visibleEvidence—do not restate the phase2 text verbatim.
- Overall prose: studioAnalysis.whatWorks vs whatCouldImprove must not duplicate each other; summary and overallSummary.analysis must add different angles, not repeat the same phrases.
- Rating calibration (per criterion, from visible evidence only):
  - Beginner: weak fundamentals or control in this criterion—the work reads early-stage, uncertain, or under-supported.
  - Intermediate: clear competence in this criterion—control reads as intentional more often than accidental, and the painting shows real structure or craft in this area even though refinement remains.
  - Advanced: strong in this criterion with only modest, selective refinement left.
  - Master: exceptionally rare and only for museum-grade sustained control and intention in this criterion for this specific style-medium combination.
- Master gating (mandatory):
  - If photoQuality.level is not "good", no criterion may be Master.
  - If completionRead.state is not "likely_finished", no criterion may be Master.
- Calibration caps (mandatory if present):
${capBlock || '- No extra calibration caps supplied.'}

Return JSON only matching the schema.`;
}

export function buildWritingPrompt(
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO,
  calibration?: CritiqueCalibrationDTO
): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  const exemplarBlock = isStyleKey(style) ? getCriterionExemplarBlock(style, medium) : '';
  const capBlock = formatCalibrationCaps(calibration);
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  return `You are stage 2B of a painting critique system.

You are now writing the studio teaching plan from already extracted evidence and a completed Voice A judgment.

Voice:
${VOICE_B_COMPOSITE_TEACHERS}

Your job in this stage:
- Output ONLY Voice B teaching fields: overallSummary.topPriorities, studioChanges, and for each criterion the anchor, plan, and phase3.teacherNextSteps.
- Do NOT output Voice A fields in this stage: no levels, no feedback, no studioAnalysis, no summary analysis, no titles, no photoQuality, and no overallConfidence.
- Treat the supplied Voice A JSON as fixed judgment. You are not re-grading the work; you are deciding the best next teaching move for each criterion from Voice A's judgment plus the evidence.
- Treat Voice A's categories[].phase1.visualInventory as the objective Phase 1 record for each criterion and categories[].phase2.criticsAnalysis as the fixed critical diagnosis.
${phaseVoiceBWorkflowRules()}
- For each criterion, the evidence JSON already gives you one concrete anchor passage. Stay with that same visible passage. Output ONE shared anchored passage in categories[].anchor and ONE canonical teaching plan in categories[].plan. The prose, overlay region, and any derived AI edit fields must all point to that same visible passage.

Full criterion rubric for this declared style (use it actively when deciding each band):
${rubricBlock}

${completionToneBlock(evidence)}

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Use the supplied Voice A JSON as the fixed diagnosis and rating context.
- Do not invent visible claims that are not supported by the evidence.
- Ratings must stay honest to the declared style and medium. Treat style and medium as calibration tools, not decoration.
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Your usefulness comes from precision, not from forced criticism.
- The eight criteria should usually vary; uniformity across all eight is possible but uncommon. Do not smooth everything to one level out of politeness or uncertainty.
- Voice B tone: teacherly coaching for a motivated serious hobbyist or art student. Lead with the clearest action, then explain it plainly.
- For every non-Master criterion, there is exactly ONE primary move. Return one canonical plan only, and make phase3.teacherNextSteps read as one polished paragraph about that one move.
- For every Master criterion, give preserve-only guidance. Praise the exact visible relationship that is already exceptional and provide ZERO improvement instructions.
- Distinctness is mandatory across the full eight-criterion set: do not recycle the same move, the same wording, or the same anchored passage across multiple criteria unless the painting truly makes that unavoidable.
- Voice B non-redundancy: categories[].plan.currentRead, move, and expectedRead must each add different information. phase3.teacherNextSteps must be a tight rendering of categories[].plan only: do not add extra steps, synonyms, or repeated junctions that are not in that plan. Do not restate Voice A’s feedback verbatim.
- Anchor fidelity is mandatory: categories[].plan.move and phase3.teacherNextSteps must stay on the SAME passage named by categories[].anchor.areaSummary. Do not diagnose one passage and then prescribe a move on a nearby but different object.
- If the evidence anchor is "the boat's silhouette against the water", then the move must still name that boat-water edge or a directly adjacent passage inside it. Do not drift to "the horizon", "the background", "the whole harbor", or a generalized focal-area fix.
- Voice B diction guardrails:
  - Begin with a concrete verb tied to a specific passage: soften, group, separate, darken, quiet, restate, widen, narrow, cool, warm.
  - Avoid vague teacher talk such as "explore," "develop," "improve the composition," "push the contrast," "add more depth," or "refine the edges" unless the sentence also names the exact passage and the exact directional change.
  - If the work is strong, keep the advice modest and local; do not turn a small issue into a full repaint.
  - For Edge and focus control, the move must name a literal edge relationship: "[edge A] against [shape B]" plus what should change there. Bad: "improve focus", "clarify the focal point", "sharpen the main area", "separate the boat more". Good: "sharpen the boat's top edge against the pale water just right of the bow while leaving the far hull edge soft."
  - For Drawing, proportion, and spatial form, the move must stay on the anchored form relationship itself, not jump to a broader atmospheric or compositional fix.
- Calibration warning:
  - Do not mistake childlike, rudimentary, or clearly underdeveloped work for successful Expressionism or Abstract Art just because it is simplified, distorted, bold, or high-contrast.
  - Successful stylization still requires visible control, structural intent, and consistency within the chosen criterion. If those are missing, the criterion must stay low even when the work is vivid or unusual.
- Rating calibration (per criterion, from visible evidence only):
  - Beginner: weak fundamentals or control in this criterion—the work reads early-stage, uncertain, or under-supported.
  - Intermediate: clear competence in this criterion—control reads as intentional more often than accidental, and the painting shows real structure or craft in this area even though refinement remains. Do not use Intermediate as a polite default for weak or naive work; if fundamentals in this criterion are still shaky, that criterion is Beginner.
  - Advanced: strong in this criterion with only modest, selective refinement left—little substantive development still required; issues are small and localized.
  - Master: exceptionally rare and only when the visible evidence shows museum-grade sustained control and intention in this criterion for this specific style-medium combination; reserve it for truly extraordinary passages, not "pretty good."
- Master gating (mandatory):
  - If photoQuality.level is not "good", no criterion may be Master.
  - If completionRead.state is not "likely_finished", no criterion may be Master.
  - For unfinished work, rate the current state with a little generosity when strong direction is visible, but keep Master blocked and mention potential explicitly rather than inflating the current band.
- **Grading integration:** levels follow the **foundational assessment** idea—each criterion gets its own integrated read from the evidence; avoid blanket patterns (all high / all low / all middle) unless the evidence truly supports uniformity on every axis.
- Do not inflate: if the work is strong but still developing, that criterion is Intermediate, not Advanced.
- Do not assign the same level to all eight criteria unless the evidence truly supports uniformity; weak paintings usually have several criteria at Beginner.
- "Master" must stay rare; do not use it for work that still needs clear developmental passes in that area.
- If no real problem is visible, say so plainly instead of manufacturing a weakness.
- If calibration caps are supplied below, they are mandatory ceilings for this response.
- overallSummary (required):
  - topPriorities = 1 or 2 Voice B lines only, each beginning with the primary action and naming a visible passage from this painting.
- Voice B planning structure (required for all eight categories): First create categories[].plan for THAT criterion on THIS painting only.
  - categories[].plan.currentRead must describe a visible fact in the anchored passage, not a judgment. Bad: "could be more unified", "feels less necessary", "some relationships could be clearer". Better: "the green foliage patches are all the same value and chroma, flattening the depth between near and far beds."
  - categories[].plan.move must begin with a concrete studio verb (soften, darken, cool, group, separate, sharpen, widen, compress, quiet, warm, lose, restate) applied to a specific visual element in that passage. NEVER use "adjust elements", "enhance presence", "ensure consistency", "improve structure", "strengthen the painting's presence", "define these spatial relationships", or "unify texture" without naming what exactly to change. If you cannot name a specific brushstroke, edge, color relationship, or spatial event to change, the move is too vague.
- categories[].plan.move must repeat at least one concrete noun from categories[].anchor.areaSummary and stay inside that same visible passage.
  - categories[].plan.expectedRead must state what should read differently afterward in that same passage.
  - categories[].plan.preserve should name any nearby strength that must survive the move. If there is nothing specific to preserve, return an empty string.
  - categories[].plan.editability must be "yes" for non-Master criteria unless the anchored target is too ambiguous or too broad to revise reliably. For Master criteria, set it to "no".
- Voice B phase3.teacherNextSteps (required for all eight categories): For each category, phase3.teacherNextSteps is the readable studio guidance derived from categories[].plan for THAT criterion on THIS painting only.
  - Voice B must derive every recommendation from the same anchored passage used by anchor.areaSummary, anchor.evidencePointer, and plan. Think in this exact order for every step: (1) name the anchored passage, (2) name the concrete issue or strength in that passage, (3) state the exact move, and (4) state the intended read after the move.
  - Every numbered step must answer all three questions explicitly: **where exactly**, **what exactly is wrong/right there**, and **what exactly should change or stay**. If a step could fit many paintings by swapping only the subject noun, it is too vague.
  - Do not use abstract placeholders such as "certain edges", "small details", "the story", "color transitions", "focal area", "more realism", or "more depth" unless the same sentence names the exact edge, exact detail, exact story beat, exact color junction, or exact focal passage in THIS painting.
  - If you mention a narrative or story, say what that story or dramatic situation appears to be in this painting and which visible passages carry it; do not refer to "the story" generically.
  - If you mention preserving a strength, say exactly what to preserve and why it matters: e.g. keep X contrast, keep Y diagonal, keep Z edge around the eyes—not "maintain the focus" in the abstract.
  - **Critical:** The exact phrase "Don’t change a thing." is **only** allowed when categories[].level is **Master** for that criterion. For **Beginner, Intermediate, or Advanced**, never use that phrase or praise-only preservation as a substitute for a real improvement move.
  - **Equally critical — no preservation masquerading as improvement:** For any criterion below Master, phase3.teacherNextSteps and categories[].plan.move must contain one genuine CHANGE instruction—something the artist would physically alter on the canvas. Moves that begin with "Maintain", "Preserve", "Keep", "Continue", or "Protect" are preservation steps, NOT improvement steps.
  - If categories[].level is **Master** for that criterion: phase3.teacherNextSteps must begin with exactly "Don’t change a thing." Then add 1–2 sentences naming what is already exemplary in that anchored passage. No homework, no revision steps.
  - If categories[].level is **Master** for that criterion, categories[].plan.move must also be preserve-only and begin with "Preserve", "Keep", "Protect", "Leave", or "Hold".
  - If level is **Beginner**: the one move should realistically push this criterion toward **Intermediate**.
  - If level is **Intermediate**: the one move should realistically push this criterion toward **Advanced**.
  - If level is **Advanced**: the one move should be a real refinement toward **Master**, not praise disguised as advice.
  Steps must cite where on the painting (same identifiability rules as studioChanges). No generic studio drills unrelated to this image, and no repeated restatements of the same move.
- **Avoid lazy pairing:** Do not default **Edge and focus control** and **Surface and medium handling** to the same band (e.g. both Intermediate) just because a photo is imperfect. If evidence for edges/mark-making genuinely matches the same band as composition, value, and color, say why in that criterion’s feedback; otherwise rate each axis on its own integrated evidence. JPEG mush affects photoQuality confidence, not an automatic two-notch drop on every execution criterion.
- Shared anchor rules (required for every criterion):
  - categories[].anchor.areaSummary must name one main passage in THIS painting that a user could recognize.
  - categories[].anchor.evidencePointer must say what in that passage matters for this criterion.
  - categories[].anchor.region must be one normalized bounding region (x, y, width, height) covering that same passage. Use a larger connected region when the evidence is spread, but still keep one main area.
  - Prefer a connected visible passage such as a face, chair back, hand, foreground object, background tree line, wall drawing, sky band, or table edge—not a vague conceptual region like "the mood" or "the composition overall" unless the criterion truly cannot be localized more specifically.
  - areaSummary must name visible content, not a judgment label or abstract design summary.
  - **Banned anchor phrases** (never use as areaSummary): "arrangement of elements", "spatial arrangement", "areas where [quality] is evident", "compositional flow", "elements of the painting", "spatial relationships", "leaves and flowers" when it means the whole painting. For busy scenes, anchor to a specific junction or object.
  - Bad: "left side of the painting", "color transitions in clothing and background", "circular arrangement of figures around the table". Better: "the leftmost seated woman’s face against the dark hedge", "the orange sleeve where it meets the blue-gray wall", "the gap between the two front figures at the table edge".
  - If the real issue is relational, the anchor should still name the visible relationship in concrete terms: "the overlap between the cup rim and the hand", "the jaw edge against the dark collar", "the warm cheek turning into the green shadow under the eye".
  - The anchor should be as tight as possible while still including the full visible relationship being discussed.
- Voice A categories[].phase2.criticsAnalysis, Voice B categories[].phase3.teacherNextSteps, categories[].plan, and any related studioChanges must all stay aligned to that same anchored passage.
- studioChanges (Voice B — same composite teaching voice): 2–5 items. Each item is { text, previewCriterion }. text = one concrete studio instruction: where + what + how for THIS image only. previewCriterion must be the single best-matching criterion label from the schema enum for that change (used to route an illustrative preview image).
- studioChanges should usually be selected from the strongest categories[].plan items rather than invented as a separate loose advice stream. If you write a studioChange that is not visibly grounded in an existing canonical plan for that criterion, it is probably too vague.
- For every studioChanges.text, use the same hidden template: **where** (named passage) + **what is happening there now** + **what exact move to make** + **what read should result**.
- Each studioChanges.text must anchor to **identifiable content from the evidence** (same rules as before: motif, two colors at a junction, or precise zone + what occupies it). Bad: "In one area…", "two color families", "one contour" without naming what is in the picture.
- No two studioChanges should repeat the same move or the same named passage.
- If a work is rated below Master in any criterion, every studioChange must be a true revision move on this image, not generic practice homework.
- For non-master work, do not let "preserve-only" language replace correction in studioChanges.
- Prefer verbs like soften, darken, simplify, group, separate, lose, sharpen, compress, cool, warm, straighten, widen, narrow, or restate when they are justified by the evidence.
- Avoid empty advisory language such as "continue to explore," "consider adding," "experiment with," or "maintain" unless the sentence also names one visible area and one specific adjustment.
- Avoid stock location-free fixes like "increase contrast," "create more depth," "improve clarity," "enhance focus," or "refine edges" unless they are rewritten into a named passage + exact directional move.
- Respect medium limits:
  - Drawing: do not suggest color variation or painterly color harmony fixes unless the drawing actually uses color.
  - Watercolor: prefer wash control, edge timing, reserving lights, transparent layering, and bloom/backrun handling.
  - Pastel: prefer stroke pressure, tooth coverage, layering, edge softness, and control of powdery chroma.
  - Oil on Canvas: prefer paint thickness, scumble/glaze, temperature shifts, edge weight, and shape/value editing.
- For strong finished paintings, at most one studioChange may be preservation-only; the rest must still name something concrete in the picture to refine or protect in place.
- Ensure the eight canonical plans collectively cover improvement intent across criteria: Voice B should not repeat the same move verbatim in multiple categories—tailor each plan to that criterion’s lever on this canvas.

Benchmarks for what "Master" means in this style: ${benchmarks}

Criterion-specific exemplar intelligence for internal calibration (do not name these artists in the critique unless the product explicitly asks for it later):
${exemplarBlock || '- Use the strongest criterion exemplars available for this style and medium.'}

Calibration caps (mandatory if present):
${capBlock || '- No extra calibration caps supplied.'}

Anti-pattern examples:
- Bad: "The painting needs a stronger focal point."
- Better: "The eye already moves through several active areas. Keep that distributed attention, but quiet the one competing accent that interrupts the painting's main rhythm."

- Bad: "Increase contrast to create more depth."
- Better: "The compressed value range is part of the mood. Keep that compression, but separate one important shape from its neighbor with a smaller value and temperature shift."

- Bad: "Refine the edges to improve clarity."
- Better: "Most of the softness is doing useful atmospheric work. Keep the broad soft passages, but sharpen only the one edge that truly needs to hold the eye."

- Bad: "Define certain edges more clearly to enhance the focus hierarchy."
- Better: "Along the lower contour of the jaw where it meets the dark collar, sharpen that one edge and leave the cheek-to-background edge softer so the face, not the coat, wins first attention."

- Bad: "Enhance the narrative by adding small details that contribute to the story being told."
- Better: "If the scene is meant to read as a hurried kitchen cleanup, add one wet plate reflection on the back counter and a dish towel hanging from the chair so the domestic aftermath already implied by the sink and bent figure becomes legible."

- Bad: "Smooth out abrupt color transitions to enhance the realism of the painting."
- Better: "Where the orange cheek turns into the cool green shadow under the eye, bridge the jump with a muted red-violet half-tone so the head turns in space instead of breaking into two flat color stickers."

- Bad: "Make the composition more dynamic."
- Better: "The stillness is part of the work's effect. Instead of forcing more drama, adjust one directional cue so the eye moves more naturally through the existing calm."

- Bad: "Harmonize the colors."
- Better: "Do not flatten the color differences that give the painting life. Keep the vivid accents, but quiet the one passage that breaks the painting's color world."

- Bad: "Continue exploring bold color contrasts."
- Better: "In the upper-right foliage, keep the red-violet intensity, but quiet the one neighboring passage whose equal chroma prevents the main accent from landing."

- Bad: "Experiment with different brushwork techniques."
- Better: "In the foreground path, switch two or three repeated strokes to broader, flatter marks so the path reads as one plane before the eye reaches the trees."

- Bad: "Where two color families meet in the painting, adjust temperature…"
- Better: "Where the cadmium passage meets the cool blue-gray field along the lower edge, drag a scumbled violet-gray bridge so the junction reads as depth instead of a sticker outline."

- Bad: "Add subtle color variation" for a graphite or charcoal drawing.
- Better: "Use line weight and value grouping, not added color, to separate the lit side of the form from the shadow-facing side."

Return JSON only matching the schema.`;
}

const VOICE_A_MAX_TOKENS = 4800;
const VOICE_B_MAX_TOKENS = 7200;
const MAX_STAGE_ATTEMPTS = 3;
/**
 * Criteria per Voice B API call. Two keeps eight criteria in four calls (plus summary pass),
 * preserving cross-batch dedup validation while cutting serial round-trips vs one-per-call.
 */
const VOICE_B_CRITERIA_PER_PASS = 2;
const VOICE_B_ALLOWED_LEAD_VERBS =
  'soften, group, separate, darken, quiet, restate, widen, narrow, cool, warm, sharpen, lose, compress, vary, lighten, lift, simplify, straighten, merge, break, preserve, keep, protect, leave, hold';
const VOICE_B_SUMMARY_LEVEL_RANK = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
} as const;

type VoiceBCategoryResult = VoiceBStageResult['categories'][number];

type SchemaStageDebugContext = {
  stage: 'voice_a' | 'voice_b' | 'voice_b_summary';
  attempt: number;
  criteria?: readonly CriterionLabel[];
};

function chunkCriteria<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function filterEvidenceForCriteria(
  evidence: CritiqueEvidenceDTO,
  criteria: readonly CriterionLabel[]
): CritiqueEvidenceDTO {
  const allowed = new Set(criteria);
  return {
    ...evidence,
    criterionEvidence: evidence.criterionEvidence.filter((entry) =>
      allowed.has(entry.criterion)
    ),
  };
}

function filterVoiceAForCriteria(
  voiceA: VoiceAStageResult,
  criteria: readonly CriterionLabel[]
): VoiceAStageResult {
  const allowed = new Set(criteria);
  return {
    ...voiceA,
    categories: voiceA.categories.filter((category) =>
      allowed.has(category.criterion as CriterionLabel)
    ),
  };
}

function orderedVoiceBCategories(
  categories: readonly VoiceBCategoryResult[]
): VoiceBCategoryResult[] {
  const byCriterion = new Map(categories.map((category) => [category.criterion, category] as const));
  return CRITERIA_ORDER.map((criterion) => {
    const category = byCriterion.get(criterion);
    if (!category) throw new Error(`Voice B category missing: ${criterion}`);
    return category;
  });
}

function summaryEvidenceForCriterion(
  evidence: CritiqueEvidenceDTO,
  criterion: CriterionLabel
): CritiqueEvidenceDTO['criterionEvidence'][number] {
  const match = evidence.criterionEvidence.find((entry) => entry.criterion === criterion);
  if (!match) {
    throw new Error(`Voice B summary evidence missing: ${criterion}`);
  }
  return match;
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function upperCaseFirst(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function rankedSummaryCategories(
  categories: readonly VoiceBCategoryResult[],
  voiceA: VoiceAStageResult
): Array<{ category: VoiceBCategoryResult; level?: VoiceAStageResult['categories'][number]['level'] }> {
  const levelsByCriterion = new Map(voiceA.categories.map((category) => [category.criterion, category.level] as const));
  return [...categories]
    .map((category) => ({
      category,
      level: levelsByCriterion.get(category.criterion),
    }))
    .sort((a, b) => {
      const aRank =
        a.level && a.level in VOICE_B_SUMMARY_LEVEL_RANK
          ? VOICE_B_SUMMARY_LEVEL_RANK[a.level as keyof typeof VOICE_B_SUMMARY_LEVEL_RANK]
          : VOICE_B_SUMMARY_LEVEL_RANK.Intermediate;
      const bRank =
        b.level && b.level in VOICE_B_SUMMARY_LEVEL_RANK
          ? VOICE_B_SUMMARY_LEVEL_RANK[b.level as keyof typeof VOICE_B_SUMMARY_LEVEL_RANK]
          : VOICE_B_SUMMARY_LEVEL_RANK.Intermediate;
      if (aRank !== bRank) return aRank - bRank;
      return CRITERIA_ORDER.indexOf(a.category.criterion) - CRITERIA_ORDER.indexOf(b.category.criterion);
    });
}

function synthesizedPriorityLine(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number],
  level?: VoiceAStageResult['categories'][number]['level']
): string {
  if (level === 'Master') {
    return ensureTerminalPunctuation(
      upperCaseFirst(`preserve ${category.anchor.evidencePointer} in ${category.anchor.areaSummary}`)
    );
  }

  const groundedCurrentRead = groundedVoiceBCurrentRead(category, criterionEvidence);
  const groundedMove = groundedVoiceBMove(category, groundedCurrentRead, level);
  const normalizedMove = groundedMove.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  return ensureTerminalPunctuation(upperCaseFirst(normalizedMove));
}

function synthesizedStudioChangeText(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number],
  level?: VoiceAStageResult['categories'][number]['level']
): string {
  const groundedCurrentRead = groundedVoiceBCurrentRead(category, criterionEvidence)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
  const groundedMove = groundedVoiceBMove(category, groundedCurrentRead, level)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
  const expectedRead = groundedVoiceBExpectedRead(category)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
  return ensureTerminalPunctuation(
    `In ${category.anchor.areaSummary}, ${groundedCurrentRead}—${groundedMove} so that ${expectedRead}`
  );
}

function synthesizedStudioChange(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number],
  level?: VoiceAStageResult['categories'][number]['level']
): StudioChangeDTO {
  if (level === 'Master') {
    return {
      previewCriterion: category.criterion,
      text: ensureTerminalPunctuation(
        `Preserve ${category.anchor.evidencePointer} in ${category.anchor.areaSummary}.`
      ),
    };
  }

  const groundedCategory = normalizeVoiceBCategoryGrounding(category, criterionEvidence, level);
  return {
    previewCriterion: groundedCategory.criterion,
    text: synthesizedStudioChangeText(groundedCategory, criterionEvidence, level),
  };
}

export function synthesizeVoiceBSummaryFromCategories(
  evidence: CritiqueEvidenceDTO,
  voiceA: VoiceAStageResult,
  categories: readonly VoiceBCategoryResult[]
): Pick<VoiceBStageResult, 'overallSummary' | 'studioChanges'> {
  const ranked = rankedSummaryCategories(categories, voiceA);
  const prioritySource = ranked.filter(({ level }) => level !== 'Master').slice(0, 2);
  const topPriorityEntries = prioritySource.length > 0 ? prioritySource : ranked.slice(0, 1);
  const studioChangeEntries = ranked.slice(0, Math.min(5, Math.max(2, ranked.length)));

  return {
    overallSummary: {
      topPriorities: topPriorityEntries.map(({ category, level }) =>
        synthesizedPriorityLine(category, summaryEvidenceForCriterion(evidence, category.criterion), level)
      ),
    },
    studioChanges: studioChangeEntries.map(({ category, level }) =>
      synthesizedStudioChange(category, summaryEvidenceForCriterion(evidence, category.criterion), level)
    ),
  };
}

function groundedVoiceBCurrentRead(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number]
): string {
  const candidates = [
    category.plan.currentRead,
    category.actionPlanSteps?.[0]?.currentRead,
    category.voiceBPlan?.currentRead,
    category.anchor.evidencePointer,
    category.editPlan?.issue,
    criterionEvidence.visibleEvidence[0],
    criterionEvidence.strengthRead,
  ];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && tracesToVisibleEvidence(candidate, criterionEvidence)
    ) ?? category.plan.currentRead
  );
}

function groundedAnchorEvidencePointer(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number]
): string {
  const candidates = [
    category.anchor.evidencePointer,
    category.plan.currentRead,
    category.actionPlanSteps?.[0]?.currentRead,
    category.voiceBPlan?.currentRead,
    category.editPlan?.issue,
    criterionEvidence.visibleEvidence[0],
    criterionEvidence.strengthRead,
  ];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && tracesToVisibleEvidence(candidate, criterionEvidence)
    ) ?? criterionEvidence.visibleEvidence[0] ?? category.anchor.evidencePointer
  );
}

function groundedVoiceBIssue(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number]
): string {
  const groundedCurrentRead = groundedVoiceBCurrentRead(category, criterionEvidence);
  const candidates = [
    category.plan.currentRead,
    category.editPlan?.issue,
    groundedCurrentRead,
    category.voiceBPlan?.currentRead,
    category.anchor.evidencePointer,
    criterionEvidence.visibleEvidence[0],
    criterionEvidence.strengthRead,
  ];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && tracesToVisibleEvidence(candidate, criterionEvidence)
    ) ?? groundedCurrentRead
  );
}

function groundedVoiceBExpectedRead(
  category: VoiceBCategoryResult
): string {
  return (
    category.plan.expectedRead ||
    category.actionPlanSteps?.[0]?.expectedRead ||
    category.voiceBPlan?.expectedRead ||
    category.editPlan?.expectedOutcome ||
    'the passage will read more clearly in the same area.'
  );
}

function edgeMoveNamesConcreteRelationship(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const hasEdgeTerm = /\b(edge|edges|contour|contours|boundary|boundaries|outline|outlines)\b/.test(normalized);
  const hasRelationalCue =
    /\b(against|between|where|versus|than|while|not\b|so\b)\b/.test(normalized) ||
    normalized.includes('-to-');
  return hasEdgeTerm && hasRelationalCue;
}

function concreteEdgeRelationshipMove(areaSummary: string): string {
  const area = areaSummary.trim() || 'the anchored passage';
  if (/\b(edge|edges|contour|contours|boundary|boundaries|outline|outlines)\b/i.test(area)) {
    return `sharpen ${area} a little more while losing a nearby edge in that same passage so the focus hierarchy reads there instead of flattening.`;
  }
  if (/\b(against|between|where)\b/i.test(area)) {
    return `sharpen the edge in ${area} while losing a nearby edge in that same passage so the focus hierarchy reads there instead of flattening.`;
  }
  return `sharpen the clearest edge in ${area} against the neighboring shape while losing a nearby edge in that same passage so the focus hierarchy reads there instead of flattening.`;
}

function groundedVoiceBMove(
  category: VoiceBCategoryResult,
  groundedCurrentRead: string,
  level?: VoiceBCategoryLike['level']
): string {
  const context = {
    criterion: category.criterion,
    anchor: { areaSummary: category.anchor.areaSummary },
    level,
  };
  const normalizedMove = normalizeVoiceBMoveForSchema(category.plan.move, context);
  if (category.criterion === 'Edge and focus control' && !edgeMoveNamesConcreteRelationship(normalizedMove)) {
    return concreteEdgeRelationshipMove(category.anchor.areaSummary);
  }
  if (sharesConcreteLanguage(normalizedMove, category.anchor.areaSummary, 2)) {
    return normalizedMove;
  }
  if (sharesConcreteLanguage(normalizedMove, groundedCurrentRead, 2)) {
    return normalizedMove;
  }
  return fallbackVoiceBMoveForCriterion(context);
}

function groundedTeacherNextSteps(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number],
  groundedCurrentRead: string,
  groundedMove: string
): string {
  const existing = category.phase3.teacherNextSteps;
  if (
    existing &&
    tracesToVisibleEvidence(existing, criterionEvidence) &&
    sharesConcreteLanguage(existing, category.anchor.areaSummary, 2) &&
    !isGenericTeacherText(existing)
  ) {
    return existing;
  }
  const expectedRead = groundedVoiceBExpectedRead(category).replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const currentRead = groundedCurrentRead.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const move = groundedMove.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  return `In ${category.anchor.areaSummary}, ${currentRead}. ${move.charAt(0).toUpperCase()}${move.slice(1)} so ${expectedRead}.`;
}

function normalizeVoiceBCategoryGrounding(
  category: VoiceBCategoryResult,
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence'][number],
  level?: VoiceBCategoryLike['level']
): VoiceBCategoryResult {
  const anchorArea = category.anchor.areaSummary;
  const groundedCurrentRead = groundedVoiceBCurrentRead(category, criterionEvidence);
  const groundedEvidencePointer = groundedAnchorEvidencePointer(category, criterionEvidence);
  const groundedMove = groundedVoiceBMove(category, groundedCurrentRead, level);
  const teacherNextSteps = groundedTeacherNextSteps(category, criterionEvidence, groundedCurrentRead, groundedMove);
  const normalizedCategory: VoiceBCategoryResult = {
    ...category,
    anchor: {
      ...category.anchor,
      evidencePointer: groundedEvidencePointer,
    },
    phase3: {
      ...category.phase3,
      teacherNextSteps,
    },
    plan: {
      ...category.plan,
      currentRead: groundedCurrentRead,
      move: groundedMove,
    },
  };
  const legacyCategory = deriveLegacyVoiceBFields(normalizedCategory);
  return {
    ...legacyCategory,
    editPlan: legacyCategory.editPlan
      ? {
          ...legacyCategory.editPlan,
          issue: groundedVoiceBIssue(legacyCategory, criterionEvidence),
          targetArea: anchorArea,
        }
      : undefined,
    voiceBPlan: legacyCategory.voiceBPlan
      ? {
          ...legacyCategory.voiceBPlan,
          currentRead: groundedCurrentRead,
        }
      : undefined,
    actionPlanSteps: legacyCategory.actionPlanSteps?.map((step, index) =>
      index === 0 ? { ...step, area: anchorArea, currentRead: groundedCurrentRead } : step
    ),
    plan: {
      ...legacyCategory.plan,
      currentRead: groundedCurrentRead,
    },
  };
}

type VoiceBCategoryLike = {
  criterion?: unknown;
  anchor?: { areaSummary?: unknown };
  level?: unknown;
};

export function normalizeKnownVoiceBVerbDrift(
  text: string,
  category?: VoiceBCategoryLike
): string {
  const normalized = text.trim();
  if (!normalized) return normalized;
  const criterion = typeof category?.criterion === 'string' ? category.criterion : '';
  const areaSummary =
    category?.anchor && typeof category.anchor.areaSummary === 'string'
      ? category.anchor.areaSummary.trim()
      : 'the anchored passage';

  const spatialSeparationMatch = normalized.match(
    /^enhance(?:\s+the)?\s+spatial separation between\s+(.+?)\s+and\s+(.+?)(?:\s+to\s+(.+))?\.?$/i
  );
  if (spatialSeparationMatch) {
    const left = spatialSeparationMatch[1]?.trim();
    const right = spatialSeparationMatch[2]?.trim();
    const outcome = spatialSeparationMatch[3]?.trim();
    const tail = outcome ? ` to ${outcome}` : '';
    return `separate ${left} and ${right} more clearly${tail}.`;
  }

  const separationMatch = normalized.match(
    /^enhance(?:\s+the)?\s+separation between\s+(.+?)\s+and\s+(.+?)(?:\s+to\s+(.+))?\.?$/i
  );
  if (separationMatch) {
    const left = separationMatch[1]?.trim();
    const right = separationMatch[2]?.trim();
    const outcome = separationMatch[3]?.trim();
    const tail = outcome ? ` to ${outcome}` : '';
    return `separate ${left} and ${right} more clearly${tail}.`;
  }

  if (/^enhance(?:\s+the)?\s+color transitions?/i.test(normalized)) {
    return `vary the color transitions in ${areaSummary} so adjacent color passages stay distinct without breaking the palette.`;
  }

  if (/^enhance(?:\s+the)?\s+color transitions?.*\bcohesion\b/i.test(normalized)) {
    return `vary the color transitions in ${areaSummary} so adjacent passages stay cohesive without flattening the palette.`;
  }

  if (/^smooth the color transitions/i.test(normalized)) {
    return `vary the color transitions in ${areaSummary} so adjacent color passages stay cohesive without flattening the palette.`;
  }

  if (/^refine the transitions between light and dark areas/i.test(normalized)) {
    return `separate the light and dark passages in ${areaSummary} more clearly so the depth reads sooner.`;
  }

  if (/^refine the transitions between .+ and .+ to enhance separation/i.test(normalized)) {
    return `separate the adjacent passages in ${areaSummary} more clearly so the structure reads sooner.`;
  }

  if (/^enhance(?:\s+the)?\s+distinctiveness of individual expressions/i.test(normalized)) {
    return `sharpen the clearest expression accents in ${areaSummary} so the human pressure reads more distinctly.`;
  }

  if (/^refine the necessity of each figure'?s placement/i.test(normalized)) {
    return `group the least necessary figure placements in ${areaSummary} more tightly with the main cluster so the arrangement reads as one deliberate structure.`;
  }

  if (
    criterion === 'Intent and necessity' &&
    (/^enhance\b/i.test(normalized) ||
      /^strengthen\b/i.test(normalized) ||
      /^clarify\b/i.test(normalized) ||
      /^improve\b/i.test(normalized) ||
      /\bintent\b/i.test(normalized) ||
      /\bnecessity\b/i.test(normalized))
  ) {
    return `quiet the least necessary accent in ${areaSummary} so that same passage carries the painting's intent more decisively.`;
  }

  if (/^enhance(?:\s+the)?\s+presence\b/i.test(normalized) || /^enhance(?:\s+the)?\s+human force\b/i.test(normalized)) {
    return `sharpen the clearest force-carrying passage in ${areaSummary} so the point of view reads more decisively.`;
  }

  if (
    criterion === 'Color relationships' &&
    (/^enhance\b/i.test(normalized) || /^strengthen\b/i.test(normalized))
  ) {
    return `vary the color transitions in ${areaSummary} so the palette stays cohesive without flattening nearby passages.`;
  }

  if (
    criterion === 'Color relationships' &&
    /^smooth\b/i.test(normalized)
  ) {
    return `vary the color transitions in ${areaSummary} so the palette stays cohesive without flattening nearby passages.`;
  }

  if (
    criterion === 'Presence, point of view, and human force' &&
    (/^enhance\b/i.test(normalized) || /^strengthen\b/i.test(normalized))
  ) {
    return `sharpen the clearest expressive passage in ${areaSummary} so the human pressure reads more distinctly.`;
  }

  if (
    criterion === 'Value and light structure' &&
    /^refine\b/i.test(normalized)
  ) {
    return `separate the light and dark passages in ${areaSummary} more clearly so the value structure reads sooner.`;
  }

  if (
    criterion === 'Edge and focus control' &&
    (/^enhance\b/i.test(normalized) ||
      /^refine\b/i.test(normalized) ||
      /^improve\b/i.test(normalized) ||
      /^clarify\b/i.test(normalized) ||
      /\bfocus hierarchy\b/i.test(normalized))
  ) {
    return concreteEdgeRelationshipMove(areaSummary);
  }

  return normalized;
}

function fallbackVoiceBMoveForCriterion(category?: VoiceBCategoryLike): string {
  const criterion = typeof category?.criterion === 'string' ? category.criterion : '';
  const areaSummary =
    category?.anchor && typeof category.anchor.areaSummary === 'string'
      ? category.anchor.areaSummary.trim()
      : 'the anchored passage';
  const level = typeof category?.level === 'string' ? category.level : '';

  if (level === 'Master') {
    return `preserve the strongest relationship in ${areaSummary}.`;
  }

  switch (criterion) {
    case 'Composition and shape structure':
      return `group the main shape relationship in ${areaSummary}.`;
    case 'Value and light structure':
      return `separate the light and dark passages in ${areaSummary}.`;
    case 'Color relationships':
      return `vary the color transitions in ${areaSummary}.`;
    case 'Drawing, proportion, and spatial form':
      return `restate the key spatial relationship in ${areaSummary}.`;
    case 'Edge and focus control':
      return concreteEdgeRelationshipMove(areaSummary);
    case 'Surface and medium handling':
      return `vary the handling transitions in ${areaSummary}.`;
    case 'Intent and necessity':
      return `quiet the least necessary accent in ${areaSummary}.`;
    case 'Presence, point of view, and human force':
      return `sharpen the clearest expressive accent in ${areaSummary}.`;
    default:
      return `adjust the key relationship in ${areaSummary}.`;
  }
}

export function normalizeVoiceBMoveForSchema(
  text: string,
  category?: VoiceBCategoryLike
): string {
  const normalized = normalizeKnownVoiceBVerbDrift(text, category);
  if (CRITIQUE_CHANGE_VERB_PATTERN.test(normalized) || CRITIQUE_PRESERVE_VERB_PATTERN.test(normalized)) {
    return normalized;
  }
  return fallbackVoiceBMoveForCriterion(category);
}

function deriveLegacyVoiceBFields(category: VoiceBCategoryResult): VoiceBCategoryResult {
  const plan = category.plan;
  const anchor = category.anchor;
  const actionPlanStep =
    anchor && plan
      ? {
          area: anchor.areaSummary,
          currentRead: plan.currentRead,
          move: plan.move,
          expectedRead: plan.expectedRead,
          preserve: plan.preserve ?? anchor.evidencePointer,
          priority: 'primary' as const,
        }
      : undefined;
  const voiceBPlan =
    plan
      ? {
          currentRead: plan.currentRead,
          mainProblem: '',
          mainStrength: '',
          bestNextMove: plan.move,
          optionalSecondMove: '',
          avoidDoing: '',
          expectedRead: plan.expectedRead,
          storyIfRelevant: '',
        }
      : undefined;
  const editPlan = deriveEditPlanFromCanonical(anchor, plan);

  const hydrated: VoiceBCategoryResult = {
    ...category,
  };
  if (actionPlanStep) hydrated.actionPlanSteps = [actionPlanStep];
  if (voiceBPlan) hydrated.voiceBPlan = voiceBPlan;
  if (editPlan) hydrated.editPlan = editPlan;
  return hydrated;
}

function normalizeVoiceBCategoryBatchRaw(raw: unknown, voiceA: VoiceAStageResult): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const payload = raw as { categories?: unknown };
  if (!Array.isArray(payload.categories)) return raw;
  const levelsByCriterion = new Map(voiceA.categories.map((category) => [category.criterion, category.level] as const));

  return {
    ...payload,
    categories: payload.categories.map((category) => {
      if (!category || typeof category !== 'object') return category;
      const entry = category as Record<string, unknown>;
      const criterion = typeof entry.criterion === 'string' ? entry.criterion : undefined;
      const context: VoiceBCategoryLike = {
        criterion,
        anchor:
          entry.anchor && typeof entry.anchor === 'object'
            ? { areaSummary: (entry.anchor as Record<string, unknown>).areaSummary }
            : undefined,
        level: criterion ? levelsByCriterion.get(criterion as CriterionLabel) : undefined,
      };
      const plan =
        entry.plan && typeof entry.plan === 'object'
          ? {
              ...(entry.plan as Record<string, unknown>),
              ...(typeof (entry.plan as Record<string, unknown>).move === 'string'
                ? {
                    move: normalizeVoiceBMoveForSchema(
                      (entry.plan as Record<string, unknown>).move as string,
                      context
                    ),
                  }
                : {}),
            }
          : entry.plan;
      const actionPlanSteps = Array.isArray(entry.actionPlanSteps)
        ? entry.actionPlanSteps.map((step, index) => {
            if (!step || typeof step !== 'object' || index !== 0) return step;
            const stepRecord = step as Record<string, unknown>;
            return {
              ...stepRecord,
              ...(typeof stepRecord.move === 'string'
                ? { move: normalizeVoiceBMoveForSchema(stepRecord.move, context) }
                : {}),
            };
          })
        : entry.actionPlanSteps;

      const voiceBPlan =
        entry.voiceBPlan && typeof entry.voiceBPlan === 'object'
          ? {
              ...(entry.voiceBPlan as Record<string, unknown>),
              ...(typeof (entry.voiceBPlan as Record<string, unknown>).bestNextMove === 'string'
                ? {
                    bestNextMove: normalizeVoiceBMoveForSchema(
                      (entry.voiceBPlan as Record<string, unknown>).bestNextMove as string,
                      context
                    ),
                  }
                : {}),
            }
          : entry.voiceBPlan;

      const editPlan =
        entry.editPlan && typeof entry.editPlan === 'object'
          ? {
              ...(entry.editPlan as Record<string, unknown>),
              ...(typeof (entry.editPlan as Record<string, unknown>).intendedChange === 'string'
                ? {
                    intendedChange: normalizeVoiceBMoveForSchema(
                      (entry.editPlan as Record<string, unknown>).intendedChange as string,
                      context
                    ),
                  }
                : {}),
            }
          : entry.editPlan;

      return {
        ...entry,
        plan,
        actionPlanSteps,
        voiceBPlan,
        editPlan,
      };
    }),
  };
}

function voiceALevelForCriterion(
  voiceA: VoiceAStageResult,
  criterion: CriterionLabel
): VoiceAStageResult['categories'][number]['level'] {
  const match = voiceA.categories.find((category) => category.criterion === criterion);
  if (!match) throw new Error(`Voice A category missing: ${criterion}`);
  return match.level;
}

function buildVoiceBLevelRuleBlock(
  voiceA: VoiceAStageResult,
  criteria: readonly CriterionLabel[]
): string {
  return criteria
    .map((criterion) => {
      const level = voiceALevelForCriterion(voiceA, criterion);
      if (level === 'Master') {
        return `- ${criterion}: Voice A fixed level is Master. This criterion MUST use preserve-only guidance. categories[].plan.move must begin with preserve, keep, protect, leave, or hold, and categories[].plan.editability must be "no". categories[].phase3.teacherNextSteps may begin with "Don't change a thing."`;
      }
        return `- ${criterion}: Voice A fixed level is ${level}. This criterion is NOT Master. Do NOT use "Don't change a thing." anywhere. categories[].plan.move must begin with a true CHANGE verb from this list: soften, group, separate, darken, quiet, restate, widen, narrow, cool, warm, sharpen, lose, compress, vary, lighten, lift, simplify, straighten, merge, break, integrate, adjust, reduce, shift, refine. Preserve-only wording is forbidden for this criterion, and categories[].plan.editability must be "yes".`;
    })
    .join('\n');
}

function createVoiceBCategoryPassSchema(
  criteria: readonly CriterionLabel[],
  voiceA: VoiceAStageResult
) {
  const levelsByCriterion = new Map(
    criteria.map((criterion) => [criterion, voiceALevelForCriterion(voiceA, criterion)] as const)
  );
  const criterionSubsetEnum = z.enum(criteria as [CriterionLabel, ...CriterionLabel[]]);
  const changeVerbRegex = new RegExp(CRITIQUE_CHANGE_VERB_PATTERN.source, 'i');
  const preserveVerbRegex = new RegExp(CRITIQUE_PRESERVE_VERB_PATTERN.source, 'i');
  const masterPlanSchema = voiceBCanonicalPlanSchema.extend({
    move: z.string().min(12).regex(preserveVerbRegex),
    editability: z.literal('no'),
  });
  const nonMasterPlanSchema = voiceBCanonicalPlanSchema.extend({
    move: z.string().min(12).regex(changeVerbRegex),
    editability: z.literal('yes'),
  });
  const categorySchema = z.object({
      criterion: criterionSubsetEnum,
      phase3: z.object({
        teacherNextSteps: z.string(),
      }),
      anchor: anchorSchema,
      plan: voiceBCanonicalPlanSchema,
    })
    .superRefine((category, ctx) => {
      const level = levelsByCriterion.get(category.criterion);
      if (!level) return;
      const branchSchema =
        level === 'Master'
          ? z.object({
              anchor: anchorSchema,
              plan: masterPlanSchema,
            })
          : z.object({
              anchor: anchorSchema,
              plan: nonMasterPlanSchema,
            });
      const branchResult = branchSchema.safeParse({
        anchor: category.anchor,
        plan: category.plan,
      });
      if (!branchResult.success) {
        for (const issue of branchResult.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: issue.path,
          });
        }
      }
      const planMove = category.plan.move;
      const teacherNextSteps = category.phase3.teacherNextSteps;

      if (level === 'Master') {
        if (!CRITIQUE_DONT_CHANGE_PATTERN.test(teacherNextSteps)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['phase3', 'teacherNextSteps'],
            message: `${category.criterion}: Master guidance must begin with "Don't change a thing."`,
          });
        }
        if (!CRITIQUE_PRESERVE_VERB_PATTERN.test(planMove)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['plan', 'move'],
            message: `${category.criterion}: Master plan.move must be preserve-only.`,
          });
        }
        return;
      }

      if (CRITIQUE_DONT_CHANGE_PATTERN.test(teacherNextSteps)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase3', 'teacherNextSteps'],
          message: `${category.criterion}: non-Master guidance cannot use "Don't change a thing."`,
        });
      }
      if (!CRITIQUE_CHANGE_VERB_PATTERN.test(planMove)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['plan', 'move'],
          message: `${category.criterion}: non-Master plan.move must be a true change instruction.`,
        });
      }
    });
  return z.object({
    categories: z.array(categorySchema).length(criteria.length),
  });
}

const voiceBSummaryPassSchema = z.object({
  overallSummary: z.object({
    topPriorities: z.array(
      z.string().describe(
        'Voice B top priority only for THIS painting. Start with one primary action tied to a visible passage.'
      )
    ).min(1).max(2),
  }),
  studioChanges: z.array(studioChangeSchema).min(2).max(5),
});

const VOICE_B_SUMMARY_OPENAI_SCHEMA = toOpenAIJsonSchema(
  'painting_critique_voice_b_summary',
  voiceBSummaryPassSchema
);

function buildVoiceAUserPrompt(evidence: CritiqueEvidenceDTO, repairNote?: string): string {
  const base = `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\n${buildVoiceASchemaInstruction()}`;
  if (!repairNote) return base;
  return `${base}\n\nCorrection required on retry:\n${repairNote}`;
}

function buildVoiceBCategoryPassPrompt(
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO,
  voiceA: VoiceAStageResult,
  criteria: readonly CriterionLabel[],
  calibration?: CritiqueCalibrationDTO
): string {
  const criterionList = criteria.map((criterion) => `- ${criterion}`).join('\n');
  return `${buildWritingPrompt(style, medium, evidence, calibration)}

This Voice B pass is limited to these criteria only, in this exact order:
${criterionList}

Level-locked rules for this pass:
${buildVoiceBLevelRuleBlock(voiceA, criteria)}

Anchor alignment rules for this pass:
- categories[].anchor.areaSummary is the canonical label for the chosen passage.
- categories[].plan.currentRead MUST restate the same concrete visible fact as categories[].anchor.evidencePointer for that anchored passage.
- categories[].plan.move and categories[].plan.expectedRead MUST stay limited to that same anchored passage.

Return ONLY the categories array for those criteria in that exact order.
Do NOT return overallSummary or studioChanges in this pass. Those are handled separately after the per-criterion teaching plans are fixed.`;
}

function buildVoiceBCategoryPassUserPrompt(
  evidence: CritiqueEvidenceDTO,
  voiceA: VoiceAStageResult,
  criteria: readonly CriterionLabel[],
  repairNote?: string
): string {
  const filteredEvidence = filterEvidenceForCriteria(evidence, criteria);
  const filteredVoiceA = filterVoiceAForCriteria(voiceA, criteria);
  const criterionList = criteria.map((criterion) => `- ${criterion}`).join('\n');
  const base = `Use this evidence JSON as your only factual base for the listed criteria:\n${JSON.stringify(filteredEvidence)}\n\nVoice A judgment JSON (fixed diagnosis/rating context) for those same criteria:\n${JSON.stringify(filteredVoiceA)}\n\n${buildVoiceBSchemaInstruction()}\n\nThese level-locked rules are mandatory:\n${buildVoiceBLevelRuleBlock(voiceA, criteria)}\n\nThese anchor alignment rules are mandatory:\n- categories[].anchor.areaSummary is the canonical label for the chosen passage.\n- categories[].plan.currentRead must restate the same concrete visible fact as categories[].anchor.evidencePointer for that passage, not a more abstract summary.\n- categories[].plan.move and categories[].plan.expectedRead must stay limited to that same anchored passage.\n\nReturn ONLY categories for these criteria, in this exact order:\n${criterionList}`;
  if (!repairNote) return base;
  return `${base}\n\nCorrection required on retry:\n${repairNote}`;
}

function buildVoiceBSummaryPassPrompt(
  style: string,
  medium: string,
  evidence: CritiqueEvidenceDTO,
  calibration?: CritiqueCalibrationDTO
): string {
  return `${buildWritingPrompt(style, medium, evidence, calibration)}

This Voice B pass is for cross-criterion synthesis only.
Return ONLY overallSummary.topPriorities and studioChanges.
Do NOT return categories in this pass. The per-criterion Voice B category plans are already fixed and will be supplied in the user message.`;
}

function buildVoiceBSummaryPassUserPrompt(
  evidence: CritiqueEvidenceDTO,
  voiceA: VoiceAStageResult,
  categories: readonly VoiceBCategoryResult[],
  repairNote?: string
): string {
  const base = `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\nVoice A judgment JSON (fixed diagnosis/rating context):\n${JSON.stringify(voiceA)}\n\nFixed Voice B category plans already generated for this painting:\n${JSON.stringify({ categories })}\n\n${buildVoiceBSchemaInstruction()}\n\nReturn ONLY overallSummary.topPriorities and studioChanges. Base them on the fixed Voice B category plans above; do not invent new category-level moves.`;
  if (!repairNote) return base;
  return `${base}\n\nCorrection required on retry:\n${repairNote}`;
}

function buildRepairNote(prefix: string, error: unknown): string {
  return `${prefix}\n${errorDetails(error).map((detail) => `- ${detail}`).join('\n')}\nRegenerate the full JSON and fix every listed failure without changing the response shape.`;
}

function summarizeRawForLog(raw: unknown): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) return '[unserializable raw payload]';
    return serialized.length > 4000 ? `${serialized.slice(0, 4000)}…[truncated]` : serialized;
  } catch {
    return '[unserializable raw payload]';
  }
}

function logSchemaAttemptFailure(
  context: SchemaStageDebugContext,
  error: unknown,
  raw?: unknown
): void {
  const payload = {
    stage: context.stage,
    attempt: context.attempt,
    ...(context.criteria ? { criteria: [...context.criteria] } : {}),
    error: errorMessage(error),
    details: errorDetails(error),
    ...(raw !== undefined ? { rawPreview: summarizeRawForLog(raw) } : {}),
  };
  console.error('[critique schema attempt failed]', payload);
}

function buildVoiceBRepairNote(
  prefix: string,
  error: unknown,
  voiceA: VoiceAStageResult,
  criteria: readonly CriterionLabel[]
): string {
  const details = errorDetails(error);
  const failedLeadVerbFields = details.filter(
    (detail) =>
      detail.includes('plan.move') ||
      detail.includes('actionPlanSteps[0].move') ||
      detail.includes('bestNextMove') ||
      detail.includes('intendedChange')
  );
  const failedAnchorAlignmentFields = details.filter(
    (detail) =>
      detail.includes('plan.currentRead') ||
      detail.includes('targetArea does not match the anchored passage') ||
      detail.includes('actionPlanSteps[0].area does not match the anchored passage')
  );
  const failedCurrentReadGroundingFields = details.filter((detail) =>
    detail.includes('plan.currentRead is not traceable to visibleEvidence') ||
    detail.includes('actionPlanSteps[0].currentRead is not traceable to visibleEvidence')
  );
  const fieldInstruction =
    failedLeadVerbFields.length > 0
      ? `Critical field fix for ${criteria.join(', ')}:
- categories[].plan.move MUST begin with exactly one of these verbs: ${VOICE_B_ALLOWED_LEAD_VERBS}.
- For non-Master criteria, begin with a true CHANGE verb from that list.
- For Master criteria, begin with a preserve verb from that list.
- Do not start that field with clarify, define, strengthen, improve, maintain, enhance, or any synonym outside the allowed list.`
      : '';
  const anchorAlignmentInstruction =
    failedAnchorAlignmentFields.length > 0
      ? `Critical anchor alignment fix for ${criteria.join(', ')}:
- categories[].anchor.areaSummary is the canonical passage label.
- categories[].plan.currentRead MUST restate the same concrete visible fact as categories[].anchor.evidencePointer.
- Do not paraphrase the anchored passage into a broader or alternate location.`
      : '';
  const currentReadGroundingInstruction =
    failedCurrentReadGroundingFields.length > 0
      ? `Critical currentRead grounding fix for ${criteria.join(', ')}:
- categories[].plan.currentRead MUST stay traceable to visibleEvidence in the same anchored passage.
- Reuse the same concrete visible fact already stated in categories[].anchor.evidencePointer instead of summarizing it into abstract diagnosis language.
- Do not rewrite that field as "feels unresolved", "could be more unified", or any other judgment-only summary.`
      : '';
  return `${prefix}
${details.map((detail) => `- ${detail}`).join('\n')}
${buildVoiceBLevelRuleBlock(voiceA, criteria)}
${fieldInstruction}
${anchorAlignmentInstruction}
${currentReadGroundingInstruction}
Regenerate the full JSON and fix every listed failure without changing the response shape.`;
}

async function runSchemaStage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: unknown,
  maxTokens: number = VOICE_A_MAX_TOKENS
): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.18,
      max_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: jsonSchema,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${response.status}`);
  }

  const choices = json.choices as Array<{
    message?: { content?: string };
    finish_reason?: string;
  }> | undefined;
  const choice = choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Model response truncated (token limit reached)');
  }
  const text = choice?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty model response');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Model returned non-JSON');
  }
}

export async function runCritiqueVoiceAStage(
  apiKey: string,
  model: string,
  style: string,
  body: CritiqueRequestBody,
  evidence: CritiqueEvidenceDTO,
  calibration?: CritiqueCalibrationDTO
): Promise<VoiceAStageResult> {
  let repairNote: string | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
    try {
      const raw = await runSchemaStage(
        apiKey,
        model,
        buildVoiceAPrompt(style, body.medium, evidence, calibration),
        buildVoiceAUserPrompt(evidence, repairNote),
        VOICE_A_OPENAI_SCHEMA
      );
      const parsed = voiceAStageResultSchema.safeParse(raw);
      if (!parsed.success) {
        logSchemaAttemptFailure(
          { stage: 'voice_a', attempt },
          new CritiqueValidationError('Voice A schema validation failed.', {
            stage: 'voice_a',
            details: [parsed.error.message],
          }),
          raw
        );
        throw new CritiqueValidationError('Voice A schema validation failed.', {
          stage: 'voice_a',
          details: [parsed.error.message],
        });
      }
      return validateVoiceAStageOutput(parsed.data as VoiceAStageResult, evidence);
    } catch (error) {
      lastError = error;
      if (!(error instanceof CritiqueValidationError)) {
        logSchemaAttemptFailure({ stage: 'voice_a', attempt }, error);
      }
      if (attempt === MAX_STAGE_ATTEMPTS) {
        throw new CritiqueRetryExhaustedError('Voice A stage exhausted retries.', attempt, {
          stage: 'voice_a',
          details: errorDetails(error),
          cause: error,
        });
      }
      repairNote = buildRepairNote(
        `Previous Voice A attempt failed: ${errorMessage(error)}`,
        error
      );
    }
  }

  throw new CritiqueRetryExhaustedError('Voice A stage exhausted retries.', MAX_STAGE_ATTEMPTS, {
    stage: 'voice_a',
    details: errorDetails(lastError),
    cause: lastError,
  });
}

export async function runCritiqueVoiceBStage(
  apiKey: string,
  model: string,
  style: string,
  body: CritiqueRequestBody,
  evidence: CritiqueEvidenceDTO,
  voiceA: VoiceAStageResult,
  calibration?: CritiqueCalibrationDTO
): Promise<VoiceBStageResult> {
  const acceptedCategories: VoiceBCategoryResult[] = [];
  const criterionBatches = chunkCriteria(CRITERIA_ORDER, VOICE_B_CRITERIA_PER_PASS);

  for (const [batchIndex, criteria] of criterionBatches.entries()) {
    const batchSchema = createVoiceBCategoryPassSchema(criteria, voiceA);
    const batchOpenAiSchema = toOpenAIJsonSchema(
      `painting_critique_vb_batch_${batchIndex + 1}`,
      batchSchema
    );
    let repairNote: string | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
      try {
        const raw = normalizeVoiceBCategoryBatchRaw(
          await runSchemaStage(
          apiKey,
          model,
          buildVoiceBCategoryPassPrompt(style, body.medium, evidence, voiceA, criteria, calibration),
          buildVoiceBCategoryPassUserPrompt(evidence, voiceA, criteria, repairNote),
          batchOpenAiSchema,
          VOICE_B_MAX_TOKENS
          )
        , voiceA);
        const parsed = batchSchema.safeParse(raw);
        if (!parsed.success) {
          logSchemaAttemptFailure(
            { stage: 'voice_b', attempt, criteria },
            new CritiqueValidationError('Voice B schema validation failed.', {
              stage: 'voice_b',
              details: [parsed.error.message],
            }),
            raw
          );
          throw new CritiqueValidationError('Voice B schema validation failed.', {
            stage: 'voice_b',
            details: [parsed.error.message],
          });
        }
        const normalizedBatchCategories = parsed.data.categories.map((category) => {
          const criterionEvidence = evidence.criterionEvidence.find(
            (entry) => entry.criterion === category.criterion
          );
          if (!criterionEvidence) {
            throw new Error(`Voice B evidence missing for criterion: ${category.criterion}`);
          }
          const level = voiceALevelForCriterion(voiceA, category.criterion);
          return deriveLegacyVoiceBFields(normalizeVoiceBCategoryGrounding(category, criterionEvidence, level));
        });
        const combined = validateVoiceBStageOutput(
          {
            overallSummary: { topPriorities: [] },
            studioChanges: [],
            categories: [...acceptedCategories, ...normalizedBatchCategories],
          } as VoiceBStageResult,
          voiceA,
          evidence
        );
        acceptedCategories.splice(0, acceptedCategories.length, ...combined.categories);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof CritiqueValidationError)) {
          logSchemaAttemptFailure({ stage: 'voice_b', attempt, criteria }, error);
        }
        if (attempt === MAX_STAGE_ATTEMPTS) {
          const criteriaLabel = criteria.join(', ');
          throw new CritiqueRetryExhaustedError('Voice B stage exhausted retries.', attempt, {
            stage: 'voice_b',
            details: [`Criteria batch failed: ${criteriaLabel}`, ...errorDetails(error)],
            cause: error,
          });
        }
        repairNote = buildVoiceBRepairNote(
          `Previous Voice B attempt failed for criteria: ${criteria.join(', ')}. ${errorMessage(error)}`,
          error,
          voiceA,
          criteria
        );
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  const orderedCategories = orderedVoiceBCategories(acceptedCategories);
  let summaryRepairNote: string | undefined;
  let lastSummaryError: unknown;

  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
    try {
      const raw = await runSchemaStage(
        apiKey,
        model,
        buildVoiceBSummaryPassPrompt(style, body.medium, evidence, calibration),
        buildVoiceBSummaryPassUserPrompt(evidence, voiceA, orderedCategories, summaryRepairNote),
        VOICE_B_SUMMARY_OPENAI_SCHEMA,
        VOICE_B_MAX_TOKENS
      );
      const parsed = voiceBSummaryPassSchema.safeParse(raw);
      if (!parsed.success) {
        logSchemaAttemptFailure(
          { stage: 'voice_b_summary', attempt },
          new CritiqueValidationError('Voice B summary schema validation failed.', {
            stage: 'voice_b',
            details: [parsed.error.message],
          }),
          raw
        );
        throw new CritiqueValidationError('Voice B summary schema validation failed.', {
          stage: 'voice_b',
          details: [parsed.error.message],
        });
      }
      const validated = validateVoiceBStageOutput(
        {
          overallSummary: parsed.data.overallSummary,
          studioChanges: parsed.data.studioChanges,
          categories: orderedCategories,
        },
        voiceA,
        evidence
      );
      return {
        overallSummary: validated.overallSummary,
        studioChanges: validated.studioChanges,
        categories: orderedCategories,
      };
    } catch (error) {
      lastSummaryError = error;
      if (!(error instanceof CritiqueValidationError)) {
        logSchemaAttemptFailure({ stage: 'voice_b_summary', attempt }, error);
      }
      if (attempt === MAX_STAGE_ATTEMPTS) {
        if (error instanceof CritiqueValidationError) {
          const synthesized = synthesizeVoiceBSummaryFromCategories(
            evidence,
            voiceA,
            orderedCategories
          );
          const validated = validateVoiceBStageOutput(
            {
              overallSummary: synthesized.overallSummary,
              studioChanges: synthesized.studioChanges,
              categories: orderedCategories,
            },
            voiceA,
            evidence
          );
          return {
            overallSummary: validated.overallSummary,
            studioChanges: validated.studioChanges,
            categories: orderedCategories,
          };
        }
        throw new CritiqueRetryExhaustedError('Voice B stage exhausted retries.', attempt, {
          stage: 'voice_b',
          details: ['Voice B summary pass failed.', ...errorDetails(error)],
          cause: error,
        });
      }
      summaryRepairNote = buildRepairNote(
        `Previous Voice B summary attempt failed: ${errorMessage(error)}`,
        error
      );
    }
  }

  throw new CritiqueRetryExhaustedError('Voice B stage exhausted retries.', MAX_STAGE_ATTEMPTS, {
    stage: 'voice_b',
    details: ['Voice B summary pass failed.', ...errorDetails(lastSummaryError)],
    cause: lastSummaryError,
  });
}

function mergeVoiceStages(
  voiceA: VoiceAStageResult,
  voiceB: VoiceBStageResult
): unknown {
  const voiceBCategories = new Map(voiceB.categories.map((category) => [category.criterion, category] as const));
  return {
    summary: voiceA.summary,
    suggestedPaintingTitles: voiceA.suggestedPaintingTitles,
    overallSummary: {
      analysis: voiceA.overallSummary.analysis,
      topPriorities: voiceB.overallSummary.topPriorities,
    },
    studioAnalysis: voiceA.studioAnalysis,
    studioChanges: voiceB.studioChanges,
    comparisonNote: voiceA.comparisonNote,
    overallConfidence: voiceA.overallConfidence,
    photoQuality: voiceA.photoQuality,
    categories: voiceA.categories.map((category) => {
      const teacher = voiceBCategories.get(category.criterion);
      if (!teacher) throw new Error(`Voice B category missing: ${category.criterion}`);
      const phase3 = {
        teacherNextSteps: teacher.phase3.teacherNextSteps,
      };
      return {
        ...category,
        phase3,
        actionPlan: phase3.teacherNextSteps,
        plan: teacher.plan,
        actionPlanSteps: teacher.actionPlanSteps,
        voiceBPlan: teacher.voiceBPlan,
        anchor: teacher.anchor,
        editPlan: teacher.editPlan,
      };
    }),
  };
}

export async function runCritiqueWritingStage(
  apiKey: string,
  model: string,
  style: string,
  body: CritiqueRequestBody,
  evidence: CritiqueEvidenceDTO,
  calibration?: CritiqueCalibrationDTO,
  instrumenter: CritiqueInstrumenter = noopCritiqueInstrumenter
): Promise<CritiqueResultDTO> {
  const voiceA = await instrumenter.time('writing_voice_a', () =>
    runCritiqueVoiceAStage(apiKey, model, style, body, evidence, calibration)
  );
  const voiceB = await instrumenter.time('writing_voice_b', () =>
    runCritiqueVoiceBStage(apiKey, model, style, body, evidence, voiceA, calibration)
  );
  const merged = mergeVoiceStages(voiceA, voiceB);
  const validated = validateCritiqueGrounding(validateCritiqueResult(merged), evidence);
  assertCritiqueQualityGate(validated);
  return validated;
}
