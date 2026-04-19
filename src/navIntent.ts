/** Session flag so returning from full-screen routes can restore the main tab (App remounts on `/`). */
const KEY = 'artvision-return-tab';

/**
 * Storage keys for state that must survive a Stripe checkout round-trip. We persist these in
 * `localStorage` rather than `sessionStorage` because a Microsoft Store PWA (and some
 * `handle_links: 'preferred'` routings) land the Stripe return URL in a *new* window/webview
 * instance whose `sessionStorage` is empty. `localStorage` is origin-partitioned and shared
 * across every instance of the same origin, so it survives that hand-off. Each value is wrapped
 * with a `storedAt` timestamp and aggressively TTL'd so we never resume a stale critique.
 */
const PENDING_CRITIQUE_PAYMENT_KEY = 'artvision-pending-critique-payment-v2';
const PENDING_PREVIEW_PAYMENT_KEY = 'artvision-pending-preview-payment-v2';
const RETURN_VIEW_KEY = 'artvision-return-view-v2';
/** Legacy sessionStorage keys consulted as a one-time fallback after the localStorage migration. */
const LEGACY_PENDING_CRITIQUE_SESSION_KEY = 'artvision-pending-critique-payment';
const LEGACY_PENDING_CRITIQUE_ORIG_KEY = 'artvision_pending_critique_checkout';
const LEGACY_PENDING_PREVIEW_SESSION_KEY = 'artvision-pending-preview-payment';
const LEGACY_RETURN_VIEW_SESSION_KEY = 'artvision-return-view';

/** How long a stored Stripe-round-trip intent stays valid. Stripe checkout itself expires at 24h
    but most users come back within minutes — 30 min is plenty while preventing stale resumes. */
const STRIPE_RETURN_TTL_MS = 30 * 60 * 1000;

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

type TimestampedEnvelope<T> = { storedAt: number; value: T };

function writeTimestamped<T>(storage: Storage | null, key: string, value: T): boolean {
  if (!storage) return false;
  try {
    const envelope: TimestampedEnvelope<T> = { storedAt: Date.now(), value };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

function readTimestamped<T>(
  storage: Storage | null,
  key: string,
  ttlMs: number,
  validate: (value: unknown) => value is T
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    storage.removeItem(key);
    const parsed = JSON.parse(raw) as Partial<TimestampedEnvelope<unknown>>;
    if (
      !parsed ||
      typeof parsed.storedAt !== 'number' ||
      Date.now() - parsed.storedAt > ttlMs
    ) {
      return null;
    }
    if (!validate(parsed.value)) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

/** Same as readTimestamped but does not remove the key (for Stripe resume before analysis starts). */
function peekTimestamped<T>(
  storage: Storage | null,
  key: string,
  ttlMs: number,
  validate: (value: unknown) => value is T
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimestampedEnvelope<unknown>>;
    if (
      !parsed ||
      typeof parsed.storedAt !== 'number' ||
      Date.now() - parsed.storedAt > ttlMs
    ) {
      return null;
    }
    if (!validate(parsed.value)) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function isReturnViewIntent(value: unknown): value is ReturnViewIntent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ReturnViewIntent>;
  if (v.kind === 'critique') return true;
  if (
    v.kind === 'studio' &&
    typeof v.selectedPaintingId === 'string' &&
    v.selectedPaintingId.length > 0
  ) {
    return true;
  }
  return false;
}

export function setReturnViewIntent(intent: ReturnViewIntent): void {
  /* Mirror to both so instances using only the old bundle still read what this one wrote. */
  writeTimestamped(safeLocalStorage(), RETURN_VIEW_KEY, intent);
  try {
    safeSessionStorage()?.setItem(LEGACY_RETURN_VIEW_SESSION_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

export function consumeReturnViewIntent(): ReturnViewIntent | null {
  const fromLocal = readTimestamped(
    safeLocalStorage(),
    RETURN_VIEW_KEY,
    STRIPE_RETURN_TTL_MS,
    isReturnViewIntent
  );
  if (fromLocal) {
    try {
      safeSessionStorage()?.removeItem(LEGACY_RETURN_VIEW_SESSION_KEY);
    } catch {
      /* ignore */
    }
    return fromLocal;
  }
  /* Legacy sessionStorage fallback for users still on an older bundle. */
  try {
    const session = safeSessionStorage();
    if (!session) return null;
    const raw = session.getItem(LEGACY_RETURN_VIEW_SESSION_KEY);
    session.removeItem(LEGACY_RETURN_VIEW_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isReturnViewIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearReturnViewIntent(): void {
  try {
    safeLocalStorage()?.removeItem(RETURN_VIEW_KEY);
  } catch {
    /* ignore */
  }
  try {
    safeSessionStorage()?.removeItem(LEGACY_RETURN_VIEW_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Persisted across the Stripe redirect so the critique auto-resumes after payment succeeds.
 * `flow` holds the setup/capture snapshot (`PendingCritiqueFlowRestore`) that was active when
 * payment was required; `imageDataUrl` is the already-compressed photo that should be fed back
 * into `runAnalysis` on return. Stored in `localStorage` so a new PWA window/instance spawned by
 * the OS to handle the Stripe return URL can still see it.
 */
export type PendingCritiquePaymentIntent = {
  flow: unknown;
  imageDataUrl: string;
};

function isCritiquePaymentIntent(v: unknown): v is PendingCritiquePaymentIntent {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<PendingCritiquePaymentIntent>;
  return (
    typeof o.imageDataUrl === 'string' && o.imageDataUrl.length > 0 && o.flow != null
  );
}

export function setPendingCritiquePaymentIntent(intent: PendingCritiquePaymentIntent): boolean {
  return writeTimestamped(safeLocalStorage(), PENDING_CRITIQUE_PAYMENT_KEY, intent);
}

function readLegacyCritiqueSessionPayload(key: string): PendingCritiquePaymentIntent | null {
  try {
    const session = safeSessionStorage();
    if (!session) return null;
    const raw = session.getItem(key);
    if (!raw) return null;
    session.removeItem(key);
    const parsed = JSON.parse(raw);
    return isCritiquePaymentIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function peekLegacyCritiqueSessionPayload(key: string): PendingCritiquePaymentIntent | null {
  try {
    const session = safeSessionStorage();
    if (!session) return null;
    const raw = session.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isCritiquePaymentIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read pending critique payment intent without removing it. Cleared after `runAnalysis` finishes
 * (success or failure) so React Strict Mode / double effect runs cannot lose the intent mid-resume.
 */
export function peekPendingCritiquePaymentIntent(): PendingCritiquePaymentIntent | null {
  const current = peekTimestamped(
    safeLocalStorage(),
    PENDING_CRITIQUE_PAYMENT_KEY,
    STRIPE_RETURN_TTL_MS,
    isCritiquePaymentIntent
  );
  if (current) return current;
  const legacySession = peekLegacyCritiqueSessionPayload(LEGACY_PENDING_CRITIQUE_SESSION_KEY);
  if (legacySession) return legacySession;
  return peekLegacyCritiqueSessionPayload(LEGACY_PENDING_CRITIQUE_ORIG_KEY);
}

export function consumePendingCritiquePaymentIntent(): PendingCritiquePaymentIntent | null {
  /* 1. Current localStorage-backed intent (primary path, survives PWA window hand-off). */
  const current = readTimestamped(
    safeLocalStorage(),
    PENDING_CRITIQUE_PAYMENT_KEY,
    STRIPE_RETURN_TTL_MS,
    isCritiquePaymentIntent
  );
  if (current) return current;
  /* 2. Previous sessionStorage key (users who paid on an older bundle before the v2 migration). */
  const legacySession = readLegacyCritiqueSessionPayload(LEGACY_PENDING_CRITIQUE_SESSION_KEY);
  if (legacySession) return legacySession;
  /* 3. Original pre-refactor sessionStorage key (from stripeCheckoutSession.ts helper). */
  return readLegacyCritiqueSessionPayload(LEGACY_PENDING_CRITIQUE_ORIG_KEY);
}

export function clearPendingCritiquePaymentIntent(): void {
  try {
    safeLocalStorage()?.removeItem(PENDING_CRITIQUE_PAYMENT_KEY);
  } catch {
    /* ignore */
  }
  try {
    const s = safeSessionStorage();
    s?.removeItem(LEGACY_PENDING_CRITIQUE_SESSION_KEY);
    s?.removeItem(LEGACY_PENDING_CRITIQUE_ORIG_KEY);
  } catch {
    /* ignore */
  }
}

/** Criterion whose preview-edit should auto-resume after the Stripe preview-edit payment returns. */
function isCriterionString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function setPendingPreviewPaymentCriterion(criterion: string): void {
  writeTimestamped(safeLocalStorage(), PENDING_PREVIEW_PAYMENT_KEY, criterion);
}

export function consumePendingPreviewPaymentCriterion(): string | null {
  const current = readTimestamped(
    safeLocalStorage(),
    PENDING_PREVIEW_PAYMENT_KEY,
    STRIPE_RETURN_TTL_MS,
    isCriterionString
  );
  if (current) return current;
  try {
    const s = safeSessionStorage();
    if (!s) return null;
    const raw = s.getItem(LEGACY_PENDING_PREVIEW_SESSION_KEY);
    s.removeItem(LEGACY_PENDING_PREVIEW_SESSION_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function clearPendingPreviewPaymentCriterion(): void {
  try {
    safeLocalStorage()?.removeItem(PENDING_PREVIEW_PAYMENT_KEY);
  } catch {
    /* ignore */
  }
  try {
    safeSessionStorage()?.removeItem(LEGACY_PENDING_PREVIEW_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
