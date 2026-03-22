import type { SavedPainting } from './types';

const KEY = 'artvision-pro-paintings-v1';

export function loadPaintings(): SavedPainting[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPainting[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePaintings(paintings: SavedPainting[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(paintings));
  } catch (e) {
    console.error(e);
    throw new Error(
      'Could not save — storage may be full. Try removing an older project or using a smaller photo.'
    );
  }
}
