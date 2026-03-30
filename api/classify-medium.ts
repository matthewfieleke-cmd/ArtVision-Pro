import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);

  const result = await handleApiRequest({
    route: 'classify-medium',
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
