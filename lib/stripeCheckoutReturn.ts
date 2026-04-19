import Stripe from 'stripe';
import {
  isStripePaywallEnabled,
  purposeForKind,
  STRIPE_METADATA_PURPOSE_KEY,
  STRIPE_PURPOSE_CRITIQUE,
  STRIPE_PURPOSE_PREVIEW_EDIT,
} from './stripePricing.js';
import { signCheckoutAuthorizationJwt } from './stripeCheckoutJwt.js';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function resolveAppBaseUrl(args: {
  requestOrigin: string | undefined;
  requestHost?: string | string[] | undefined;
  forwardedHost?: string | string[] | undefined;
  forwardedProto?: string | string[] | undefined;
}): string {
  const origin = args.requestOrigin?.trim().replace(/\/$/, '') ?? '';
  if (origin) return origin;

  const host = firstHeaderValue(args.forwardedHost)?.trim() || firstHeaderValue(args.requestHost)?.trim() || '';
  if (host) {
    const proto = firstHeaderValue(args.forwardedProto)?.trim() || (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  const fromEnv = process.env.STRIPE_CHECKOUT_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  throw new Error(
    'Set STRIPE_CHECKOUT_ORIGIN to your public app URL (e.g. https://your-app.vercel.app), or ensure the request host/proto headers are forwarded.'
  );
}

/**
 * GET handler: `?session_id=cs_...` → redirect to SPA with short-lived JWT in both the real URL
 * query and the hash query so installed PWAs / deep-link handlers can recover even if one is
 * stripped during app hand-off.
 */
export async function handleStripeCheckoutReturn(args: {
  sessionId: string | undefined;
  requestOrigin: string | undefined;
  requestHost?: string | string[] | undefined;
  forwardedHost?: string | string[] | undefined;
  forwardedProto?: string | string[] | undefined;
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

  const base = resolveAppBaseUrl({
    requestOrigin: args.requestOrigin,
    requestHost: args.requestHost,
    forwardedHost: args.forwardedHost,
    forwardedProto: args.forwardedProto,
  });
  const query = `payment=success&jwt=${encodeURIComponent(token)}&kind=${encodeURIComponent(typ)}`;
  const location = `${base}/?${query}#/?${query}`;
  return { status: 302, location };
}
