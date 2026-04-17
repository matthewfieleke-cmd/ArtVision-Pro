import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsHeaders } from '../../lib/apiHandlers.js';
import {
  isStripePaywallEnabled,
  STRIPE_CRITIQUE_AMOUNT_CENTS,
  STRIPE_PREVIEW_EDIT_AMOUNT_CENTS,
} from '../../lib/stripePricing.js';

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

  res.status(200).json({
    paywallEnabled: isStripePaywallEnabled(),
    critiqueAmountCents: STRIPE_CRITIQUE_AMOUNT_CENTS,
    previewEditAmountCents: STRIPE_PREVIEW_EDIT_AMOUNT_CENTS,
  });
}
