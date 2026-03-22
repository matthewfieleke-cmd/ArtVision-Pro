import { DAILY_MASTERPIECES } from './data/dailyMasterpieces';

const STORAGE_KEY = 'artvision-daily-masterpiece-index';

function readIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n % DAILY_MASTERPIECES.length;
  } catch {
    return 0;
  }
}

function writeIndex(n: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(n % DAILY_MASTERPIECES.length));
  } catch {
    /* ignore */
  }
}

/** Current masterpiece slot (0 … length-1). Persists across app restarts (localStorage). */
export function getDailyMasterpieceIndex(): number {
  return readIndex();
}

/**
 * Advance to the next daily masterpiece and persist. Call whenever the user navigates to Home
 * (header, bottom nav, back from studio, or master article → home).
 */
export function advanceDailyMasterpieceIndex(): void {
  const n = (readIndex() + 1) % DAILY_MASTERPIECES.length;
  writeIndex(n);
}
