const KEY_CRITIQUE = 'artvision_stripe_jwt_critique';
const KEY_PREVIEW = 'artvision_stripe_jwt_preview';
/** Survives full-page Stripe redirect so critique can run after payment (same tab). */
const KEY_PENDING_CRITIQUE_IMAGE = 'artvision_pending_critique_image';

/** Returns false if sessionStorage is unavailable or quota exceeded. */
export function setPendingCritiqueImageDataUrl(dataUrl: string): boolean {
  try {
    sessionStorage.setItem(KEY_PENDING_CRITIQUE_IMAGE, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function takePendingCritiqueImageDataUrl(): string | null {
  try {
    const v = sessionStorage.getItem(KEY_PENDING_CRITIQUE_IMAGE);
    sessionStorage.removeItem(KEY_PENDING_CRITIQUE_IMAGE);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingCritiqueImageDataUrl(): void {
  try {
    sessionStorage.removeItem(KEY_PENDING_CRITIQUE_IMAGE);
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
