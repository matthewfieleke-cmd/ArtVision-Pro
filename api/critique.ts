import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);
  const auth =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  const result = await handleApiRequest({
    route: 'critique',
    method: req.method,
    apiKey: process.env.OPENAI_API_KEY,
    authorizationHeader: auth,
    body: req.body,
  });
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.status(result.status).json(result.body);
}
