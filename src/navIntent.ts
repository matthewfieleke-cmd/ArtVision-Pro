/** Session flag so returning from full-screen routes can restore the main tab (App remounts on `/`). */
const KEY = 'artvision-return-tab';

export type ReturnTabIntent = 'benchmarks';

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
