import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders } from '../../lib/apiHandlers.js';
import { exchangeStripeCheckoutSession } from '../../lib/stripeCheckoutReturn.js';
import { isStripePaywallEnabled } from '../../lib/stripePricing.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  applyCorsHeaders((name, value) => res.setHeader(name, value), origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isStripePaywallEnabled()) {
    res.status(503).json({ error: 'Stripe checkout is not configured' });
    return;
  }

  try {
    const body =
      typeof req.body === 'object' && req.body
        ? (req.body as { sessionId?: string })
        : {};
    const result = await exchangeStripeCheckoutSession({
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Stripe session exchange failed' });
  }
}
