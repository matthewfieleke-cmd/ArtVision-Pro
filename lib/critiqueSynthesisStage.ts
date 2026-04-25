import { CRITERIA_ORDER } from '../shared/criteria.js';
import type { CritiqueEvidenceDTO } from './critiqueTypes.js';
import type { CriterionWritingResult } from './critiqueParallelCriteria.js';
import { buildOpenAIMaxTokensParam, buildOpenAISamplingParam } from './openaiModels.js';
import { errorMessage } from './critiqueErrors.js';
import {
  CRITIQUE_AUDIENCE_FRAMING,
  SYNTHESIS_PRIORITIES_SHAPE,
  VOICE_A_COMPOSITE_EXPERTS,
  VOICE_B_COMPOSITE_TEACHERS,
} from '../shared/critiqueVoiceA.js';

/**
 * Output of the single synthesis call that runs after the eight parallel
 * criterion calls finish. This is the only stage that gets to see all eight
 * Voice A + Voice B outputs together, which is why it owns the overall
 * summary, top priorities, studio-analysis copy, studio changes, and the
 * three suggested painting titles.
 */
export type CritiqueSynthesisResult = {
  summary: string;
  overallAnalysis: string;
  topPriorities: string[];
  studioAnalysis: { whatWorks: string; whatCouldImprove: string };
  studioChanges: Array<{ text: string; previewCriterion: (typeof CRITERIA_ORDER)[number] }>;
  suggestedTitles: Array<{
    category: 'formalist' | 'tactile' | 'intent';
    title: string;
    rationale: string;
  }>;
};

const SYNTHESIS_JSON_SCHEMA = {
  name: 'painting_critique_synthesis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'overallAnalysis',
      'topPriorities',
      'studioAnalysis',
      'studioChanges',
      'suggestedTitles',
    ],
    properties: {
      summary: {
        type: 'string',
        description: 'One-paragraph plain-sentence summary for quick reading. 2-4 sentences.',
      },
      overallAnalysis: {
        type: 'string',
        description:
          'Expanded analysis weaving the strongest across-criteria reads and the primary tensions. 3-5 sentences.',
      },
      topPriorities: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: { type: 'string' },
        description: 'Two to three priority actions the artist should tackle next.',
      },
      studioAnalysis: {
        type: 'object',
        additionalProperties: false,
        required: ['whatWorks', 'whatCouldImprove'],
        properties: {
          whatWorks: { type: 'string' },
          whatCouldImprove: { type: 'string' },
        },
      },
      studioChanges: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'previewCriterion'],
          properties: {
            text: { type: 'string' },
            previewCriterion: { type: 'string', enum: [...CRITERIA_ORDER] },
          },
        },
      },
      suggestedTitles: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'title', 'rationale'],
          properties: {
            category: { type: 'string', enum: ['formalist', 'tactile', 'intent'] },
            title: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

/**
 * Synthesis sees all eight per-criterion critiques at once. It must speak in
 * the same voice as the per-criterion calls (so the painter reads one coherent
 * critique, not nine disjointed ones), but it is also the stage that turns
 * the eight diagnoses into a next-session plan. Keep the composite panels
 * present so the voice stays consistent; add the priorities-shape so the
 * overall summary, top priorities, and studio changes come out as a plan the
 * reader can act on rather than a list of aspirations.
 */
export const SYNTHESIS_SYSTEM_MESSAGE = [
  'You are the synthesis step of a three-stage painting critique. You see the evidence and all eight per-criterion critic + teacher paragraphs, and you produce the painter-facing summary, studio analysis, priorities, studio changes, and suggested titles.',
  '',
  CRITIQUE_AUDIENCE_FRAMING,
  '',
  VOICE_A_COMPOSITE_EXPERTS,
  '',
  VOICE_B_COMPOSITE_TEACHERS,
  '',
  SYNTHESIS_PRIORITIES_SHAPE,
  '',
  'Hard rules:',
  '- Ground every claim in the per-criterion critiques and the evidence you are given. Do not invent new observations.',
  '- Never name critics, teachers, artists, famous artworks, or art-historical movements.',
  '- Do not open with filler ("This painting…", "Overall…"). Speak as a thoughtful critic and a master teacher would over the artist’s shoulder.',
  '- Prioritise ruthlessly. One primary thing to work on, at most two secondary moves.',
].join('\n');

export function buildSynthesisPrompt(args: {
  style: string;
  medium: string;
  userTitle?: string;
  evidence: CritiqueEvidenceDTO;
  criterionResults: CriterionWritingResult[];
}): string {
  const { style, medium, userTitle, evidence, criterionResults } = args;

  const titleLine = userTitle
    ? ` The artist titled this work: "${userTitle}". You may reference the title, but do not propose alternate titles — set suggestedTitles to three neutral studio-label placeholders described below.`
    : ' The artist did not supply a title, so propose three suggested titles (formalist, tactile, intent).';

  const criterionBlocks = criterionResults
    .map(
      (r) => `### ${r.criterion} (confidence: ${r.confidence})
Anchor: ${r.anchor.areaSummary}
Evidence pointer: ${r.anchor.evidencePointer}
Visible evidence:
${r.visibleEvidence.map((line) => `- ${line}`).join('\n') || '- (none recorded)'}
Voice A: ${r.voiceACritique}
Voice B: ${r.voiceBSuggestions}
Preserve: ${r.preserve}
Edit plan:
- Target: ${r.editPlan.targetArea}
- Issue: ${r.editPlan.issue}
- Move: ${r.editPlan.intendedChange}
- Expected: ${r.editPlan.expectedOutcome}`
    )
    .join('\n\n');

  const titleInstructionBlock = userTitle
    ? `For suggestedTitles, emit exactly three placeholder entries: { category: "formalist", title: "-", rationale: "Artist supplied a title." } and the same for "tactile" and "intent".`
    : `For suggestedTitles, emit exactly three { category, title, rationale } entries — one for each of "formalist" (structure/layout), "tactile" (material handling), and "intent" (mood/presence). Titles should sound like studio working labels: short, concrete, 2–8 words, sentence case or light title case, no quotes, no gallery clichés. One plain-sentence rationale each, tied to this painting's evidence.`;

  return [
    `Synthesise a unified critique for this painting.`,
    `Style: ${style}. Medium: ${medium}.${titleLine}`,
    '',
    `Vision-stage context:`,
    `- Intent hypothesis: ${evidence.intentHypothesis}`,
    `- Strongest visible qualities: ${evidence.strongestVisibleQualities.join('; ') || '(none recorded)'}`,
    `- Main tensions: ${evidence.mainTensions.join('; ') || '(none recorded)'}`,
    `- Photo quality: ${evidence.photoQualityRead.level} — ${evidence.photoQualityRead.summary}`,
    '',
    `Eight per-criterion critiques to weave together. Each block includes the anchor, evidence pointer, visible evidence, Voice A, Voice B, preserve line, and edit plan. Use the concrete evidence and anchors when choosing the bottleneck and next-session priorities; do not smooth the critique into generic summary language:`,
    '',
    criterionBlocks,
    '',
    `Emit JSON with exactly these fields: summary, overallAnalysis, topPriorities, studioAnalysis, studioChanges, suggestedTitles.`,
    '',
    `**summary** — 2–4 plain sentences that land the overall read. Open with what this painting is genuinely doing (its pictorial intelligence or intent), then name the axis where it is strongest and the axis that most limits it today. Do NOT list every criterion. Do NOT open with filler.`,
    '',
    `**overallAnalysis** — 3–5 sentences expanding the summary with a critic's structural claim: which two or three criteria carry the picture, which one is the real bottleneck, and why — tied back to named anchors and visible evidence from the blocks above. One clear claim per sentence.`,
    '',
    `**topPriorities** — treat this as the painter's NEXT SESSION plan, not a list of aspirations. 2–3 items. First item is the single most important move, imperative voice, tied to a named anchor passage and its edit plan. Remaining items are at most two secondary moves that genuinely depend on or can be tackled alongside the first. Each item is one short sentence.`,
    '',
    `**studioAnalysis.whatWorks** — one or two sentences naming TWO specific visible passages and what they accomplish for the picture (not generic praise).`,
    `**studioAnalysis.whatCouldImprove** — one or two sentences naming the ONE primary structural problem the painter should solve next (not a list).`,
    '',
    `**studioChanges** — 2–5 entries. Each entry is { text, previewCriterion } where previewCriterion is one of: ${CRITERIA_ORDER.join(' | ')}. Each text is a SINGLE-sentence studio instruction that starts with a concrete studio verb and names the passage; previewCriterion must match what the text is asking the painter to change.`,
    '',
    titleInstructionBlock,
    '',
    'Never name critics, teachers, artists, famous artworks, or art-historical movements. Do not compare this image to named painters or movements. The expert panels in the system message are for your reasoning only.',
  ].join('\n');
}

type OpenAIChatCompletion = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string };
};

export async function runCritiqueSynthesisStage(args: {
  apiKey: string;
  model: string;
  style: string;
  medium: string;
  userTitle?: string;
  evidence: CritiqueEvidenceDTO;
  criterionResults: CriterionWritingResult[];
}): Promise<CritiqueSynthesisResult> {
  const start = Date.now();
  const prompt = buildSynthesisPrompt(args);

  const body = {
    model: args.model,
    messages: [
      { role: 'system', content: SYNTHESIS_SYSTEM_MESSAGE },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: SYNTHESIS_JSON_SCHEMA,
    },
    // Synthesis aggregates eight already-grounded per-criterion critiques
    // into overall summary / priorities / studio changes / titles — the
    // heavy lifting (observing the painting, per-criterion judgment, the
    // concrete moves) has already happened upstream. `low` is the fastest
    // setting that still produces a coherent weave + priority ordering;
    // bump to `medium` if synthesis prose visibly thins out in production.
    ...buildOpenAISamplingParam(args.model, { temperature: 0.2, reasoningEffort: 'low' }),
    ...buildOpenAIMaxTokensParam(args.model, 2000),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI synthesis stage error ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAIChatCompletion;
  if (json.error?.message) {
    throw new Error(`OpenAI synthesis stage error: ${json.error.message}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenAI synthesis stage returned empty content.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    throw new Error(
      `OpenAI synthesis stage returned non-JSON content: ${errorMessage(parseError)}; preview=${content.slice(0, 200)}`
    );
  }

  const p = parsed as Record<string, unknown>;
  const studioAnalysis = p.studioAnalysis as Record<string, unknown> | undefined;
  const studioChangesRaw = Array.isArray(p.studioChanges) ? p.studioChanges : [];
  const suggestedTitlesRaw = Array.isArray(p.suggestedTitles) ? p.suggestedTitles : [];
  const topPrioritiesRaw = Array.isArray(p.topPriorities) ? p.topPriorities : [];

  const result: CritiqueSynthesisResult = {
    summary: typeof p.summary === 'string' ? p.summary.trim() : '',
    overallAnalysis: typeof p.overallAnalysis === 'string' ? p.overallAnalysis.trim() : '',
    topPriorities: topPrioritiesRaw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0),
    studioAnalysis: {
      whatWorks:
        typeof studioAnalysis?.whatWorks === 'string' ? studioAnalysis.whatWorks.trim() : '',
      whatCouldImprove:
        typeof studioAnalysis?.whatCouldImprove === 'string'
          ? studioAnalysis.whatCouldImprove.trim()
          : '',
    },
    studioChanges: studioChangesRaw
      .map((entry) => {
        const e = entry as Record<string, unknown>;
        const previewCriterion = typeof e.previewCriterion === 'string' ? e.previewCriterion : '';
        const text = typeof e.text === 'string' ? e.text.trim() : '';
        if (!text || !(CRITERIA_ORDER as readonly string[]).includes(previewCriterion)) {
          return null;
        }
        return { text, previewCriterion: previewCriterion as (typeof CRITERIA_ORDER)[number] };
      })
      .filter((v): v is { text: string; previewCriterion: (typeof CRITERIA_ORDER)[number] } => v !== null),
    suggestedTitles: suggestedTitlesRaw
      .map((entry) => {
        const e = entry as Record<string, unknown>;
        const category = e.category === 'formalist' || e.category === 'tactile' || e.category === 'intent' ? e.category : null;
        const title = typeof e.title === 'string' ? e.title.trim() : '';
        const rationale = typeof e.rationale === 'string' ? e.rationale.trim() : '';
        if (!category || !title) return null;
        return { category, title, rationale };
      })
      .filter(
        (v): v is {
          category: 'formalist' | 'tactile' | 'intent';
          title: string;
          rationale: string;
        } => v !== null
      ),
  };

  const elapsed = Date.now() - start;
  console.log(
    `[critique synthesis] 1 call complete in ${(elapsed / 1000).toFixed(1)}s (model=${args.model})`
  );

  return result;
}
