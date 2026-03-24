import { getCriterionMasterSignals } from '../shared/masterCriteriaRubric.js';
import type { PreviewEditRequestBody, PreviewEditResponseBody } from './previewEditTypes.js';
import {
  bufferToApiInputPng,
  getImageDimensions,
  pickImagesEditSize,
  resizeEditOutputToMatchUpload,
} from './previewImageResize.js';

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  const mime = m[1]!.toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    throw new Error('Image must be PNG, JPEG, or WebP for editing');
  }
  return { mime, buffer: Buffer.from(m[2]!, 'base64') };
}

function outputMimeFromInput(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mime.includes('png')) return 'image/png';
  if (mime.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

const EDIT_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;
type EditQuality = (typeof EDIT_QUALITIES)[number];

function resolveEditQuality(): EditQuality {
  const raw = (process.env.OPENAI_IMAGE_EDIT_QUALITY ?? 'high').toLowerCase();
  return EDIT_QUALITIES.includes(raw as EditQuality) ? (raw as EditQuality) : 'high';
}

function buildEditPrompt(body: PreviewEditRequestBody): string {
  const { style, medium, target } = body;
  const masterSignals = getCriterionMasterSignals(style, target.criterion)
    .slice(0, 4)
    .map((signal: string) => `- ${signal}`)
    .join('\n');
  return `You are a master painter doing a single careful revision pass on the artist's OWN work for teaching purposes.

Context: ${style}, medium ${medium}.

Focus ONLY on: "${target.criterion}" (rated ${target.level}).

What to address (from their mentor critique):
${target.feedback}

Show this improvement via paint (not caption): ${target.actionPlan}

Master-level signals to honor for this exact criterion in ${style}:
${masterSignals || '- Use the strongest available style-consistent master signals for this criterion.'}

Rules — quality and fidelity:
- Preserve identity: same subject, pose, composition, crop, and viewing angle. Do not invent new objects, figures, or a new scene.
- Preserve the hand of the artist: match existing brush scale, stroke direction, and surface texture (${medium}); edits should look like the same person repainted that passage with more skill, not a different artist or a digital repaint.
- Improvement should feel like a master critique pass inside the artist's existing voice, not a style transfer into another painter's finished work.
- Apply the change mainly where the critique implies (edges, values, color temperature, drawing, etc.)—subtle elsewhere.
- Edge-to-edge: fill the full frame; no inset, no frame-within-frame, no added borders or captions.
- Lighting: keep the same light direction and color of light unless the critique explicitly calls for adjusting light logic for "${target.criterion}".
- Photo artifacts: reduce mild glare or color cast only if needed so the revision reads clearly; do not turn the image into a different photograph.

Output: one photorealistic image of the same artwork after this single focused improvement—museum documentation quality, crisp but natural surface detail, faithful geometry, and revised passages that integrate seamlessly with the untouched paint.`;
}

/**
 * OpenAI Images API — edit with reference image.
 * Uses JSON + `images: [{ image_url }]` (current GPT image models). Legacy multipart `image`/`image[]`
 * differs from this shape and can yield validation errors like "The string did not match the expected pattern."
 *
 * Default model `gpt-image-1`; override with OPENAI_IMAGE_EDIT_MODEL.
 */
export async function runOpenAIPreviewEdit(
  apiKey: string,
  body: PreviewEditRequestBody
): Promise<PreviewEditResponseBody> {
  const model = process.env.OPENAI_IMAGE_EDIT_MODEL ?? 'gpt-image-1';
  const { mime: inputMime, buffer: inputBuffer } = parseDataUrl(body.imageDataUrl.trim());
  const { width: origW, height: origH } = await getImageDimensions(inputBuffer);
  const editSize = pickImagesEditSize(origW, origH);
  const { buffer: apiInputPng, geometry } = await bufferToApiInputPng(inputBuffer, editSize);
  const imageUrl = `data:image/png;base64,${apiInputPng.toString('base64')}`;
  const quality = resolveEditQuality();

  const payload = {
    model,
    prompt: buildEditPrompt(body),
    images: [{ image_url: imageUrl }],
    size: editSize,
    quality,
    n: 1,
    input_fidelity: 'high' as const,
  };

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI image edit failed (${res.status})`);
  }

  const data = json.data as Array<{ b64_json?: string; url?: string }> | undefined;
  const first = data?.[0];
  if (!first) throw new Error('No image in edit response');

  let editedBuffer: Buffer;
  if (first.b64_json) {
    editedBuffer = Buffer.from(first.b64_json, 'base64');
  } else if (first.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) throw new Error('Failed to fetch edited image URL');
    editedBuffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error('Edit response missing image data');
  }

  const preferOut = outputMimeFromInput(inputMime);
  const { buffer: outBuf, mime: outMime } = await resizeEditOutputToMatchUpload(
    editedBuffer,
    origW,
    origH,
    preferOut,
    geometry
  );

  return {
    imageDataUrl: `data:${outMime};base64,${outBuf.toString('base64')}`,
    criterion: body.target.criterion,
  };
}
