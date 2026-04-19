import { afterEach, describe, expect, it } from 'vitest';
import { resolveAppBaseUrl } from './stripeCheckoutReturn.js';
import { resolveCheckoutOrigin } from './stripeCreateCheckoutSession.js';

describe('stripe origin resolution', () => {
  const originalOrigin = process.env.STRIPE_CHECKOUT_ORIGIN;

  afterEach(() => {
    if (originalOrigin === undefined) {
      delete process.env.STRIPE_CHECKOUT_ORIGIN;
    } else {
      process.env.STRIPE_CHECKOUT_ORIGIN = originalOrigin;
    }
  });

  it('prefers the browser request origin when creating checkout sessions', () => {
    process.env.STRIPE_CHECKOUT_ORIGIN = 'https://canonical.example.com';

    expect(resolveCheckoutOrigin('https://current.example.com')).toBe('https://current.example.com');
  });

  it('prefers request host and proto over env on checkout return', () => {
    process.env.STRIPE_CHECKOUT_ORIGIN = 'https://canonical.example.com';

    expect(
      resolveAppBaseUrl({
        requestOrigin: undefined,
        requestHost: 'branch-preview.example.com',
        forwardedProto: 'https',
      })
    ).toBe('https://branch-preview.example.com');
  });

  it('falls back to STRIPE_CHECKOUT_ORIGIN when request details are unavailable', () => {
    process.env.STRIPE_CHECKOUT_ORIGIN = 'https://canonical.example.com';

    expect(
      resolveAppBaseUrl({
        requestOrigin: undefined,
      })
    ).toBe('https://canonical.example.com');
  });
});
