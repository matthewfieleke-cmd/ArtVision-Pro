import { z } from 'zod';
import { CRITERIA_ORDER } from '../shared/criteria.js';
import type { CritiqueCategory } from '../shared/critiqueContract.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import { buildHighDetailImageMessage } from './openaiVisionContent.js';
import { normalizedRegionSchema, toOpenAIJsonSchema } from './critiqueZodSchemas.js';
import { errorMessage } from './critiqueErrors.js';
import { withOpenAIRetries } from './openaiRetry.js';

const REFINE_REGIONS_SCHEMA = toOpenAIJsonSchema(
  'critique_anchor_regions_refine',
  z.object({
    regions: z
      .array(normalizedRegionSchema)
      .length(CRITERIA_ORDER.length)
      .describe(
        `Exactly ${CRITERIA_ORDER.length} boxes in the SAME order as the criteria list in the user message (first box = first criterion, etc.). Each box must tightly contain the visible passage described for that row.`
      ),
  })
);

function clampRegion(r: z.infer<typeof normalizedRegionSchema>): z.infer<typeof normalizedRegionSchema> {
  let x = Math.min(1, Math.max(0, r.x));
  let y = Math.min(1, Math.max(0, r.y));
  let width = Math.min(1, Math.max(0.02, r.width));
  let height = Math.min(1, Math.max(0.02, r.height));
  if (x + width > 1) width = Math.max(0.02, 1 - x);
  if (y + height > 1) height = Math.max(0.02, 1 - y);
  return { x, y, width, height };
}

function buildRefineSystemPrompt(): string {
  return `You are a vision geometry assistant for a painting critique app.

You receive the painting image and, for each of eight criteria in a fixed order, the anchor text (areaSummary + evidencePointer) that names ONE passage in THIS photo.

Your ONLY job: output normalized axis-aligned bounding boxes (x, y, width, height) in **0–1 coordinates relative to the full image** (x=0 left, y=0 top, width/height as fractions of image width/height).

Rules:
- Look at the **actual photograph**. Each box must **contain the visible motifs** described in that row's text—not empty sky, random background, or a different object.
- **Tight fit**: most pixels inside each box should belong to that passage. Prefer slightly too tight over swallowing unrelated areas.
- **Vertical cues**: "foreground", "tables", "figures seated", "umbrellas", "path", "stairs", "bridge", "railing", "near the bottom" → box must extend **toward the bottom** of the frame (larger y + height). "Sky", "upper canopy only", "distant treetops" → box sits **higher**.
- **Named colors/objects**: if the text names "yellow umbrellas", "red figure", "arched windows", the box must include **those** visible elements.
- **Groups of people**: if the text names multiple figures at a table, include **all** of them in one box.
- **Diagonal structures** (bridge, path): use an **elongated** box along the structure, not a small centered square that misses it.
- If a passage is ambiguous, choose the **most literal** reading that matches the nouns in the anchor text.
- Do not change criterion order. Return exactly ${CRITERIA_ORDER.length} regions.`;
}

function buildRefineUserPayload(categories: CritiqueCategory[]): string {
  const lines = categories.map((c, i) => {
    const a = c.anchor;
    const summary = a?.areaSummary?.trim() ?? '';
    const pointer = a?.evidencePointer?.trim() ?? '';
    return `${i + 1}. ${c.criterion}\n   areaSummary: ${summary}\n   evidencePointer: ${pointer}`;
  });
  return `Criteria and anchors (in order — your regions array MUST match this order 1-to-1):\n\n${lines.join('\n\n')}`;
}

async function callVisionRefineRegions(
  apiKey: string,
  model: string,
  imageDataUrl: string,
  categories: CritiqueCategory[]
): Promise<z.infer<typeof normalizedRegionSchema>[]> {
  const raw = await withOpenAIRetries('anchor-region-refine', async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1600,
        response_format: {
          type: 'json_schema',
          json_schema: REFINE_REGIONS_SCHEMA,
        },
        messages: [
          { role: 'system', content: buildRefineSystemPrompt() },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildRefineUserPayload(categories) },
              buildHighDetailImageMessage(imageDataUrl),
            ],
          },
        ],
      }),
    });

    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err = json.error as { message?: string } | undefined;
      throw new Error(err?.message ?? `OpenAI error ${response.status}`);
    }
    const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
    const text = choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') throw new Error('Empty region refine response');
    return JSON.parse(text) as { regions: z.infer<typeof normalizedRegionSchema>[] };
  });

  const parsed = z
    .object({ regions: z.array(normalizedRegionSchema).length(CRITERIA_ORDER.length) })
    .safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Anchor region refine schema failed: ${parsed.error.message}`);
  }
  return parsed.data.regions.map(clampRegion);
}

/**
 * Re-derives each category's anchor.region from the photograph using a vision-only pass.
 * Painting-agnostic: uses anchor prose + image only. Fails open (keeps existing regions) on error.
 */
export async function refineCritiqueAnchorRegionsFromImage(args: {
  apiKey: string;
  model: string;
  imageDataUrl: string;
  critique: CritiqueResultDTO;
}): Promise<CritiqueResultDTO> {
  const { apiKey, model, imageDataUrl, critique } = args;
  if (process.env.OPENAI_SKIP_ANCHOR_REGION_REFINE === 'true') {
    return critique;
  }
  if (!critique.categories?.length) return critique;

  const ordered = CRITERIA_ORDER.map((criterion) => {
    const cat = critique.categories.find((c) => c.criterion === criterion);
    return cat ?? ({ criterion } as CritiqueCategory);
  });

  if (ordered.some((c) => !c.anchor?.areaSummary || !c.anchor?.evidencePointer)) {
    return critique;
  }

  try {
    const regions = await callVisionRefineRegions(apiKey, model, imageDataUrl, ordered);
    const byCriterion = new Map(
      CRITERIA_ORDER.map((criterion, i) => [criterion, regions[i]!] as const)
    );

    return {
      ...critique,
      categories: critique.categories.map((cat) => {
        const next = byCriterion.get(cat.criterion);
        if (!next || !cat.anchor) return cat;
        return {
          ...cat,
          anchor: {
            ...cat.anchor,
            region: next,
          },
        };
      }),
    };
  } catch (err) {
    console.warn('[critique] anchor region vision refine skipped:', errorMessage(err));
    return critique;
  }
}
