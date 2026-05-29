export type VisionImageDetail = 'high' | 'low' | 'auto';

export type VisionImageMessage = {
  type: 'image_url';
  image_url: {
    url: string;
    detail: VisionImageDetail;
  };
};

export type VisionTextMessage = {
  type: 'text';
  text: string;
};

export type VisionUserMessagePart = VisionTextMessage | VisionImageMessage;

export function parseBase64DataUrl(dataUrl: string): { mime: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid image data URL');
  return { mime: match[1]!, base64: match[2]! };
}

export function buildImageMessage(
  dataUrl: string,
  detail: VisionImageDetail = 'high'
): VisionImageMessage {
  const { mime, base64 } = parseBase64DataUrl(dataUrl);
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mime};base64,${base64}`,
      detail,
    },
  };
}

/** Full-resolution read. Use for the perception-heavy vision/classification stages. */
export function buildHighDetailImageMessage(dataUrl: string): VisionImageMessage {
  return buildImageMessage(dataUrl, 'high');
}

/**
 * Low-detail read. Use for the eight parallel per-criterion writer calls: they
 * mainly localize an anchor box and write prose grounded in the shared
 * observation bank (already produced from a full high-detail pass), so paying
 * `high` image tokens eight more times in parallel is the single most
 * expensive thing on the critique critical path with the least benefit.
 */
export function buildLowDetailImageMessage(dataUrl: string): VisionImageMessage {
  return buildImageMessage(dataUrl, 'low');
}
