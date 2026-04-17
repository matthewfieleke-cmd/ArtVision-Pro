import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders } from '../../lib/apiHandlers.js';
import { isStripePaywallEnabled } from '../../lib/stripePricing.js';
import { createStripeCheckoutSession } from '../../lib/stripeCreateCheckoutSession.js';

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
  const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
  try {
    const body = (typeof req.body === 'object' && req.body) ? (req.body as { kind?: string; cancelPathHash?: string }) : {};
    const kind = body.kind === 'preview_edit' ? 'preview_edit' : 'critique';
    const { url } = await createStripeCheckoutSession(
      stripeKey,
      { kind, cancelPathHash: typeof body.cancelPathHash === 'string' ? body.cancelPathHash : undefined },
      { requestOrigin: origin }
    );
    res.status(200).json({ url });
  } catch (e) {
    console.error('[stripe create-checkout-session]', e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Checkout failed' });
  }
}
