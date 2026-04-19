import Stripe from 'stripe';
import {
  amountCentsForKind,
  purposeForKind,
  STRIPE_METADATA_PURPOSE_KEY,
  type StripePaidProductKind,
} from './stripePricing.js';

export type CreateCheckoutSessionBody = {
  kind: StripePaidProductKind;
  /** Hash-router cancel return (default `#/`). Example: `#/?tab=studio`. */
  cancelPathHash?: string;
};

function productLabel(kind: StripePaidProductKind): string {
  return kind === 'critique' ? 'Painting critique' : 'AI image preview';
}

export function resolveCheckoutOrigin(requestOrigin: string | undefined): string {
  return (
    requestOrigin?.trim() ||
    process.env.STRIPE_CHECKOUT_ORIGIN?.trim() ||
    ''
  ).replace(/\/$/, '');
}

/**
 * POST JSON `{ kind: "critique" | "preview_edit" }`. Requires `Origin` (browser) or `STRIPE_CHECKOUT_ORIGIN`.
 */
export async function createStripeCheckoutSession(
  stripeSecretKey: string,
  body: CreateCheckoutSessionBody,
  args: { requestOrigin: string | undefined }
): Promise<{ url: string }> {
  const kind = body.kind === 'preview_edit' ? 'preview_edit' : 'critique';
  const origin = resolveCheckoutOrigin(args.requestOrigin);
  if (!origin) {
    throw new Error(
      'Set STRIPE_CHECKOUT_ORIGIN to your public app URL (e.g. https://your-app.vercel.app), or call checkout from the browser on that same origin.'
    );
  }
  const base = `${origin}/api/stripe/checkout-return`;
  const successUrl = `${base}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelHash = body.cancelPathHash?.trim() || '#/';
  const cancelFragment = cancelHash.startsWith('#') ? cancelHash : `#${cancelHash}`;
  const cancelUrl = `${origin.replace(/\/$/, '')}/${cancelFragment}`;

  const stripe = new Stripe(stripeSecretKey);
  const amount = amountCentsForKind(kind);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: productLabel(kind),
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: {
        [STRIPE_METADATA_PURPOSE_KEY]: purposeForKind(kind),
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  const url = session.url;
  if (!url) throw new Error('Checkout session missing redirect URL');
  return { url };
}
