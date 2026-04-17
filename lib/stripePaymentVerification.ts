import Stripe from 'stripe';
import {
  amountCentsForKind,
  isStripePaywallEnabled,
  purposeForKind,
  STRIPE_METADATA_CONSUMED_KEY,
  STRIPE_METADATA_PURPOSE_KEY,
  type StripePaidProductKind,
} from './stripePricing.js';
import { verifyCheckoutAuthorizationJwt } from './stripeCheckoutJwt.js';

export type PaidApiRoute = 'critique' | 'preview-edit';

function routeToKind(route: PaidApiRoute): StripePaidProductKind {
  return route === 'critique' ? 'critique' : 'preview_edit';
}

/**
 * When Stripe paywall env is set, validates JWT + PaymentIntent succeeded + amount + purpose.
 * Returns the PaymentIntent id for single-use marking after a successful OpenAI call.
 */
export async function assertPaidOrThrow(args: {
  route: PaidApiRoute;
  stripeCheckoutJwt: string | undefined;
}): Promise<{ paymentIntentId?: string }> {
  if (!isStripePaywallEnabled()) return {};

  const token = args.stripeCheckoutJwt?.trim();
  if (!token) {
    throw new PaymentRequiredError('Payment required. Complete checkout before running this action.');
  }

  const secret = process.env.STRIPE_CHECKOUT_JWT_SECRET!.trim();
  const claims = await verifyCheckoutAuthorizationJwt(token, secret);
  const expectedKind = routeToKind(args.route);
  if (claims.typ !== expectedKind) {
    throw new PaymentRequiredError('This payment is not valid for this action.');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
  const stripe = new Stripe(stripeKey);
  const pi = await stripe.paymentIntents.retrieve(claims.pi);

  if (pi.status !== 'succeeded') {
    throw new PaymentRequiredError('Payment has not completed.');
  }
  if ((pi.currency ?? 'usd').toLowerCase() !== 'usd') {
    throw new PaymentRequiredError('Unsupported currency on payment.');
  }
  const expectedAmount = amountCentsForKind(expectedKind);
  if (pi.amount !== expectedAmount) {
    throw new PaymentRequiredError('Payment amount does not match this product.');
  }
  const purpose = pi.metadata?.[STRIPE_METADATA_PURPOSE_KEY];
  if (purpose !== purposeForKind(expectedKind)) {
    throw new PaymentRequiredError('Payment product mismatch.');
  }
  if (pi.metadata?.[STRIPE_METADATA_CONSUMED_KEY] === 'true') {
    throw new PaymentRequiredError('This payment has already been used.');
  }
  return { paymentIntentId: claims.pi };
}

export class PaymentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequiredError';
  }
}
