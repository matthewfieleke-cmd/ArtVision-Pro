import Stripe from 'stripe';
import { isStripePaywallEnabled, STRIPE_METADATA_CONSUMED_KEY } from './stripePricing.js';

export async function markStripePaymentIntentConsumed(paymentIntentId: string): Promise<void> {
  if (!isStripePaywallEnabled()) return;
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) return;
  const stripe = new Stripe(stripeKey);
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      ...pi.metadata,
      [STRIPE_METADATA_CONSUMED_KEY]: 'true',
    },
  });
}
