import { afterEach, describe, expect, it } from 'vitest';

import { amountCentsForKind, isStripePaywallEnabled, purposeForKind } from './stripePricing.js';

describe('stripePricing', () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_CHECKOUT_JWT_SECRET;
  });

  it('amounts match product copy', () => {
    expect(amountCentsForKind('critique')).toBe(149);
    expect(amountCentsForKind('preview_edit')).toBe(49);
  });

  it('purpose strings are stable metadata keys', () => {
    expect(purposeForKind('critique')).toBe('critique');
    expect(purposeForKind('preview_edit')).toBe('preview_edit');
  });

  it('paywall disabled without full env', () => {
    expect(isStripePaywallEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(isStripePaywallEnabled()).toBe(false);
    process.env.STRIPE_CHECKOUT_JWT_SECRET = 'short';
    expect(isStripePaywallEnabled()).toBe(false);
    process.env.STRIPE_CHECKOUT_JWT_SECRET = 'a'.repeat(16);
    expect(isStripePaywallEnabled()).toBe(true);
  });
});
