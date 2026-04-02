export type VisionImageMessage = {
  type: 'image_url';
  image_url: {
    url: string;
    detail: 'high';
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

export function buildHighDetailImageMessage(dataUrl: string): VisionImageMessage {
  const { mime, base64 } = parseBase64DataUrl(dataUrl);
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mime};base64,${base64}`,
      detail: 'high',
    },
  };
}
