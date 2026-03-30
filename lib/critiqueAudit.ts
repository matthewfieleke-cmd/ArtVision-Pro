import type { CritiqueResultDTO } from './critiqueTypes.js';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

function hasConcreteAnchorReference(text: string, anchorSummary: string): boolean {
  if (!anchorSummary.trim()) return false;
  if (normalizedContains(text, anchorSummary)) return true;
  const fallbackTokens = anchorSummary
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
  return fallbackTokens.some((token) => normalizeWhitespace(text).toLowerCase().includes(token));
}

function alignedStudioChanges(critique: CritiqueResultDTO): boolean {
  if (!critique.simpleFeedback) return true;
  const categoryByCriterion = new Map(
    critique.categories.map((category) => [category.criterion, category] as const)
  );
  return critique.simpleFeedback.studioChanges.every((change) => {
    const category = categoryByCriterion.get(change.previewCriterion);
    if (!category?.anchor) return false;
    return hasConcreteAnchorReference(change.text, category.anchor.areaSummary);
  });
}

export function critiqueNeedsFreshEvidenceRead(critique: CritiqueResultDTO): boolean {
  for (const category of critique.categories) {
    const anchor = category.anchor;
    if (!anchor) return true;
    if (!hasConcreteAnchorReference(category.feedback, anchor.areaSummary)) return true;
    if (!hasConcreteAnchorReference(category.actionPlan, anchor.areaSummary)) return true;
    if (!normalizedContains(category.editPlan?.targetArea ?? '', anchor.areaSummary)) return true;
  }
  return !alignedStudioChanges(critique);
}

export function applyCritiqueGuardrails(critique: CritiqueResultDTO): CritiqueResultDTO {
  return critique;
}
