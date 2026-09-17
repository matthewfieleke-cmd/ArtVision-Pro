import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

/**
 * Raise the Vercel function timeout well above the pipeline's worst-case
 * end-to-end time. Hybrid default: gpt-6-astra looking + gpt-5.4 writers +
 * gpt-6-astra synthesis, typically well under a minute on Pro. Full-Astra
 * writers need the full 300s Pro budget (Hobby still hard-caps at 60s).
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
