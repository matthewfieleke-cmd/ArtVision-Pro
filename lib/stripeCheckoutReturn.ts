import Stripe from 'stripe';
import {
  isStripePaywallEnabled,
  purposeForKind,
  STRIPE_METADATA_PURPOSE_KEY,
  STRIPE_PURPOSE_CRITIQUE,
  STRIPE_PURPOSE_PREVIEW_EDIT,
} from './stripePricing.js';
import { signCheckoutAuthorizationJwt } from './stripeCheckoutJwt.js';

function resolveAppBaseUrl(requestOrigin: string | undefined): string {
  const fromEnv = process.env.STRIPE_CHECKOUT_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const o = requestOrigin?.trim().replace(/\/$/, '') ?? '';
  if (!o) {
    throw new Error(
      'Set STRIPE_CHECKOUT_ORIGIN to your public app URL (e.g. https://your-app.vercel.app). Stripe redirects do not send Origin.'
    );
  }
  return o;
}

/**
 * GET handler: `?session_id=cs_...` → redirect to SPA with short-lived JWT in hash query.
 */
export async function handleStripeCheckoutReturn(args: {
  sessionId: string | undefined;
  requestOrigin: string | undefined;
}): Promise<{ status: 302; location: string } | { status: 400 | 503; body: { error: string } }> {
  if (!isStripePaywallEnabled()) {
    return { status: 503, body: { error: 'Stripe checkout is not configured' } };
  }
  const sid = args.sessionId?.trim();
  if (!sid) {
    return { status: 400, body: { error: 'session_id required' } };
  }
  const secret = process.env.STRIPE_CHECKOUT_JWT_SECRET!.trim();
  const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent'] });
  const piRaw = session.payment_intent;
  if (!piRaw || typeof piRaw === 'string') {
    return { status: 400, body: { error: 'Checkout session missing payment' } };
  }
  const pi = piRaw as Stripe.PaymentIntent;
  if (pi.status !== 'succeeded') {
    return { status: 400, body: { error: 'Payment not completed' } };
  }
  const purpose = pi.metadata?.[STRIPE_METADATA_PURPOSE_KEY];
  const typ =
    purpose === STRIPE_PURPOSE_PREVIEW_EDIT
      ? ('preview_edit' as const)
      : purpose === STRIPE_PURPOSE_CRITIQUE
        ? ('critique' as const)
        : null;
  if (!typ) {
    return { status: 400, body: { error: 'Unknown checkout product' } };
  }
  if (purpose !== purposeForKind(typ)) {
    return { status: 400, body: { error: 'Payment metadata mismatch' } };
  }

  const token = await signCheckoutAuthorizationJwt({
    secret,
    paymentIntentId: pi.id,
    typ,
    ttlSeconds: 15 * 60,
  });

  const base = resolveAppBaseUrl(args.requestOrigin);
  const location = `${base}/#/?payment=success&jwt=${encodeURIComponent(token)}&kind=${encodeURIComponent(typ)}`;
  return { status: 302, location };
}
