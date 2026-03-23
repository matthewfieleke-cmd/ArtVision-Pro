import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';

const CRITIQUE_JSON_SCHEMA = {
  name: 'painting_critique',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'categories', 'comparisonNote'],
    properties: {
      summary: { type: 'string' },
      comparisonNote: { type: ['string', 'null'] },
      categories: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterion', 'level', 'feedback', 'actionPlan'],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            level: { type: 'string', enum: [...RATING_LEVELS] },
            feedback: { type: 'string' },
            actionPlan: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

function isStyleKey(s: string): s is StyleKey {
  return Object.prototype.hasOwnProperty.call(ARTISTS_BY_STYLE, s);
}

function buildSystemPrompt(style: string, medium: string): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  return `You are a world-class art historian and master painter. Analyze the user's painting image.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

Use these artists as the conceptual benchmark for what "Master" means in this style (technical + expressive bar, not for imitation): ${benchmarks}.

Style-specific master signals (use these to judge proximity to Master; compare the user's image to these observable techniques, not to copying any one artist):
${rubricBlock}

Rate the work on exactly these 8 criteria, in this order, using only these labels:
${CRITERIA_ORDER.map((c: (typeof CRITERIA_ORDER)[number], i: number) => `${i + 1}. ${c}`).join('\n')}

Rating scale per criterion: Beginner, Intermediate, Advanced, Master.
- Master = work that could plausibly sit alongside the named masters in technical control and expressive force for this style/medium (allow for smartphone photo limitations—judge the painting, mention photo issues briefly if needed).

For each criterion:
- feedback: 2–4 sentences. Cite 1–2 concrete visual facts from the user's image (e.g. a region, edge behavior, value pattern, color chord). Relate the gap or strength to at least one rubric signal above; you may name a master from the benchmark list only when it clarifies the comparison—sparingly, not every sentence.
- actionPlan: concrete, specific steps to reach the *next* level up (if already Master, how to deepen or sustain).

Also write summary: 2–4 sentences on overall strengths and the single highest-leverage improvement.

If previous image + prior critique JSON are provided, you MUST set comparisonNote (non-null string): what improved, what regressed or stayed weak, and what still needs work—reference specific areas of the painting. If no previous version, set comparisonNote to null.

Stay constructive and specific. Avoid generic praise.`;
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  return { mime: m[1]!, base64: m[2]! };
}

function validateResult(raw: unknown): CritiqueResultDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('Invalid critique: summary');
  const cats = o.categories;
  if (!Array.isArray(cats) || cats.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid critique: categories length');
  }
  const categories = CRITERIA_ORDER.map((expected: (typeof CRITERIA_ORDER)[number], i: number) => {
    const c = cats[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid category');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid criterion at index ${i}`);
    }
    if (typeof r.level !== 'string' || !RATING_LEVELS.includes(r.level as (typeof RATING_LEVELS)[number])) {
      throw new Error(`Invalid level for ${expected}`);
    }
    if (typeof r.feedback !== 'string' || typeof r.actionPlan !== 'string') {
      throw new Error(`Invalid text for ${expected}`);
    }
    return {
      criterion: r.criterion as (typeof CRITERIA_ORDER)[number],
      level: r.level as (typeof RATING_LEVELS)[number],
      feedback: r.feedback,
      actionPlan: r.actionPlan,
    };
  });
  const cn = o.comparisonNote;
  if (cn !== null && (typeof cn !== 'string' || cn.length === 0)) {
    throw new Error('Invalid comparisonNote');
  }
  return {
    summary: o.summary,
    categories,
    ...(typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
  };
}

export async function runOpenAICritique(
  apiKey: string,
  body: CritiqueRequestBody,
  options?: { model?: string }
): Promise<CritiqueResultDTO> {
  const model = options?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o';
  const { mime, base64 } = parseDataUrl(body.imageDataUrl);

  const titleLine =
    typeof body.paintingTitle === 'string' && body.paintingTitle.trim().length > 0
      ? ` The artist titled this work: "${body.paintingTitle.trim()}". Use that title when referring to the piece in summary and feedback where natural.`
      : '';

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } }
  > = [
    {
      type: 'text',
      text: `Analyze this painting. Style: ${body.style}. Medium: ${body.medium}.${titleLine}${
        body.previousCritique && body.previousImageDataUrl
          ? '\n\nA previous photo of the same painting is attached second, followed by the prior critique JSON.'
          : ''
      }`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' },
    },
  ];

  if (body.previousImageDataUrl && body.previousCritique) {
    const prev = parseDataUrl(body.previousImageDataUrl);
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${prev.mime};base64,${prev.base64}`, detail: 'high' },
    });
    userContent.push({
      type: 'text',
      text: `Prior critique JSON (for comparison only):\n${JSON.stringify(body.previousCritique)}`,
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: {
        type: 'json_schema',
        json_schema: CRITIQUE_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: buildSystemPrompt(body.style, body.medium) },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${res.status}`);
  }

  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty model response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Model returned non-JSON');
  }

  const validated = validateResult(parsed);
  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...validated, paintingTitle: trimmedTitle } : validated;
}
