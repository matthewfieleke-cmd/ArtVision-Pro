import {
  GENERIC_ANCHOR_PATTERNS,
  GROUNDING_TOKEN_STOPWORDS,
  normalizeWhitespace,
} from './critiqueTextRules.js';

export type GroundingMode = 'pass' | 'strictAudit';

export type GroundingEvidence = {
  anchor: string;
  visibleEvidence: string[];
};

function normalizeForComparison(text: string): string {
  return normalizeWhitespace(text).toLowerCase().replace(/[^\w\s]/g, ' ');
}

export function groundingContentTokens(text: string): string[] {
  return Array.from(
    new Set(
      normalizeForComparison(text)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !GROUNDING_TOKEN_STOPWORDS.has(token))
    )
  );
}

function sharedTokenCount(a: string, b: string): number {
  const bTokens = new Set(groundingContentTokens(b));
  return groundingContentTokens(a).filter((token) => bTokens.has(token)).length;
}

function minimumRequiredTokens(text: string): number {
  return Math.min(2, groundingContentTokens(text).length);
}

const GROUNDING_EQUIVALENT_TOKENS: Record<string, string> = {
  background: 'ground',
  backdrop: 'ground',
  ground: 'ground',
  rectangle: 'square',
  square: 'square',
  diamond: 'square',
  rhombus: 'square',
  texture: 'surface',
  textures: 'surface',
  surface: 'surface',
  handling: 'surface',
  mark: 'surface',
  marks: 'surface',
  boundary: 'edge',
  boundaries: 'edge',
  contour: 'edge',
  contours: 'edge',
  edge: 'edge',
  edges: 'edge',
  outline: 'edge',
  outlines: 'edge',
  perimeter: 'edge',
};

function comparableGroundingTokens(text: string): string[] {
  return Array.from(
    new Set(
      groundingContentTokens(text).map((token) =>
        GROUNDING_EQUIVALENT_TOKENS[token] ?? token
      )
    )
  );
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

export function sharesConcreteLanguage(a: string, b: string, minimum: number = 2): boolean {
  if (!normalizeWhitespace(a) || !normalizeWhitespace(b)) return false;
  return sharedTokenCount(a, b) >= minimum;
}

export function anchorSupportedByEvidenceLine(anchor: string, line: string): boolean {
  if (sharesConcreteLanguage(anchor, line, 2)) return true;
  const anchorTokens = comparableGroundingTokens(anchor);
  const lineTokenSet = new Set(comparableGroundingTokens(line));
  return anchorTokens.filter((token) => lineTokenSet.has(token)).length >= 2;
}

export function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = groundingContentTokens(a);
  const bTokens = groundingContentTokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const bSet = new Set(bTokens);
  const matches = aTokens.filter((token) => bSet.has(token)).length;
  return matches / Math.max(aTokens.length, bTokens.length);
}

export function sameAdvice(a: string, b: string): boolean {
  const normalizedA = normalizeWhitespace(a).toLowerCase();
  const normalizedB = normalizeWhitespace(b).toLowerCase();
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  return tokenOverlapRatio(normalizedA, normalizedB) >= 0.72;
}

export function isConcreteAnchor(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 8) return false;
  if (GENERIC_ANCHOR_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return groundingContentTokens(normalized).length >= 2;
}

export function hasAnchorReference(
  text: string,
  anchorSummary: string,
  evidencePointer: string = '',
  mode: GroundingMode = 'pass'
): boolean {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText || !normalizeWhitespace(anchorSummary)) return false;
  if (normalizedContains(normalizedText, anchorSummary)) return true;
  if (normalizeWhitespace(evidencePointer) && normalizedContains(normalizedText, evidencePointer)) return true;

  const anchorShared = sharedTokenCount(normalizedText, anchorSummary);
  const pointerShared = normalizeWhitespace(evidencePointer)
    ? sharedTokenCount(normalizedText, evidencePointer)
    : 0;

  if (mode === 'pass') {
    return (
      anchorShared >= minimumRequiredTokens(anchorSummary) ||
      (normalizeWhitespace(evidencePointer) && pointerShared >= minimumRequiredTokens(evidencePointer)) ||
      (anchorShared >= 1 && pointerShared >= 1)
    );
  }

  const strictAnchorMinimum = minimumRequiredTokens(anchorSummary);
  const strictPointerMinimum = minimumRequiredTokens(evidencePointer);
  return (
    (strictAnchorMinimum > 0 && anchorShared >= strictAnchorMinimum) ||
    (strictPointerMinimum > 0 && pointerShared >= strictPointerMinimum) ||
    (anchorShared >= 1 && pointerShared >= 1)
  );
}

export function tracesToVisibleEvidence(
  text: string,
  evidence: GroundingEvidence,
  mode: GroundingMode = 'pass'
): boolean {
  if (!normalizeWhitespace(text)) return false;
  if (hasAnchorReference(text, evidence.anchor, '', mode)) return true;
  const minimum = mode === 'strictAudit' ? 2 : 2;
  return evidence.visibleEvidence.some((line) => sharesConcreteLanguage(text, line, minimum));
}

export function tracesShortEvidenceSignal(
  text: string,
  evidence: GroundingEvidence
): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return false;
  if (tracesToVisibleEvidence(normalized, evidence, 'pass')) return true;

  const tokens = groundingContentTokens(normalized);
  if (tokens.length === 0) return false;
  if (tokens.length <= 5 && hasAnchorReference(normalized, evidence.anchor, '', 'pass')) return true;

  return evidence.visibleEvidence.some((line) => {
    const overlap = tokens.filter((token) => groundingContentTokens(line).includes(token)).length;
    return overlap >= 1;
  });
}
