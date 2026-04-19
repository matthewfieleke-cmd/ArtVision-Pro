const KEY_CRITIQUE = 'artvision_stripe_jwt_critique';
const KEY_PREVIEW = 'artvision_stripe_jwt_preview';

/** Single key: survives full-page Stripe redirect (image + flow JSON). */
const KEY_PENDING_CRITIQUE_CHECKOUT = 'artvision_pending_critique_checkout';

export type PendingCritiqueCheckoutPayload = {
  imageDataUrl: string;
  /** `PendingCritiqueFlowRestore` from critiqueFlow.ts */
  flow: unknown;
};

/** Returns false if sessionStorage is unavailable or quota exceeded. */
export function setPendingCritiqueCheckout(payload: PendingCritiqueCheckoutPayload): boolean {
  try {
    sessionStorage.setItem(KEY_PENDING_CRITIQUE_CHECKOUT, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function takePendingCritiqueCheckout(): PendingCritiqueCheckoutPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY_PENDING_CRITIQUE_CHECKOUT);
    sessionStorage.removeItem(KEY_PENDING_CRITIQUE_CHECKOUT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCritiqueCheckoutPayload>;
    if (typeof parsed.imageDataUrl !== 'string' || parsed.imageDataUrl.length === 0 || parsed.flow == null) {
      return null;
    }
    return { imageDataUrl: parsed.imageDataUrl, flow: parsed.flow };
  } catch {
    return null;
  }
}

export function clearPendingCritiqueCheckout(): void {
  try {
    sessionStorage.removeItem(KEY_PENDING_CRITIQUE_CHECKOUT);
  } catch {
    /* ignore */
  }
}

export function getStripeCheckoutJwt(kind: 'critique' | 'preview_edit'): string | null {
  try {
    const k = kind === 'critique' ? KEY_CRITIQUE : KEY_PREVIEW;
    const v = sessionStorage.getItem(k)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setStripeCheckoutJwt(kind: 'critique' | 'preview_edit', token: string): void {
  try {
    const k = kind === 'critique' ? KEY_CRITIQUE : KEY_PREVIEW;
    sessionStorage.setItem(k, token);
  } catch {
    /* ignore */
  }
}

export function clearStripeCheckoutJwt(kind: 'critique' | 'preview_edit'): void {
  try {
    const k = kind === 'critique' ? KEY_CRITIQUE : KEY_PREVIEW;
    sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
