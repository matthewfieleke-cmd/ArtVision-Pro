import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders } from '../../lib/apiHandlers.js';
import { handleStripeCheckoutReturn } from '../../lib/stripeCheckoutReturn.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sessionId =
    typeof req.query.session_id === 'string'
      ? req.query.session_id
      : Array.isArray(req.query.session_id)
        ? req.query.session_id[0]
        : undefined;

  const result = await handleStripeCheckoutReturn({
    sessionId,
    requestOrigin: origin,
  });

  if (result.status === 302) {
    res.redirect(302, result.location);
    return;
  }
  res.status(result.status).json(result.body);
}
