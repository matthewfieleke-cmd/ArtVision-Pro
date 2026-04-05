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

export type AnchorSupportMatch = {
  line: string;
  score: number;
  exactSharedTokens: string[];
  comparableSharedTokens: string[];
  containsAnchorText: boolean;
  hasRelationCue: boolean;
  hasVisibleEventCue: boolean;
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

function sharedGroundingTokens(a: string, b: string): string[] {
  const bTokens = new Set(groundingContentTokens(b));
  return groundingContentTokens(a).filter((token) => bTokens.has(token));
}

function minimumRequiredTokens(text: string): number {
  return Math.min(2, groundingContentTokens(text).length);
}

const GROUNDING_EQUIVALENT_TOKENS: Record<string, string> = {
  lead: 'lead',
  leads: 'lead',
  leading: 'lead',
  figure: 'human',
  figures: 'human',
  person: 'human',
  people: 'human',
  body: 'human',
  torso: 'human',
  shirt: 'human',
  shirts: 'human',
  clothing: 'human',
  clothes: 'human',
  head: 'human',
  face: 'human',
  gaze: 'human',
  shoulder: 'human',
  shoulders: 'human',
  arm: 'human',
  arms: 'human',
  leg: 'human',
  legs: 'human',
  seated: 'pose',
  sitting: 'pose',
  sits: 'pose',
  sat: 'pose',
  sitter: 'pose',
  reclining: 'pose',
  reclined: 'pose',
  reclines: 'pose',
  lying: 'pose',
  recliner: 'pose',
  posture: 'pose',
  pose: 'pose',
  poses: 'pose',
  stance: 'pose',
  couch: 'couch',
  sofa: 'couch',
  shore: 'shore',
  shoreline: 'shore',
  seashore: 'shore',
  coast: 'shore',
  coastal: 'shore',
  landscape: 'ground',
  colorful: 'color',
  colours: 'color',
  colors: 'color',
  color: 'color',
  vibrant: 'color',
  rocks: 'rock',
  rocky: 'rock',
  rock: 'rock',
  tree: 'tree',
  trunk: 'tree',
  trunks: 'tree',
  branch: 'branch',
  branches: 'branch',
  umbrella: 'umbrella',
  umbrellas: 'umbrella',
  table: 'table',
  tables: 'table',
  building: 'building',
  buildings: 'building',
  path: 'path',
  paths: 'path',
  walkway: 'path',
  road: 'path',
  roads: 'path',
  chair: 'chair',
  chairs: 'chair',
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

function sharedComparableGroundingTokens(a: string, b: string): string[] {
  const bTokens = new Set(comparableGroundingTokens(b));
  return comparableGroundingTokens(a).filter((token) => bTokens.has(token));
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = normalizeWhitespace(haystack).toLowerCase();
  const n = normalizeWhitespace(needle).toLowerCase();
  return n.length > 0 && h.includes(n);
}

const GROUNDING_RELATION_CUE_PATTERN =
  /\b(against|between|beside|under|over|above|below|behind|before|after|near|where|meets?|meeting|along|across|through|into|toward|around|inside|outside|beneath|within|with|than)\b/i;
const GROUNDING_VISIBLE_EVENT_PATTERN =
  /\b(narrows?|widens?|cuts?|leaves?|stacks?|overlaps?|aligns?|tilts?|bends?|passes?|stays?|sits?|breaks?|turns?|meets?|crosses?|repeats?|rises?|drops?|lands?|compresses?|leans?|holds?|separates?|contrasts?|opens?|closes?|curves?|echoes?|frames?|interrupts?|follows?|bridges?|steps?|pulls?)\b/i;

export function hasVisibleEventLanguage(text: string): boolean {
  return GROUNDING_VISIBLE_EVENT_PATTERN.test(normalizeWhitespace(text));
}

function evaluateAnchorSupportLine(anchor: string, line: string): AnchorSupportMatch | undefined {
  const normalizedAnchor = normalizeWhitespace(anchor);
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedAnchor || !normalizedLine) return undefined;

  const exactSharedTokens = sharedGroundingTokens(normalizedAnchor, normalizedLine);
  const comparableSharedTokens = sharedComparableGroundingTokens(normalizedAnchor, normalizedLine);
  const containsAnchorText = normalizedContains(normalizedLine, normalizedAnchor);
  const hasRelationCue = GROUNDING_RELATION_CUE_PATTERN.test(normalizedLine);
  const hasVisibleEventCue = hasVisibleEventLanguage(normalizedLine);
  const anchorHasRelationCue = GROUNDING_RELATION_CUE_PATTERN.test(normalizedAnchor);

  const hasMinimumTokenSupport =
    comparableSharedTokens.length >= 2 && (exactSharedTokens.length >= 1 || containsAnchorText);
  const hasPassageLanguage = containsAnchorText || hasRelationCue || hasVisibleEventCue;
  if (!hasMinimumTokenSupport || !hasPassageLanguage) return undefined;
  if (anchorHasRelationCue && !containsAnchorText && !hasRelationCue) return undefined;

  const score =
    comparableSharedTokens.length * 5 +
    exactSharedTokens.length * 7 +
    (containsAnchorText ? 12 : 0) +
    (hasRelationCue ? 2 : 0) +
    (hasVisibleEventCue ? 3 : 0);

  return {
    line: normalizedLine,
    score,
    exactSharedTokens,
    comparableSharedTokens,
    containsAnchorText,
    hasRelationCue,
    hasVisibleEventCue,
  };
}

export function sharesConcreteLanguage(a: string, b: string, minimum: number = 2): boolean {
  if (!normalizeWhitespace(a) || !normalizeWhitespace(b)) return false;
  return sharedTokenCount(a, b) >= minimum;
}

export function anchorSupportedByEvidenceLine(anchor: string, line: string): boolean {
  return Boolean(evaluateAnchorSupportLine(anchor, line));
}

export function findPrimaryAnchorSupportLine(
  anchor: string,
  lines: string[]
): AnchorSupportMatch | undefined {
  const candidates = lines
    .map((line) => evaluateAnchorSupportLine(anchor, line))
    .filter((match): match is AnchorSupportMatch => Boolean(match));

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.containsAnchorText !== a.containsAnchorText) return Number(b.containsAnchorText) - Number(a.containsAnchorText);
    if (b.exactSharedTokens.length !== a.exactSharedTokens.length) {
      return b.exactSharedTokens.length - a.exactSharedTokens.length;
    }
    return b.comparableSharedTokens.length - a.comparableSharedTokens.length;
  })[0];
}

export function anchorSupportedByEvidenceLines(anchor: string, lines: string[]): boolean {
  return Boolean(findPrimaryAnchorSupportLine(anchor, lines));
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

export function tracesToPrimarySupportLine(
  text: string,
  evidence: GroundingEvidence,
  mode: GroundingMode = 'pass'
): boolean {
  if (!normalizeWhitespace(text)) return false;
  const primarySupport = findPrimaryAnchorSupportLine(evidence.anchor, evidence.visibleEvidence)?.line ?? '';
  if (hasAnchorReference(text, evidence.anchor, primarySupport, mode)) return true;
  if (!primarySupport) return false;
  return sharesConcreteLanguage(text, primarySupport, 2);
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
