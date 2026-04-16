import { z } from 'zod';
import { CRITERIA_ORDER } from '../shared/criteria.js';
import type { CritiqueCategory } from '../shared/critiqueContract.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import { buildHighDetailImageMessage } from './openaiVisionContent.js';
import { normalizedRegionSchema, toOpenAIJsonSchema } from './critiqueZodSchemas.js';
import { errorMessage } from './critiqueErrors.js';
import { withOpenAIRetries } from './openaiRetry.js';
import { buildOpenAIMaxTokensParam } from './openaiModels.js';

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
  const x = Math.min(1, Math.max(0, r.x));
  const y = Math.min(1, Math.max(0, r.y));
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
- **Tight fit**: most pixels inside each box should belong to that passage—**except** when the anchor names a **broad horizontal band** (see below), where width should span the scene even if that admits some adjacent pixels at the edges.
- **Vertical cues**: "foreground", "tables", "figures seated", "umbrellas", "path", "stairs", "bridge", "railing", "near the bottom" → box must extend **toward the bottom** of the frame (larger y + height). "Sky", "upper canopy only", "distant treetops" → box sits **higher**.
- **Horizontal boundaries / junctions** (phrases like *where X meets Y*, *X meeting Y*, *horizon*, *shoreline*, *waterline*, *edge of the sea*, *sea and sky*): the box must **straddle that boundary**. Include pixels **on both sides** of the line (e.g. both water and sky) so the **actual dividing line** lies **inside** the rectangle. Do **not** place the box entirely in the sky when the text names the sea, the horizon, or both sides of a color break at the horizon—**center the band vertically on that line** and use enough height (often ~0.06–0.18 of image height) to capture the transition.
- **Small scattered motifs** (flocks, distant birds, boats, figures, buoys, posts): find **every** instance that matches the description in the relevant band of the image; the box must be the **smallest axis-aligned rectangle that contains all of them**. A box that only covers empty sky while the described marks sit **outside** it is wrong. If marks sit in a cluster, center on the cluster, not on an unrelated patch of sky.
- **Contrast pairs** (*A against B*, *A on B*): include **both** A and the adjacent B so the relationship is visible—often extend the box to span from the objects through the background they contrast with.
- **Named object + secondary context** (*X under the sky*, *X against the horizon*, *distant X*, *small X in the field*): **locate X first**. The box must contain the **named structure or mass** (building, house, boat, figure, etc.), not only the sky, trees, or haze around it. After X is included, you may add a modest band of the named context (sky, hill) so the relationship reads—**never** return a box that lies entirely in empty sky or generic background while the named X sits **outside** the rectangle.
- **Object-first rule:** when the anchor names a specific object plus a relation or surrounding context, the **named object itself** is the required center of the box. First locate that object; only then widen enough to show the relation. A similar nearby edge, silhouette, or brightness pattern does **not** count unless the named object is actually inside the box.
- **Anchor hierarchy rule:** if the anchor contains both an object noun and a relational phrase, the object noun has priority. The relation helps define the crop, but it does not replace the requirement to include the named object.
- **Specific noun priority:** when the anchor includes one specific object plus broader location context, prioritize the **most specific named object or passage** first and treat the surrounding phrase as location context only. Example pattern: in "the small boat under the bridge", prioritize **boat** first and **under the bridge** second.
- **Text / sign / lettering rule:** if the anchor names a sign, quoted word, letters, numbers, label, banner, poster, painted text, or any text-bearing object, the box must center on the **actual text-bearing object itself**. Do **not** substitute a nearby doorway, window, porch light, bright ornament, or other more salient feature in the same area.
- **No proxy-object substitution:** do **not** replace the named object with a nearby object just because it is brighter, larger, more central, or easier to see. A nearby glow is not a sign; a skirt fold is not a hand; a torso highlight is not a shoulder passage.
- **Small-target rule:** if the anchor names a small object or local passage (hand, cup rim, earring, sign, candle, eye, small window, lettered decoration, small boat, etc.), prefer a **tight local box** around that object rather than a medium box centered on the surrounding body, building, or room.
- **Plural repeated elements** (*posts*, *rails*, *pickets*, *figures*, *windows*, *boats*): when several clear repeats appear **along a line** (a row in the foreground, a fence, a pier), treat the passage as the **group**: widen (or lengthen) the box so **multiple** repeats are inside—not a single instance on one edge unless only one is visible.
- **Wide horizontal bands** (*sky above…*, *cloud band*, *treeline against sky*, *ridge across the top*): when the text names a **layer** that spans the composition, the box should cover **most of the image width** (typically **width ≥ 0.55** unless the motif is clearly localized to one side). Avoid a small corner crop that could be any patch of sky.
- **Named colors/objects**: if the text names specific colors or objects, the box must include **those** visible elements.
- **Groups of people**: if the text names multiple figures at a table, include **all** of them in one box.
- **Diagonal structures** (bridge, path): use an **elongated** box along the structure, not a small centered square that misses it.
- Examples:
- Anchor: "the illuminated 'JOY' sign on the porch" → correct: a tight box around the sign/letters; wrong: a box on a brighter doorway or porch light nearby.
- Anchor: "the hand on the floor" → correct: the hand and its floor contact; wrong: nearby cloth, knee, or leg because they are larger.
- Anchor: "the lit shoulder against the dark cloth" → correct: the shoulder passage itself; wrong: a larger box drifting to the chest or torso because it is more central.
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
        temperature: 0.05,
        ...buildOpenAIMaxTokensParam(model, 1600),
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
