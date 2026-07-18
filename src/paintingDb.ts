/**
 * IndexedDB persistence for Studio paintings.
 *
 * localStorage (~5MB) was too small once photos + AI preview images accumulate.
 * IndexedDB typically allows far more per origin and is the primary store.
 * localStorage is only used as a one-time migration source and a last-resort
 * fallback when IndexedDB is unavailable.
 */

import type { SavedPainting } from './types';

const DB_NAME = 'artvision-pro';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const PAINTINGS_KEY = 'paintings';

/** localStorage key for the legacy sync store (migration source). */
export const LEGACY_LOCAL_STORAGE_KEY = 'artvision-pro-paintings-v1';
/** Set after a successful migration so we do not keep re-reading a huge legacy blob. */
const MIGRATED_FLAG_KEY = 'artvision-pro-paintings-idb-migrated-v1';

function canUseIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
        tx.oncomplete = () => db.close();
      })
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB put failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      })
  );
}

function readLegacyLocalStorage(): SavedPainting[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPainting[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    localStorage.setItem(MIGRATED_FLAG_KEY, '1');
  } catch {
    /* ignore */
  }
}

function alreadyMigrated(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export type PaintingPersistError = Error & { code: 'quota' | 'unavailable' | 'unknown' };

export function createPaintingPersistError(
  message: string,
  code: PaintingPersistError['code'] = 'unknown'
): PaintingPersistError {
  const err = new Error(message) as PaintingPersistError;
  err.code = code;
  return err;
}

function toPersistError(e: unknown): PaintingPersistError {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
  const msg = e instanceof Error ? e.message : String(e ?? 'Storage failed');
  if (
    name === 'QuotaExceededError' ||
    /quota/i.test(msg) ||
    /storage may be full/i.test(msg)
  ) {
    return createPaintingPersistError(
      'Could not save — storage may be full. Try removing an older project or using a smaller photo.',
      'quota'
    );
  }
  return createPaintingPersistError(
    'Could not save your Studio library. Try again, or free space on this device.',
    'unknown'
  );
}

/** Load paintings from IndexedDB, migrating legacy localStorage once if needed. */
export async function loadPaintingsFromDb(): Promise<SavedPainting[]> {
  if (canUseIndexedDb()) {
    try {
      const fromIdb = await idbGet<SavedPainting[]>(PAINTINGS_KEY);
      if (Array.isArray(fromIdb) && fromIdb.length > 0) {
        return fromIdb;
      }
      if (!alreadyMigrated()) {
        const legacy = readLegacyLocalStorage();
        if (legacy && legacy.length > 0) {
          await idbSet(PAINTINGS_KEY, legacy);
          clearLegacyLocalStorage();
          return legacy;
        }
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(MIGRATED_FLAG_KEY, '1');
          }
        } catch {
          /* ignore */
        }
      }
      return Array.isArray(fromIdb) ? fromIdb : [];
    } catch (e) {
      console.warn('[paintingDb] IndexedDB load failed, trying localStorage', e);
    }
  }

  return readLegacyLocalStorage() ?? [];
}

/** Persist the full paintings array. Prefers IndexedDB; falls back to localStorage. */
export async function savePaintingsToDb(paintings: SavedPainting[]): Promise<void> {
  if (canUseIndexedDb()) {
    try {
      await idbSet(PAINTINGS_KEY, paintings);
      // Best-effort: drop the legacy blob so it cannot overwrite / consume quota later.
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
          localStorage.setItem(MIGRATED_FLAG_KEY, '1');
        }
      } catch {
        /* ignore */
      }
      return;
    } catch (e) {
      console.warn('[paintingDb] IndexedDB save failed, trying localStorage fallback', e);
      // Fall through to localStorage — may still work for small libraries.
      try {
        if (typeof localStorage === 'undefined') throw e;
        localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(paintings));
        return;
      } catch (fallbackErr) {
        throw toPersistError(fallbackErr);
      }
    }
  }

  try {
    if (typeof localStorage === 'undefined') {
      throw createPaintingPersistError('Storage is unavailable in this browser.', 'unavailable');
    }
    localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(paintings));
  } catch (e) {
    throw toPersistError(e);
  }
}
