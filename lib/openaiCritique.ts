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
    required: ['summary', 'categories', 'comparisonNote', 'overallConfidence', 'photoQuality'],
    properties: {
      summary: { type: 'string' },
      comparisonNote: { type: ['string', 'null'] },
      overallConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      photoQuality: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'summary', 'issues', 'tips'],
        properties: {
          level: { type: 'string', enum: ['poor', 'fair', 'good'] },
          summary: { type: 'string' },
          issues: { type: 'array', items: { type: 'string' } },
          tips: { type: 'array', items: { type: 'string' } },
        },
      },
      categories: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'criterion',
            'level',
            'feedback',
            'actionPlan',
            'confidence',
            'evidenceSignals',
            'preserve',
            'practiceExercise',
            'nextTarget',
            'subskills',
          ],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            level: { type: 'string', enum: [...RATING_LEVELS] },
            feedback: { type: 'string' },
            actionPlan: { type: 'string' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            evidenceSignals: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
            },
            preserve: { type: 'string' },
            practiceExercise: { type: 'string' },
            nextTarget: { type: 'string' },
            subskills: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'score', 'level'],
                properties: {
                  label: { type: 'string' },
                  score: { type: 'number' },
                  level: { type: 'string', enum: [...RATING_LEVELS] },
                },
              },
            },
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
  return `You are a senior atelier instructor and working painter. Your job is to help THIS artist improve THIS specific piece—not to flatter them.

Context:
- Declared style: ${style}
- Declared medium: ${medium}

Benchmark what "Master" means in this style (technical + expressive bar, not imitation): ${benchmarks}.

Style-specific master signals (judge the image against these observable techniques; do not ask them to copy a master):
${rubricBlock}

Before you write JSON, mentally scan the image in quadrants (upper-left, upper-right, lower-left, lower-right) and note focal area vs periphery, largest value shapes, and where edges are hard vs soft. Use that scan in your writing.

Rate the work on exactly these 8 criteria, in this order, using only these labels:
${CRITERIA_ORDER.map((c: (typeof CRITERIA_ORDER)[number], i: number) => `${i + 1}. ${c}`).join('\n')}

Rating scale per criterion: Beginner, Intermediate, Advanced, Master.
- Master = could plausibly sit with the named benchmarks in control and intent for this style/medium. Account for phone photos (glare, skew, compression)—name artifacts briefly if they limit what you see, then judge the painting.

Per criterion — feedback (string):
- Minimum 3 sentences. Every criterion must mention at least one concrete location (e.g. upper-left sky, center figure, foreground shadow, right edge) or relational cue (foreground vs background, focal vs supporting area).
- Cite observable facts: value (light/dark grouping), edge quality (sharp/lost), color temperature, brush handling, proportion, negative space, rhythm—whichever fits that criterion.
- Name the main issue or strength in painterly terms; connect it to at least one rubric signal above.
- Forbidden: empty praise ("beautiful", "great job") without a tied observation; generic advice that could apply to any painting; repeating the same sentence across criteria—each criterion must add new, criterion-specific detail.

Per criterion — actionPlan (string):
- 3–5 short numbered steps (1. 2. 3.) the artist can do in the studio on the current piece or its next layer. Each step names WHAT to change WHERE (area of the canvas) and HOW (tool, edge, value shift, temperature, etc.).
- Target the *next* level up from your rating. If already Master, give advanced refinement or sustainment steps (subtle orchestration, risk-taking within control).

Per criterion — confidence (string):
- high, medium, or low depending on how reliably the photo supports this judgment.
- Downgrade confidence when glare, blur, skew, crop, or low resolution make the call uncertain.

Per criterion — evidenceSignals (array of 2-4 strings):
- Short observable reason codes behind the grade (for example: "foreground shadow family stays compressed", "sharpest edge is on the right cheek", "palette splits into unrelated cool and warm zones").
- These should be concise fragments, not full sentences.

Per criterion — preserve (string):
- One sentence on what is already working and should survive the next revision.

Per criterion — practiceExercise (string):
- One short exercise for training this skill outside the main piece.

Per criterion — nextTarget (string):
- A brief coaching label framed as the next target, e.g. "Push edge control toward Advanced."

Per criterion — subskills (array):
- Return 2-4 sub-skills that explain the category grade.
- Each subskill has label, score (0-1), and level.
- Keep them concrete and observable from the photo, not generic art-school abstractions.

Summary (string):
- 3–5 sentences: strongest 1–2 passages (where and why), the single biggest leverage gap, and how fixing that gap would change the read of the whole piece.

overallConfidence (string):
- high, medium, or low for the critique as a whole.

photoQuality (object):
- Report the reliability of the photo itself.
- level = good, fair, or poor.
- summary = one sentence on whether the photo is trustworthy for critique.
- issues = short bullets about glare, blur, skew, crop, clipped values, or weak color capture.
- tips = short bullets on how to re-shoot for better feedback.

If previous image + prior critique JSON are provided, set comparisonNote (non-null string): what visibly improved, what regressed or stalled, and what to tackle next—name regions and tie to prior feedback when relevant. If no previous version, set comparisonNote to null.

Tone: direct, respectful, specific. Assume the artist wants rigor.`;
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
  if (
    typeof o.overallConfidence !== 'string' ||
    !(['low', 'medium', 'high'] as const).includes(o.overallConfidence as 'low' | 'medium' | 'high')
  ) {
    throw new Error('Invalid critique: overallConfidence');
  }
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
    if (
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid confidence for ${expected}`);
    }
    if (!Array.isArray(r.evidenceSignals) || r.evidenceSignals.some((v) => typeof v !== 'string')) {
      throw new Error(`Invalid evidence signals for ${expected}`);
    }
    if (
      typeof r.preserve !== 'string' ||
      typeof r.practiceExercise !== 'string' ||
      typeof r.nextTarget !== 'string'
    ) {
      throw new Error(`Invalid coaching metadata for ${expected}`);
    }
    if (
      !Array.isArray(r.subskills) ||
      r.subskills.length < 2 ||
      r.subskills.length > 4 ||
      r.subskills.some((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const sub = entry as Record<string, unknown>;
        return (
          typeof sub.label !== 'string' ||
          typeof sub.score !== 'number' ||
          sub.score < 0 ||
          sub.score > 1 ||
          typeof sub.level !== 'string' ||
          !RATING_LEVELS.includes(sub.level as (typeof RATING_LEVELS)[number])
        );
      })
    ) {
      throw new Error(`Invalid subskills for ${expected}`);
    }
    return {
      criterion: r.criterion as (typeof CRITERIA_ORDER)[number],
      level: r.level as (typeof RATING_LEVELS)[number],
      feedback: r.feedback,
      actionPlan: r.actionPlan,
      confidence: r.confidence as 'low' | 'medium' | 'high',
      evidenceSignals: r.evidenceSignals as string[],
      preserve: r.preserve,
      practiceExercise: r.practiceExercise,
      nextTarget: r.nextTarget,
      subskills: r.subskills as Array<{
        label: string;
        score: number;
        level: (typeof RATING_LEVELS)[number];
      }>,
    };
  });
  const cn = o.comparisonNote;
  if (cn !== null && (typeof cn !== 'string' || cn.length === 0)) {
    throw new Error('Invalid comparisonNote');
  }
  const photoQuality = o.photoQuality;
  if (!photoQuality || typeof photoQuality !== 'object') throw new Error('Invalid photoQuality');
  const pq = photoQuality as Record<string, unknown>;
  if (
    typeof pq.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(pq.level as 'poor' | 'fair' | 'good') ||
    typeof pq.summary !== 'string' ||
    !Array.isArray(pq.issues) ||
    pq.issues.some((v) => typeof v !== 'string') ||
    !Array.isArray(pq.tips) ||
    pq.tips.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid photoQuality fields');
  }
  return {
    summary: o.summary,
    categories,
    overallConfidence: o.overallConfidence as 'low' | 'medium' | 'high',
    photoQuality: {
      level: pq.level as 'poor' | 'fair' | 'good',
      summary: pq.summary,
      issues: pq.issues as string[],
      tips: pq.tips as string[],
    },
    analysisSource: 'api',
    ...(typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
  };
}

export async function runOpenAICritique(
  apiKey: string,
  body: CritiqueRequestBody,
  options?: { model?: string }
): Promise<CritiqueResultDTO> {
  const model =
    options?.model ??
    process.env.OPENAI_CRITIQUE_MODEL ??
    process.env.OPENAI_MODEL ??
    'gpt-4o';
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
      text: `Analyze this painting for studio use. Style: ${body.style}. Medium: ${body.medium}.${titleLine}

Ground every criterion in what is visible in the photo. Prefer "in the ___ area of the painting" over abstract wording.${
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
      temperature: 0.28,
      max_tokens: 4500,
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
