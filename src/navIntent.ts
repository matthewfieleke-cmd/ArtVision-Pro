/** Session flag so returning from full-screen routes can restore the main tab (App remounts on `/`). */
const KEY = 'artvision-return-tab';
const VIEW_KEY = 'artvision-return-view';

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
