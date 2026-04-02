import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import {
  VOICE_A_COMPOSITE_EXPERTS,
  VOICE_B_COMPOSITE_TEACHERS,
} from '../shared/critiqueVoiceA.js';
import type { CritiqueCalibrationDTO } from './critiqueCalibrationStage.js';
import type { CritiqueRequestBody } from './critiqueTypes.js';
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
  VOICE_B_OPENAI_SCHEMA,
  voiceAStageResultSchema,
  voiceBStageResultSchema,
} from './critiqueZodSchemas.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';
import { getCriterionExemplarBlock } from './criterionExemplars.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';

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

type VoiceAStageResult = {
  summary: string;
  suggestedPaintingTitles: Array<{ category: string; title: string; rationale: string }>;
  overallSummary: { analysis: string };
  studioAnalysis: { whatWorks: string; whatCouldImprove: string };
  comparisonNote: string | null;
  overallConfidence: 'low' | 'medium' | 'high';
  photoQuality: {
    level: 'poor' | 'fair' | 'good';
    summary: string;
    issues: string[];
    tips: string[];
  };
  categories: Array<{
    criterion: string;
    level: string;
    phase1: { visualInventory: string };
    phase2: { criticsAnalysis: string };
    confidence: 'low' | 'medium' | 'high';
    evidenceSignals: string[];
    preserve: string;
    nextTarget: string;
    subskills: Array<{ label: string; score: number; level: string }>;
  }>;
};

type VoiceBStageResult = {
  overallSummary: { topPriorities: string[] };
  studioChanges: Array<{ text: string; previewCriterion: string }>;
  categories: Array<{
    criterion: string;
    phase3: { teacherNextSteps: string };
    actionPlanSteps: Array<{
      area: string;
      currentRead: string;
      move: string;
      expectedRead: string;
      preserve: string;
      priority: 'primary' | 'secondary';
    }>;
    voiceBPlan: {
      currentRead: string;
      mainProblem: string;
      mainStrength: string;
      bestNextMove: string;
      optionalSecondMove: string;
      avoidDoing: string;
      expectedRead: string;
      storyIfRelevant: string;
    };
    anchor: {
      areaSummary: string;
      evidencePointer: string;
      region: { x: number; y: number; width: number; height: number };
    };
    editPlan: {
      targetArea: string;
      preserveArea: string;
      issue: string;
      intendedChange: string;
      expectedOutcome: string;
      editability: 'yes' | 'no';
    };
  }>;
};

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
- Avoid generic opener verbs such as "captures," "effectively uses," "conveys," "enhances," or "aims to" unless followed immediately by a concrete visual reason in the same sentence.
- Do not sound like a product blurb, museum wall label, or encouraging art-coach template.
- Non-redundancy: categories[].phase1.visualInventory must stay objective and distinct from categories[].phase2.criticsAnalysis. categories[].phase2.criticsAnalysis must not repeat the same sentence, clause, or junction observation twice. categories[].evidenceSignals must be short distillations of distinct lines from that criterion’s visibleEvidence—do not restate the phase2 text verbatim.
- Overall prose: studioAnalysis.whatWorks vs whatCouldImprove must not duplicate each other; summary and overallSummary.analysis must add different angles, not repeat the same phrases.
- Rating calibration (per criterion, from visible evidence only):
  - Beginner: weak fundamentals or control in this criterion—the work reads early-stage, uncertain, or under-supported.
  - Intermediate: clear competence in this criterion—control reads as intentional more often than accidental, and the painting shows real structure or craft in this area even though refinement remains.
  - Advanced: strong in this criterion with only modest, selective refinement left.
  - Master: very rare but real when deserved—museum-grade sustained control and intention in this criterion for this painting.
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
- Output ONLY Voice B teaching fields: overallSummary.topPriorities, studioChanges, and for each criterion the anchor, editPlan, voiceBPlan, actionPlanSteps, and actionPlan.
- Do NOT output Voice A fields in this stage: no levels, no feedback, no studioAnalysis, no summary analysis, no titles, no photoQuality, and no overallConfidence.
- Treat the supplied Voice A JSON as fixed judgment. You are not re-grading the work; you are deciding the best next teaching move for each criterion from Voice A's judgment plus the evidence.
- Treat Voice A's categories[].phase1.visualInventory as the objective Phase 1 record for each criterion and categories[].phase2.criticsAnalysis as the fixed critical diagnosis.
${phaseVoiceBWorkflowRules()}
- For each criterion, also output ONE shared anchored passage in categories[].anchor and ONE machine-readable edit instruction block in categories[].editPlan. The prose, overlay region, and AI edit must all point to that same visible passage.

Full criterion rubric for this declared style (use it actively when deciding each band):
${rubricBlock}

${completionToneBlock(evidence)}

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Use the supplied Voice A JSON as the fixed diagnosis and rating context.
- Do not invent visible claims that are not supported by the evidence.
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Your usefulness comes from precision, not from forced criticism.
- The eight criteria should usually vary; uniformity across all eight is possible but uncommon. Do not smooth everything to one level out of politeness or uncertainty.
- Voice B tone: teacherly coaching for a motivated serious hobbyist or art student. Lead with the clearest action, then explain it plainly.
- Voice B non-redundancy: voiceBPlan fields must not copy/paste the same sentence across currentRead, mainProblem, bestNextMove, and expectedRead—each field adds new information. actionPlan must be a tight numbered rendering of actionPlanSteps only: do not add extra steps, synonyms, or repeated junctions that are not in those steps. Do not restate Voice A’s feedback verbatim.
- Voice B diction guardrails:
  - Begin with a concrete verb tied to a specific passage: soften, group, separate, darken, quiet, restate, widen, narrow, cool, warm.
  - Avoid vague teacher talk such as "explore," "develop," "improve the composition," "add more depth," or "refine the edges" unless the sentence also names the exact passage and the exact directional change.
  - If the work is strong, keep the advice modest and local; do not turn a small issue into a full repaint.
- Calibration warning:
  - Do not mistake childlike, rudimentary, or clearly underdeveloped work for successful Expressionism or Abstract Art just because it is simplified, distorted, bold, or high-contrast.
  - Successful stylization still requires visible control, structural intent, and consistency within the chosen criterion. If those are missing, the criterion must stay low even when the work is vivid or unusual.
- Rating calibration (per criterion, from visible evidence only):
  - Beginner: weak fundamentals or control in this criterion—the work reads early-stage, uncertain, or under-supported.
  - Intermediate: clear competence in this criterion—control reads as intentional more often than accidental, and the painting shows real structure or craft in this area even though refinement remains. Do not use Intermediate as a polite default for weak or naive work; if fundamentals in this criterion are still shaky, that criterion is Beginner.
  - Advanced: strong in this criterion with only modest, selective refinement left—little substantive development still required; issues are small and localized.
  - Master: very rare but real when deserved—museum-grade sustained control and intention in this criterion for this painting; reserve for evidence of exceptional, unified mastery (not "pretty good").
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
- Voice B planning structure (required for all eight categories): First create categories[].voiceBPlan and categories[].actionPlanSteps for THAT criterion on THIS painting only.
  - categories[].voiceBPlan is Voice B's teacher note to self for the anchored passage: what it is doing now, what the main problem/strength is, what the best next move is, what should be preserved or avoided, and what the passage should read like afterward.
  - categories[].actionPlanSteps must contain 1-3 high-leverage steps only. Do not invent filler just to reach a quota. If one move is genuinely enough for this criterion, return one step. If two moves are enough, return two. Use three only when the painting truly needs three distinct moves.
  - Every actionPlanStep must answer: where exactly, what is happening there now, what exact move to make, and what should read differently afterward.
  - actionPlanSteps[].area must name a **visible, locatable passage** in THIS painting—a physical thing the artist can point to (a pot, a path edge, a cluster of flowers, a shadow junction, a contour). NEVER fill area with abstract design language: "arrangement of elements", "spatial relationships", "areas where energy is evident", "the compositional flow", or "elements" by itself. If the criterion is conceptual (Intent, Presence), still locate it in a physical passage—e.g. "the red path pulling the eye toward the shed" rather than "the arrangement of elements."
  - actionPlanSteps[].move must begin with a concrete studio verb (soften, darken, cool, group, separate, sharpen, widen, compress, quiet, warm, lose, restate) applied to a specific visual element in that passage. NEVER use "adjust elements", "enhance presence", "ensure consistency", "improve structure", "strengthen the painting's presence", "define these spatial relationships", or "unify texture" without naming what exactly to change. If you cannot name a specific brushstroke, edge, color relationship, or spatial event to change, the step is too vague.
  - actionPlanSteps[].currentRead must describe a visible fact, not a judgment. Bad: "could be more unified", "feels less necessary", "some relationships could be clearer". Better: "the green foliage patches are all the same value and chroma, flattening the depth between near and far beds."
  - Prefer one primary step and at most two secondary steps. Secondary steps must be genuinely different, not paraphrases of the same move.
  - Make categories[].phase3.teacherNextSteps a readable numbered rendering of categories[].actionPlanSteps. Do not invent extra meaning in phase3.teacherNextSteps that is not already present in those structured steps. One numbered item per step—no duplicate numbered lines saying the same move.
- Voice B phase3.teacherNextSteps (required for all eight categories): For each category, phase3.teacherNextSteps is the readable numbered studio guidance derived from actionPlanSteps for THAT criterion on THIS painting only.
  - Voice B must derive every recommendation from the same anchored passage used by anchor.areaSummary, anchor.evidencePointer, and editPlan. Think in this exact order for every step: (1) name the anchored passage, (2) name the concrete issue or strength in that passage, (3) state the exact move, and (4) state the intended read after the move.
  - Every numbered step must answer all three questions explicitly: **where exactly**, **what exactly is wrong/right there**, and **what exactly should change or stay**. If a step could fit many paintings by swapping only the subject noun, it is too vague.
  - Do not use abstract placeholders such as "certain edges", "small details", "the story", "color transitions", "focal area", "more realism", or "more depth" unless the same sentence names the exact edge, exact detail, exact story beat, exact color junction, or exact focal passage in THIS painting.
  - If you mention a narrative or story, say what that story or dramatic situation appears to be in this painting and which visible passages carry it; do not refer to "the story" generically.
  - If you mention preserving a strength, say exactly what to preserve and why it matters: e.g. keep X contrast, keep Y diagonal, keep Z edge around the eyes—not "maintain the focus" in the abstract.
  - **Critical:** The exact phrase "Don’t change a thing." is **only** allowed when categories[].level is **Master** for that criterion. For **Beginner, Intermediate, or Advanced**, never use that phrase or praise-only preservation as a substitute for numbered improvement steps—Advanced still needs concrete moves toward Master.
  - **Equally critical — no preservation masquerading as improvement:** For any criterion below Master, the actionPlan and actionPlanSteps must contain at least one genuine CHANGE instruction—something the artist would physically alter on the canvas. Steps that begin with "Maintain", "Preserve", "Keep", "Continue", or "Protect" are preservation steps, NOT improvement steps. Preservation is allowed as a secondary step or as part of a step that also names a change, but it must NEVER be the only advice for a non-Master criterion. If a criterion is Advanced, there is still a real gap between Advanced and Master—name the specific move that would close it rather than telling the artist to keep doing what they are doing.
  - If categories[].level is **Master** for that criterion: phase3.teacherNextSteps must begin with exactly "Don’t change a thing." Then add 1–2 sentences naming what is already exemplary in that anchored passage. No homework, no revision steps.
  - If level is **Beginner**: usually 1-3 specific steps that would realistically move this criterion toward **Intermediate**. Use more than one step only if each step names a different useful move on this image.
  - If level is **Intermediate**: usually 1-3 specific steps aimed at moving toward **Advanced**.
  - If level is **Advanced**: usually 1-2 specific steps aimed at moving toward **Master**. These must name a real refinement, not just praise. Even a strong painting has a next move—name it. Example for a watercolor: "Vary the wash density in the upper sky from left to right so the dark-to-medium gradient reads less uniform." Example for an oil: "Cool the shadow under the porch roof by one step so the warm window glow separates more from the shadow."
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
  - Voice A categories[].phase2.criticsAnalysis, Voice B categories[].phase3.teacherNextSteps, categories[].editPlan, and any related studioChanges must all stay aligned to that same anchored passage.
- Edit plan rules (required for every criterion):
  - categories[].editPlan.targetArea must match categories[].anchor.areaSummary.
  - categories[].editPlan.issue, intendedChange, and expectedOutcome must be concrete, machine-readable, and limited to the same anchored passage.
  - issue must describe the visible problem or strength in that passage, not a generic goal. Bad: "needs more depth", "some shadow areas could be more defined", "improve realism". Better: "the shadow behind the left cheek merges too evenly into the jacket so the head loses separation".
  - intendedChange must be a directional studio move in that same passage, not a broad ambition. Bad: "refine shadow areas", "smooth transitions", "add details". Better: "darken the jacket side of that cheek-jacket junction and keep the cheek edge slightly cleaner".
  - expectedOutcome must describe the resulting read in plain visual terms, not a slogan. Bad: "enhanced clarity", "better narrative", "more realism". Better: "the face separates sooner from the jacket and the overlap reads as depth instead of flattening".
  - Think of editPlan as a studio teacher's note to self: where, what is happening there now, what exact move to make, and what the passage should read like afterward.
  - If categories[].level is Master, set editability to "no" and make intendedChange a preservation description only.
  - Otherwise set editability to "yes" unless the anchored target is too ambiguous or too broad to revise reliably.
- studioChanges (Voice B — same composite teaching voice): 2–5 items. Each item is { text, previewCriterion }. text = one concrete studio instruction: where + what + how for THIS image only. previewCriterion must be the single best-matching criterion label from the schema enum for that change (used to route an illustrative preview image).
- studioChanges should usually be selected from the strongest categories[].actionPlanSteps rather than invented as a separate loose advice stream. If you write a studioChange that is not visibly grounded in an existing actionPlanStep for that criterion, it is probably too vague.
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
- Ensure the eight actionPlan blocks collectively cover improvement intent across criteria: Voice B should not repeat the same step verbatim in multiple categories—tailor each actionPlan to that criterion’s lever on this canvas.

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

const VOICE_A_MAX_TOKENS = 3200;
const VOICE_B_MAX_TOKENS = 4800;

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
  const raw = await runSchemaStage(
    apiKey,
    model,
    buildVoiceAPrompt(style, body.medium, evidence, calibration),
    `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\n${buildVoiceASchemaInstruction()}`,
    VOICE_A_OPENAI_SCHEMA
  );
  const parsed = voiceAStageResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('Voice A Zod validation failed:', parsed.error.message);
    return raw as VoiceAStageResult;
  }
  return parsed.data as VoiceAStageResult;
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
  const raw = await runSchemaStage(
    apiKey,
    model,
    buildWritingPrompt(style, body.medium, evidence, calibration),
    `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\nVoice A judgment JSON (fixed diagnosis/rating context):\n${JSON.stringify(voiceA)}\n\n${buildVoiceBSchemaInstruction()}`,
    VOICE_B_OPENAI_SCHEMA,
    VOICE_B_MAX_TOKENS
  );
  const parsed = voiceBStageResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('Voice B Zod validation failed:', parsed.error.message);
    return raw as VoiceBStageResult;
  }
  return parsed.data as VoiceBStageResult;
}

function mergeVoiceStages(voiceA: VoiceAStageResult, voiceB: VoiceBStageResult): unknown {
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
  calibration?: CritiqueCalibrationDTO
): Promise<unknown> {
  const voiceA = await runCritiqueVoiceAStage(apiKey, model, style, body, evidence, calibration);
  const voiceB = await runCritiqueVoiceBStage(apiKey, model, style, body, evidence, voiceA, calibration);
  return mergeVoiceStages(voiceA, voiceB);
}
