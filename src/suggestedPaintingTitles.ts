import type { CompletionRead, CritiqueCategory, Medium, Style } from './types';

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function titleCaseFragment(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function firstEvidencePhrase(cat: CritiqueCategory | undefined, maxLen: number): string {
  const raw = cat?.evidenceSignals?.find((x) => x.trim().length > 0)?.trim() ?? '';
  if (!raw) return '';
  const noNum = raw.replace(/^\d+\.\s*/, '');
  return truncate(titleCaseFragment(noNum.replace(/\.$/, '')), maxLen);
}

function findCat(categories: CritiqueCategory[], needle: string): CritiqueCategory | undefined {
  return categories.find((c) => c.criterion.includes(needle));
}

/**
 * Three catalogue-style title suggestions for offline / heuristic critiques.
 */
export function buildLocalSuggestedPaintingTitles(
  style: Style,
  medium: Medium,
  categories: CritiqueCategory[],
  completionRead: CompletionRead,
  benchmarks: readonly string[]
): string[] {
  const comp = findCat(categories, 'Composition');
  const value = findCat(categories, 'Value and light');
  const color = findCat(categories, 'Color');
  const surface = findCat(categories, 'Surface');

  const p1 = firstEvidencePhrase(comp, 52) || firstEvidencePhrase(value, 52) || 'spatial and planar structure';
  const p2 = firstEvidencePhrase(value, 48) || firstEvidencePhrase(color, 48) || 'light and hue relationships';
  const p3 =
    firstEvidencePhrase(surface, 44) ||
    firstEvidencePhrase(color, 44) ||
    firstEvidencePhrase(findCat(categories, 'Edge'), 44) ||
    'mark and surface incident';

  const bench0 = benchmarks[0]?.trim() ?? '';
  const benchParts = bench0.split(/\s+/).filter(Boolean);
  const masterSurname =
    benchParts.length >= 2 ? benchParts[benchParts.length - 1]! : benchParts[0] ?? 'period';

  const finishWord =
    completionRead.state === 'likely_finished'
      ? 'resolved'
      : completionRead.state === 'unfinished'
        ? 'in-progress'
        : 'open';

  const t1 = `${truncate(style, 24)} ${medium}: ${p1}`;
  const t2 = `Study in ${truncate(p2, 56)} (${style}; ${finishWord} state)`;
  const t3 = `${truncate(p3, 48)} — ${medium}, after the ${masterSurname} line`;

  const out = [t1, t2, t3].map((x) => truncate(x.replace(/\s+/g, ' ').trim(), 100));
  return out;
}
