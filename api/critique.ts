import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders, handleApiRequest } from '../lib/apiHandlers.js';

/**
 * Raise the Vercel function timeout well above the pipeline's worst-case
 * end-to-end time. The three-stage pipeline (vision + 8 parallel per-criterion
 * calls + synthesis) on gpt-5.4 has been observed to run 30–90 seconds in the
 * wild; the default Vercel function timeout (10s on Hobby, 60s on Pro) is not
 * enough headroom and was the visible cause of intermittent
 * "The critique request failed before it could complete" errors when a run
 * was slower than usual. Pro and Enterprise allow up to 300s; Hobby caps at
 * 60s even with this declared, so Hobby deployments should still expect some
 * edge-of-budget runs until we either shrink the pipeline further or move off
 * Hobby.
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
