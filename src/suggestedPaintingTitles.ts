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

function anchorSnippet(cat: CritiqueCategory | undefined, maxLen: number): string {
  const s = cat?.anchor?.areaSummary?.trim() ?? '';
  if (!s) return '';
  return truncate(titleCaseFragment(s.replace(/\.$/, '')), maxLen);
}

function preserveSnippet(cat: CritiqueCategory | undefined, maxLen: number): string {
  const s = cat?.preserve?.trim() ?? '';
  if (!s) return '';
  return truncate(titleCaseFragment(s.replace(/\.$/, '')), maxLen);
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
  const drawing = findCat(categories, 'Drawing');
  const presence = findCat(categories, 'Presence');

  const motif =
    anchorSnippet(comp, 40) ||
    anchorSnippet(value, 40) ||
    anchorSnippet(drawing, 40) ||
    anchorSnippet(presence, 40) ||
    firstEvidencePhrase(comp, 40) ||
    firstEvidencePhrase(value, 40) ||
    'the principal motif';

  const lightBit =
    firstEvidencePhrase(value, 36) ||
    anchorSnippet(value, 36) ||
    firstEvidencePhrase(color, 36) ||
    'light and color';

  const surfaceBit =
    firstEvidencePhrase(surface, 36) ||
    anchorSnippet(surface, 36) ||
    preserveSnippet(surface, 36) ||
    firstEvidencePhrase(findCat(categories, 'Edge'), 36) ||
    'surface and edge';

  const bench0 = benchmarks[0]?.trim() ?? '';
  const benchParts = bench0.split(/\s+/).filter(Boolean);
  const masterSurname =
    benchParts.length >= 2 ? benchParts[benchParts.length - 1]! : benchParts[0] ?? 'period';
  const bench1 = benchmarks[1]?.trim() ?? '';
  const bench1Parts = bench1.split(/\s+/).filter(Boolean);
  const secondSurname =
    bench1Parts.length >= 2 ? bench1Parts[bench1Parts.length - 1]! : bench1Parts[0] ?? masterSurname;

  const finishWord =
    completionRead.state === 'likely_finished'
      ? 'resolved'
      : completionRead.state === 'unfinished'
        ? 'in-progress'
        : 'open';

  const t1 = `${motif}, ${truncate(medium, 28)}`;
  const t2 = `${truncate(lightBit, 44)} (${truncate(style, 20)}; ${finishWord})`;
  const t3 = `${truncate(surfaceBit, 40)} — in dialogue with ${masterSurname} and ${secondSurname}`;

  const out = [t1, t2, t3].map((x) => truncate(x.replace(/\s+/g, ' ').trim(), 100));
  return out;
}
