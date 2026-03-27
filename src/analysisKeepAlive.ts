/** Screen Wake Lock during long-running critique (reduces auto-lock while user stays on screen). */

export type WakeLockHandle = { release: () => Promise<void> };

export async function requestScreenWakeLock(): Promise<WakeLockHandle | null> {
  try {
    const wl = navigator.wakeLock;
    if (!wl?.request) return null;
    const sentinel = await wl.request('screen');
    return {
      release: () => sentinel.release(),
    };
  } catch {
    return null;
  }
}

export function isAbortError(e: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}

/** Hidden longer than this may mean a stalled fetch; we abort and retry once. */
export const ANALYSIS_HIDDEN_RETRY_MS = 25_000;
