import { ARTISTS_BY_STYLE, type StyleKey } from '../shared/artists.js';
import type { CritiqueRequestBody } from './critiqueTypes.js';
import { CRITIQUE_JSON_SCHEMA, buildCritiqueSchemaInstruction } from './critiqueSchemas.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';

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
- practiceExercise should be a short study or drill that supports the next pass on this piece, not a generic master copy unless evidence supports it.`;
  }
  if (state === 'likely_finished') {
    return `${base}

- Treat this as closer to presentation-ready: focus on selective refinements, protecting what already works, and subtle calibration—not wholesale restructuring unless evidence demands it.
- nextSteps should read as finishing passes: small targeted adjustments, varnish/photo/presentation awareness only when grounded in evidence.
- Avoid pushing the artist to "rebuild big shapes" unless criterion evidence clearly shows structural failure.`;
  }
  return `${base}

- Finish state is ambiguous: balance structure-level and selective advice; name what would change your mind in one more session vs. what is already reading resolved.`;
}

export function buildWritingPrompt(style: string, evidence: CritiqueEvidenceDTO): string {
  const benchmarks = isStyleKey(style)
    ? ARTISTS_BY_STYLE[style].join(', ')
    : 'the masters listed for the selected style';
  return `You are stage 2 of a painting critique system.

You are now writing the critique from already extracted evidence.

${completionToneBlock(evidence)}

Rules:
- Use ONLY the supplied evidence JSON as your factual base.
- Do not invent visible claims that are not supported by the evidence.
- Judge the painting on its own terms.
- Do not assume every painting needs stronger focal hierarchy, more contrast, sharper edges, or more clarity.
- If the evidence suggests a strong work, let the critique say the issue is modest.
- If the evidence suggests the work benefits from ambiguity, distributed attention, softness, or compression, preserve those qualities.
- Your usefulness comes from precision, not from forced criticism.
- Do NOT overpraise. "Master" should be rare and should only be used when the evidence shows unusually strong, intentional, and sustained control in that criterion.
- If the work is strong but still developing, prefer "Advanced" over "Master."
- If no real problem is visible, say so plainly instead of manufacturing a weakness.
- Top-level nextSteps (3–4 items): each must be a distinct studio move that names **specific content from the evidence**—not generic zones. Good: "On the right, separate the cat from the table with a darker value in the table plane…" / "Where the reds meet the blues along the sleeve, glaze a thin neutral…" Bad: "In one area…", "the weakest passage", "two color families", "one important contour", "the neighbor", "supporting zone" without naming what is actually in the picture.
- Every nextStep must include at least one **identifiable subject** from the evidence (figure, animal, object, named color, or two concrete locators such as "background, left edge" plus what it borders). If the evidence names a motif, repeat that motif in the step.
- No two nextSteps should repeat the same move or the same named passage.
- If a work is rated below Master in any criterion, every next step must be a true revision move the artist can do now on this image, not general practice advice.
- For non-master work, do not let "preserve" language replace correction. Name the exact passage or relationship to adjust.
- Prefer verbs like soften, darken, simplify, group, separate, lose, sharpen, compress, cool, warm, straighten, widen, narrow, or restate when they are justified by the evidence.
- Avoid empty advisory language such as "continue to explore," "consider adding," "experiment with," or "maintain" unless the sentence also names one visible area and one specific adjustment.
- Respect medium limits:
  - Drawing: do not suggest color variation or painterly color harmony fixes unless the drawing actually uses color.
  - Watercolor: prefer wash control, edge timing, reserving lights, transparent layering, and bloom/backrun handling.
  - Pastel: prefer stroke pressure, tooth coverage, layering, edge softness, and control of powdery chroma.
  - Oil on Canvas: prefer paint thickness, scumble/glaze, temperature shifts, edge weight, and shape/value editing.
- For strong finished paintings, at most one next step may be preservation-only; the rest must still name something concrete in the picture to refine or protect in place.
- Per category, actionPlan must be exactly ONE sentence with no numbering: the single clearest adjustment for THAT criterion in THIS painting, tied to visible evidence (not a generic exercise).

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

- Bad: "Continue exploring bold color contrasts."
- Better: "In the upper-right foliage, keep the red-violet intensity, but quiet the one neighboring passage whose equal chroma prevents the main accent from landing."

- Bad: "Experiment with different brushwork techniques."
- Better: "In the foreground path, switch two or three repeated strokes to broader, flatter marks so the path reads as one plane before the eye reaches the trees."

- Bad: "Where two color families meet in the painting, adjust temperature…"
- Better: "Where the cadmium red scarf meets the cool blue-gray background, drag a scumbled violet-gray bridge so the edge reads as atmosphere instead of a sticker outline."

- Bad: "Add subtle color variation" for a graphite or charcoal drawing.
- Better: "Use line weight and value grouping, not added color, to separate the lit side of the form from the shadow-facing side."

Return JSON only matching the schema.`;
}

export async function runCritiqueWritingStage(
  apiKey: string,
  model: string,
  style: string,
  body: CritiqueRequestBody,
  evidence: CritiqueEvidenceDTO
): Promise<unknown> {
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
        { role: 'system', content: buildWritingPrompt(style, evidence) },
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

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Model returned non-JSON');
  }
}
