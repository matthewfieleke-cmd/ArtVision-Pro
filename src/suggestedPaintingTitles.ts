import type { CritiqueCategory, Medium, SuggestedTitle } from './types';

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

function levelLabel(cat: CritiqueCategory | undefined): string {
  return cat?.level ?? 'developing';
}

function findCat(categories: CritiqueCategory[], needle: string): CritiqueCategory | undefined {
  return categories.find((c) => c.criterion.includes(needle));
}

/**
 * Three categorized title suggestions for offline / heuristic critiques.
 */
export function buildLocalSuggestedPaintingTitles(
  medium: Medium,
  categories: CritiqueCategory[]
): SuggestedTitle[] {
  const comp = findCat(categories, 'Composition');
  const value = findCat(categories, 'Value and light');
  const color = findCat(categories, 'Color');
  const drawing = findCat(categories, 'Drawing');
  const surface = findCat(categories, 'Surface');
  const edge = findCat(categories, 'Edge');
  const intent = findCat(categories, 'Intent');
  const presence = findCat(categories, 'Presence');

  const structuralAnchor =
    anchorSnippet(comp, 40) ||
    anchorSnippet(value, 40) ||
    anchorSnippet(drawing, 40) ||
    firstEvidencePhrase(comp, 40) ||
    'the principal structure';

  const valueBit =
    firstEvidencePhrase(value, 36) ||
    anchorSnippet(value, 36) ||
    firstEvidencePhrase(color, 36) ||
    'value and light';

  const surfaceBit =
    firstEvidencePhrase(surface, 36) ||
    anchorSnippet(surface, 36) ||
    preserveSnippet(surface, 36) ||
    firstEvidencePhrase(edge, 36) ||
    'surface handling';

  const intentBit =
    firstEvidencePhrase(intent, 40) ||
    anchorSnippet(intent, 40) ||
    firstEvidencePhrase(presence, 40) ||
    anchorSnippet(presence, 40) ||
    'the underlying intent';

  const formalistTitle = `Study in ${truncate(valueBit, 44)}: ${truncate(structuralAnchor, 40)}`;
  const tactileTitle = `${truncate(titleCaseFragment(medium), 28)} Exploration: ${truncate(surfaceBit, 44)}`;
  const intentTitle = truncate(titleCaseFragment(intentBit), 80);

  return [
    {
      category: 'formalist',
      title: truncate(formalistTitle, 100),
      rationale: `Composition reads at ${levelLabel(comp)} and value structure at ${levelLabel(value)}. The dominant structural element is ${structuralAnchor.toLowerCase()}.`,
    },
    {
      category: 'tactile',
      title: truncate(tactileTitle, 100),
      rationale: `Surface handling reads at ${levelLabel(surface)} in ${medium.toLowerCase()} and edge control at ${levelLabel(edge)}. The key physical characteristic is ${surfaceBit.toLowerCase()}.`,
    },
    {
      category: 'intent',
      title: intentTitle,
      rationale: `Intent reads at ${levelLabel(intent)} and presence at ${levelLabel(presence)}. ${titleCaseFragment(intentBit)} captures the core psychological weight.`,
    },
  ];
}
