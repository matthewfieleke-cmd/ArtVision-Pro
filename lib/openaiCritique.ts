import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import { CRITERIA_ORDER, RATING_LEVELS } from '../shared/criteria.js';
import { formatRubricForPrompt } from '../shared/masterCriteriaRubric.js';
import { applyCritiqueGuardrails } from './critiqueAudit.js';
import type { CritiqueRequestBody, CritiqueResultDTO } from './critiqueTypes.js';

const CRITIQUE_EVIDENCE_JSON_SCHEMA = {
  name: 'painting_critique_evidence',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'intentHypothesis',
      'strongestVisibleQualities',
      'mainTensions',
      'criterionEvidence',
      'photoQualityRead',
      'comparisonObservations',
    ],
    properties: {
      intentHypothesis: { type: 'string' },
      strongestVisibleQualities: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      mainTensions: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      photoQualityRead: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'summary', 'issues'],
        properties: {
          level: { type: 'string', enum: ['poor', 'fair', 'good'] },
          summary: { type: 'string' },
          issues: {
            type: 'array',
            minItems: 0,
            maxItems: 4,
            items: { type: 'string' },
          },
        },
      },
      comparisonObservations: {
        type: 'array',
        minItems: 0,
        maxItems: 4,
        items: { type: 'string' },
      },
      criterionEvidence: {
        type: 'array',
        minItems: CRITERIA_ORDER.length,
        maxItems: CRITERIA_ORDER.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterion', 'visibleEvidence', 'strengthRead', 'tensionRead', 'preserve', 'confidence'],
          properties: {
            criterion: { type: 'string', enum: [...CRITERIA_ORDER] },
            visibleEvidence: {
              type: 'array',
              minItems: 2,
              maxItems: 5,
              items: { type: 'string' },
            },
            strengthRead: { type: 'string' },
            tensionRead: { type: 'string' },
            preserve: { type: 'string' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
    },
  },
} as const;

const CRITIQUE_JSON_SCHEMA = {
  name: 'painting_critique',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'intent',
      'working',
      'mainIssue',
      'nextSteps',
      'preserveSummary',
      'categories',
      'comparisonNote',
      'overallConfidence',
      'photoQuality',
    ],
    properties: {
      summary: { type: 'string' },
      intent: { type: 'string' },
      working: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: { type: 'string' },
      },
      mainIssue: { type: 'string' },
      nextSteps: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: { type: 'string' },
      },
      preserveSummary: { type: 'string' },
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

type CritiqueEvidenceDTO = {
  intentHypothesis: string;
  strongestVisibleQualities: string[];
  mainTensions: string[];
  photoQualityRead: {
    level: 'poor' | 'fair' | 'good';
    summary: string;
    issues: string[];
  };
  comparisonObservations: string[];
  criterionEvidence: Array<{
    criterion: (typeof CRITERIA_ORDER)[number];
    visibleEvidence: string[];
    strengthRead: string;
    tensionRead: string;
    preserve: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
};

function buildEvidencePrompt(style: string, medium: string): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  const rubricBlock = isStyleKey(style) ? formatRubricForPrompt(style) : '';
  return `You are stage 1 of a painting critique system.

Your job is NOT to critique yet. Your job is only to extract visible evidence and tensions from the painting.

Rules:
- Stay at the level of evidence, tensions, and what should be preserved.
- Do not prescribe fixes.
- Do not invent weaknesses just because the painting could be different.
- If a painting is already strong in a criterion, say so plainly.
- If attention is distributed, atmospheric, or intentionally open, describe that as a condition of the work instead of forcing a single focal demand.
- If value compression, softness, or ambiguity seem intentional and useful, record that instead of treating it automatically as a flaw.

Context:
- Declared style: ${style}
- Declared medium: ${medium}
- Benchmarks for what "Master" means in this style: ${benchmarks}

Style-specific master signals:
${rubricBlock}

For each criterion, provide:
- visibleEvidence: short concrete observations tied to areas of the canvas
- strengthRead: what already works in that criterion
- tensionRead: what seems unresolved, if anything
- preserve: what should survive revision
- confidence: high / medium / low

Return JSON only.`;
}

function buildWritingPrompt(style: string): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  return `You are stage 2 of a painting critique system.

You are now writing the critique from already extracted evidence.

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Do not invent visible claims that are not supported by the evidence.
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Your usefulness comes from precision, not from forced criticism.

Benchmarks for what "Master" means in this style: ${benchmarks}

Anti-pattern examples:
- Bad: "The painting needs a stronger focal point."
- Better: "The eye already moves through several active areas. Keep that distributed attention, but quiet the one competing accent that interrupts the painting's main rhythm."

- Bad: "Increase contrast to create more depth."
- Better: "The compressed value range is part of the mood. Keep that compression, but separate one important shape from its neighbor with a smaller value and temperature shift."

- Bad: "Refine the edges to improve clarity."
- Better: "Most of the softness is doing useful atmospheric work. Keep the broad soft passages, but sharpen only the one edge that truly needs to hold the eye."

- Bad: "Make the composition more dynamic."
- Better: "The stillness is part of the work's effect. Instead of forcing more drama, adjust one directional cue so the eye moves more naturally through the existing calm."

- Bad: "Harmonize the colors."
- Better: "Do not flatten the color differences that give the painting life. Keep the vivid accents, but quiet the one passage that breaks the painting's color world."

Return JSON only matching the schema.`;
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  return { mime: m[1]!, base64: m[2]! };
}

function buildCritiqueSchemaInstruction(): string {
  return `Return JSON with:
- summary
- intent
- working
- mainIssue
- nextSteps
- preserveSummary
- categories
- comparisonNote
- overallConfidence
- photoQuality

For each criterion:
- feedback: 3+ sentences grounded in visible evidence
- actionPlan: 3-5 numbered steps tied to exact areas and concrete painterly moves
- confidence
- evidenceSignals
- preserve
- practiceExercise
- nextTarget
- subskills`;
}

function fallbackSubskills(
  criterion: (typeof CRITERIA_ORDER)[number],
  level: (typeof RATING_LEVELS)[number],
  evidenceSignals: string[]
): Array<{
  label: string;
  score: number;
  level: (typeof RATING_LEVELS)[number];
}> {
  const fallbackLabels: Record<(typeof CRITERIA_ORDER)[number], [string, string]> = {
    'Intent and necessity': ['Coherence of aim', 'Support from formal choices'],
    'Composition and shape structure': ['Big-shape organization', 'Eye path control'],
    'Value and light structure': ['Light-dark grouping', 'Range control'],
    'Color relationships': ['Palette harmony', 'Temperature control'],
    'Drawing, proportion, and spatial form': ['Shape placement', 'Spatial construction'],
    'Edge and focus control': ['Edge hierarchy', 'Focus placement'],
    'Surface and medium handling': ['Mark economy', 'Surface character'],
    'Presence, point of view, and human force': ['Atmospheric force', 'Point of view'],
  };

  const numericLevel =
    level === 'Master' ? 0.92 : level === 'Advanced' ? 0.74 : level === 'Intermediate' ? 0.5 : 0.28;

  const fromEvidence = evidenceSignals
    .slice(0, 2)
    .map((signal, idx) => ({
      label: signal
        .replace(/^[a-z]/, (m) => m.toUpperCase())
        .replace(/\.$/, '')
        .slice(0, 48),
      score: Math.max(0, Math.min(1, numericLevel - idx * 0.04)),
      level,
    }))
    .filter((entry) => entry.label.length > 0);

  if (fromEvidence.length >= 2) return fromEvidence;

  const [labelA, labelB] = fallbackLabels[criterion];
  return [
    { label: labelA, score: numericLevel, level },
    { label: labelB, score: Math.max(0, Math.min(1, numericLevel - 0.06)), level },
  ];
}

function validateEvidenceResult(raw: unknown): CritiqueEvidenceDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid evidence API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.intentHypothesis !== 'string') throw new Error('Invalid evidence: intentHypothesis');
  if (
    !Array.isArray(o.strongestVisibleQualities) ||
    o.strongestVisibleQualities.length < 2 ||
    o.strongestVisibleQualities.length > 4 ||
    o.strongestVisibleQualities.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: strongestVisibleQualities');
  }
  if (
    !Array.isArray(o.mainTensions) ||
    o.mainTensions.length < 2 ||
    o.mainTensions.length > 4 ||
    o.mainTensions.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: mainTensions');
  }
  if (
    !o.photoQualityRead ||
    typeof o.photoQualityRead !== 'object' ||
    !Array.isArray((o.photoQualityRead as Record<string, unknown>).issues)
  ) {
    throw new Error('Invalid evidence: photoQualityRead');
  }
  const p = o.photoQualityRead as Record<string, unknown>;
  if (
    typeof p.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(p.level as 'poor' | 'fair' | 'good') ||
    typeof p.summary !== 'string' ||
    (p.issues as unknown[]).some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: photoQualityRead fields');
  }
  if (
    !Array.isArray(o.comparisonObservations) ||
    o.comparisonObservations.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: comparisonObservations');
  }
  const criterionEvidence = o.criterionEvidence;
  if (!Array.isArray(criterionEvidence) || criterionEvidence.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid evidence: criterionEvidence length');
  }
  const normalized = CRITERIA_ORDER.map((expected, i) => {
    const c = criterionEvidence[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid evidence criterion');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid evidence criterion at index ${i}`);
    }
    if (
      !Array.isArray(r.visibleEvidence) ||
      r.visibleEvidence.length < 2 ||
      r.visibleEvidence.length > 5 ||
      r.visibleEvidence.some((v) => typeof v !== 'string')
    ) {
      throw new Error(`Invalid visibleEvidence for ${expected}`);
    }
    if (
      typeof r.strengthRead !== 'string' ||
      typeof r.tensionRead !== 'string' ||
      typeof r.preserve !== 'string' ||
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid evidence fields for ${expected}`);
    }
    return {
      criterion: expected,
      visibleEvidence: r.visibleEvidence as string[],
      strengthRead: r.strengthRead,
      tensionRead: r.tensionRead,
      preserve: r.preserve,
      confidence: r.confidence as 'low' | 'medium' | 'high',
    };
  });

  return {
    intentHypothesis: o.intentHypothesis,
    strongestVisibleQualities: o.strongestVisibleQualities as string[],
    mainTensions: o.mainTensions as string[],
    photoQualityRead: {
      level: p.level as 'poor' | 'fair' | 'good',
      summary: p.summary,
      issues: p.issues as string[],
    },
    comparisonObservations: o.comparisonObservations as string[],
    criterionEvidence: normalized,
  };
}

function validateResult(raw: unknown): CritiqueResultDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('Invalid critique: summary');
  if (typeof o.intent !== 'string') throw new Error('Invalid critique: intent');
  if (!Array.isArray(o.working) || o.working.length < 2 || o.working.length > 3 || o.working.some((v) => typeof v !== 'string')) {
    throw new Error('Invalid critique: working');
  }
  if (typeof o.mainIssue !== 'string') throw new Error('Invalid critique: mainIssue');
  if (
    !Array.isArray(o.nextSteps) ||
    o.nextSteps.length < 2 ||
    o.nextSteps.length > 3 ||
    o.nextSteps.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid critique: nextSteps');
  }
  if (typeof o.preserveSummary !== 'string') throw new Error('Invalid critique: preserveSummary');
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
    const subskills =
      Array.isArray(r.subskills) &&
      r.subskills.length >= 2 &&
      r.subskills.length <= 4 &&
      !r.subskills.some((entry) => {
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
        ? (r.subskills as Array<{
            label: string;
            score: number;
            level: (typeof RATING_LEVELS)[number];
          }>)
        : fallbackSubskills(
            expected,
            r.level as (typeof RATING_LEVELS)[number],
            Array.isArray(r.evidenceSignals) ? (r.evidenceSignals as string[]) : []
          );
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
      subskills,
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
    simpleFeedback: {
      intent: o.intent,
      working: o.working as string[],
      mainIssue: o.mainIssue,
      nextSteps: o.nextSteps as string[],
      preserve: o.preserveSummary,
    },
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

  const evidenceRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.28,
      max_tokens: 3200,
      response_format: {
        type: 'json_schema',
        json_schema: CRITIQUE_EVIDENCE_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: buildEvidencePrompt(body.style, body.medium) },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const evidenceJson = (await evidenceRes.json()) as Record<string, unknown>;
  if (!evidenceRes.ok) {
    const err = evidenceJson.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${evidenceRes.status}`);
  }
  const evidenceChoices = evidenceJson.choices as Array<{ message?: { content?: string } }> | undefined;
  const evidenceText = evidenceChoices?.[0]?.message?.content;
  if (!evidenceText || typeof evidenceText !== 'string') throw new Error('Empty evidence response');

  let evidenceParsed: unknown;
  try {
    evidenceParsed = JSON.parse(evidenceText);
  } catch {
    throw new Error('Evidence stage returned non-JSON');
  }

  const evidence = validateEvidenceResult(evidenceParsed);

  const writingRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.22,
      max_tokens: 4500,
      response_format: {
        type: 'json_schema',
        json_schema: CRITIQUE_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: buildWritingPrompt(body.style) },
        {
          role: 'user',
          content: `Use this evidence JSON as your only factual base:\n${JSON.stringify(evidence)}\n\n${buildCritiqueSchemaInstruction()}`,
        },
      ],
    }),
  });

  const json = (await writingRes.json()) as Record<string, unknown>;
  if (!writingRes.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI error ${writingRes.status}`);
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

  const validated = applyCritiqueGuardrails(validateResult(parsed));
  const trimmedTitle =
    typeof body.paintingTitle === 'string' ? body.paintingTitle.trim() : '';
  return trimmedTitle ? { ...validated, paintingTitle: trimmedTitle } : validated;
}
