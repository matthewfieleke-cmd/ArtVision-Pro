import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

/**
 * Raise the Vercel function timeout well above the pipeline's worst-case
 * end-to-end time. The three-stage pipeline (vision + 8 parallel per-criterion
 * calls + synthesis) on gpt-6-astra has been observed to run tens of seconds
 * in the wild; the default Vercel function timeout (10s on Hobby, 60s on Pro)
 * is not enough headroom and was a visible cause of intermittent
 * "Failed to fetch" / timeout errors when a run was slower than usual.
 * Pro and Enterprise allow up to 300s (also set in vercel.json); Hobby caps at
 * 60s even with this declared, so Hobby deployments should still expect some
 * edge-of-budget runs — gpt-6 writers use `low` reasoning to stay inside that.
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
