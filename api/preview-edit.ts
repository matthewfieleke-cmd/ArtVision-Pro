import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

/**
 * Image-edit generation with gpt-image-2 at `quality: "high"` and 1024–1536px
 * canvases can take 30–60s per candidate. Raise the function timeout so a
 * single AI preview comfortably fits inside one request, well above the
 * default Vercel function budget.
 */
export const config = {
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);

  const result = await handleApiRequest({
    route: 'preview-edit',
    method: req.method,
    apiKey: process.env.OPENAI_API_KEY,
    body: req.body,
  });

  if (result.status === 200 && req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  res.status(result.status).json(result.body);
}
