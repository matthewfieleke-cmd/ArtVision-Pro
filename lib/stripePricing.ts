/** USD amounts in the smallest currency unit (cents). */
export const STRIPE_CRITIQUE_AMOUNT_CENTS = 149;
export const STRIPE_PREVIEW_EDIT_AMOUNT_CENTS = 99;

export const STRIPE_METADATA_PURPOSE_KEY = 'artvision_purpose';
export const STRIPE_METADATA_CONSUMED_KEY = 'artvision_consumed';
export const STRIPE_PURPOSE_CRITIQUE = 'critique';
export const STRIPE_PURPOSE_PREVIEW_EDIT = 'preview_edit';

export type StripePaidProductKind = 'critique' | 'preview_edit';

export function purposeForKind(kind: StripePaidProductKind): string {
  return kind === 'critique' ? STRIPE_PURPOSE_CRITIQUE : STRIPE_PURPOSE_PREVIEW_EDIT;
}

export function amountCentsForKind(kind: StripePaidProductKind): number {
  return kind === 'critique' ? STRIPE_CRITIQUE_AMOUNT_CENTS : STRIPE_PREVIEW_EDIT_AMOUNT_CENTS;
}

export function isStripePaywallEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_CHECKOUT_JWT_SECRET?.trim() &&
      process.env.STRIPE_CHECKOUT_JWT_SECRET.length >= 16
  );
}
