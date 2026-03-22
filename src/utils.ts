import type { RatingLevel, SavedPainting } from './types';

const RANK: Record<RatingLevel, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
};

export function progressPercentFromPainting(p: SavedPainting): number {
  const v = p.versions[p.versions.length - 1];
  if (!v) return 0;
  const sum = v.critique.categories.reduce((acc, c) => acc + RANK[c.level], 0);
  return Math.round((sum / (v.critique.categories.length * 3)) * 100);
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}
