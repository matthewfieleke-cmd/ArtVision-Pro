/** Session flag so returning from full-screen routes can restore the main tab (App remounts on `/`). */
const KEY = 'artvision-return-tab';
const VIEW_KEY = 'artvision-return-view';
const PENDING_CRITIQUE_PAYMENT_KEY = 'artvision-pending-critique-payment';
const PENDING_PREVIEW_PAYMENT_KEY = 'artvision-pending-preview-payment';

export type ReturnTabIntent = 'benchmarks';
export type ReturnViewIntent =
  | { kind: 'critique'; flow: unknown }
  | { kind: 'studio'; selectedPaintingId: string };

export function setReturnTabIntent(tab: ReturnTabIntent): void {
  try {
    sessionStorage.setItem(KEY, tab);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeReturnTabIntent(): ReturnTabIntent | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (v === 'benchmarks') return 'benchmarks';
    return null;
  } catch {
    return null;
  }
}

export function setReturnViewIntent(intent: ReturnViewIntent): void {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeReturnViewIntent(): ReturnViewIntent | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    sessionStorage.removeItem(VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReturnViewIntent;
    if (parsed?.kind === 'critique') return parsed;
    if (
      parsed?.kind === 'studio' &&
      typeof parsed.selectedPaintingId === 'string' &&
      parsed.selectedPaintingId.length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearReturnViewIntent(): void {
  try {
    sessionStorage.removeItem(VIEW_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Persisted across the Stripe redirect so the critique auto-resumes after payment succeeds.
 * `flow` holds the setup/capture snapshot (`PendingCritiqueFlowRestore`) that was active when
 * payment was required; `imageDataUrl` is the already-compressed photo that should be fed back
 * into `runAnalysis` on return. Kept on sessionStorage so a full-page Stripe reload does not
 * lose the in-progress critique.
 */
export type PendingCritiquePaymentIntent = {
  flow: unknown;
  imageDataUrl: string;
};

export function setPendingCritiquePaymentIntent(intent: PendingCritiquePaymentIntent): boolean {
  try {
    sessionStorage.setItem(PENDING_CRITIQUE_PAYMENT_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function consumePendingCritiquePaymentIntent(): PendingCritiquePaymentIntent | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CRITIQUE_PAYMENT_KEY);
    sessionStorage.removeItem(PENDING_CRITIQUE_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCritiquePaymentIntent>;
    if (
      !parsed ||
      typeof parsed.imageDataUrl !== 'string' ||
      parsed.imageDataUrl.length === 0 ||
      parsed.flow == null
    ) {
      return null;
    }
    return { flow: parsed.flow, imageDataUrl: parsed.imageDataUrl };
  } catch {
    return null;
  }
}

export function clearPendingCritiquePaymentIntent(): void {
  try {
    sessionStorage.removeItem(PENDING_CRITIQUE_PAYMENT_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Criterion whose preview-edit should auto-resume after the Stripe preview-edit payment returns. */
export function setPendingPreviewPaymentCriterion(criterion: string): void {
  try {
    sessionStorage.setItem(PENDING_PREVIEW_PAYMENT_KEY, criterion);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumePendingPreviewPaymentCriterion(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_PREVIEW_PAYMENT_KEY);
    sessionStorage.removeItem(PENDING_PREVIEW_PAYMENT_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingPreviewPaymentCriterion(): void {
  try {
    sessionStorage.removeItem(PENDING_PREVIEW_PAYMENT_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
