import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

/**
 * Raise the Vercel function timeout for full gpt-6-astra critiques (vision +
 * 8 parallel writers + synthesis). Tuned for Vercel Pro's 300s budget with
 * `low` writer reasoning. Hobby still hard-caps at 60s even with this declared.
 */
export const config = {
  maxDuration: 300,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);
  const result = await handleApiRequest({
    route: 'critique',
    method: req.method,
    apiKey: process.env.OPENAI_API_KEY,
    body: req.body,
  });
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.status(result.status).json(result.body);
}
