import type { PreviewEditRequestBody, PreviewEditResponseBody } from './previewEditTypes';

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  const mime = m[1]!.toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    throw new Error('Image must be PNG, JPEG, or WebP for editing');
  }
  return { mime, buffer: Buffer.from(m[2]!, 'base64') };
}

function buildEditPrompt(body: PreviewEditRequestBody): string {
  const { style, medium, target } = body;
  return `You are helping a painter visualize ONE focused improvement to their existing artwork.

Context: the work is intended as ${style}, medium ${medium}.

Priority area to improve: "${target.criterion}" (current level: ${target.level}).

Critique summary for this area: ${target.feedback}

Concrete next step to show: ${target.actionPlan}

Task: Edit the provided image to demonstrate ONLY this improvement while preserving:
- the same subject matter, composition, and viewing angle
- the same overall style (${style}) and material feel (${medium})
- do not replace the painting with a different scene or add unrelated objects

The result should read as the same painting with a clear, plausible revision toward the next skill level in "${target.criterion}" only. Photorealistic smartphone photo artifacts may be softened slightly but keep it clearly the same artwork.`;
}

/**
 * OpenAI Images API — edit with reference image (multipart).
 * Uses gpt-image-1 by default; override with OPENAI_IMAGE_EDIT_MODEL.
 */
export async function runOpenAIPreviewEdit(
  apiKey: string,
  body: PreviewEditRequestBody
): Promise<PreviewEditResponseBody> {
  const model = process.env.OPENAI_IMAGE_EDIT_MODEL ?? 'gpt-image-1';
  const { buffer, mime } = parseDataUrl(body.imageDataUrl);

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filename = `painting.${ext}`;

  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', buildEditPrompt(body));
  form.append('image', blob, filename);
  form.append('size', '1024x1024');
  form.append('quality', process.env.OPENAI_IMAGE_EDIT_QUALITY ?? 'medium');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `OpenAI image edit failed (${res.status})`);
  }

  const data = json.data as Array<{ b64_json?: string; url?: string }> | undefined;
  const first = data?.[0];
  if (!first) throw new Error('No image in edit response');

  let outMime = 'image/png';
  let base64: string;
  if (first.b64_json) {
    base64 = first.b64_json;
  } else if (first.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) throw new Error('Failed to fetch edited image URL');
    const arr = Buffer.from(await imgRes.arrayBuffer());
    base64 = arr.toString('base64');
    const ct = imgRes.headers.get('content-type');
    if (ct?.includes('jpeg')) outMime = 'image/jpeg';
    else if (ct?.includes('webp')) outMime = 'image/webp';
  } else {
    throw new Error('Edit response missing image data');
  }

  return {
    imageDataUrl: `data:${outMime};base64,${base64}`,
    criterion: body.target.criterion,
  };
}
