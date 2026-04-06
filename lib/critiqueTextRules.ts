/**
 * Single source for generic / vague coaching patterns and verb anchors used across
 * critiqueValidation, critiqueEval, critiqueAudit, and critiqueWritingStage (Zod refinements).
 */

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function matchesAnyRegExp(text: string, patterns: readonly RegExp[]): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return false;
  return patterns.some((pattern) => pattern.test(normalized));
}

/** Stock “art coach” phrasing we reject in Voice B–style fields. */
export const GENERIC_TEACHER_PATTERNS: RegExp[] = [
  /\bimprove composition\b/i,
  /\bpush the contrast\b/i,
  /\bincrease contrast\b/i,
  /\brefine edges\b/i,
  /\bimprove spatial clarity\b/i,
  /\badd more depth\b/i,
  /\benhance focus\b/i,
  /\bstronger focal point\b/i,
  /\bdevelop the\b/i,
  /\bexplore\b/i,
  /\bcontinue to\b/i,
  /\bexperiment with\b/i,
  /\bmake it more dynamic\b/i,
];

/** Anchors that are too vague for grounding checks (whole label only, not substrings). */
export const GENERIC_ANCHOR_PATTERNS: RegExp[] = [
  /^\s*the background\s*$/i,
  /^\s*the foreground\s*$/i,
  /^\s*left side of the painting\s*$/i,
  /^\s*right side of the painting\s*$/i,
  /^\s*center of the painting\s*$/i,
  /^\s*the painting overall\s*$/i,
  /^\s*composition overall\s*$/i,
  /^\s*arrangement of elements\s*$/i,
  /^\s*the arrangement of .+\s*$/i,
  /^\s*spatial relationships\s*$/i,
  /^\s*compositional flow\s*$/i,
  /^\s*the narrative journey(?: .+)?\s*$/i,
  /^\s*the cozy .+\s*$/i,
  /^\s*the idyllic .+\s*$/i,
  /^\s*the vibrant (garden|setting|scene|flowers?)\b.*$/i,
  /^\s*transition from .+\bto\b.+$/i,
  /^\s*(?:the\s+)?(?:interaction|alignment|movement|energy|presence|atmosphere|mood|story|narrative|power|force|gesture|relationship)\s+of .+$/i,
];

/**
 * Underspecified studio / teacher lines (audit rewrite + eval vagueVoiceB + eval genericNextSteps).
 * Keep in sync when adding new anti-patterns.
 */
export const VAGUE_OR_GENERIC_STUDIO_PATTERNS: RegExp[] = [
  /\bdefine\b.*\bedges?\b.*\bmore clearly\b/i,
  /\benhance\b.*\bfocus hierarchy\b/i,
  /\benhance\b.*\bnarrative\b/i,
  /\badd\b.*\bsmall details\b/i,
  /\badd(?:ing)?\b.*\bmore definition\b/i,
  /\bcontribute to the story\b/i,
  /\bsmooth out\b.*\bcolor transitions\b/i,
  /\benhance\b.*\brealism\b/i,
  /\benhance\b.*\bspatial depth\b/i,
  /\benhance\b.*\bmedium handling\b/i,
  /\bimprove the focus where needed\b/i,
  /\bimprove\b.*\bfocus control\b/i,
  /\bimprove the main focal area\b/i,
  /\bblend more naturally\b/i,
  /\bintegrate\b.*\b(?:scene|background|atmosphere)\b/i,
  /\boverall atmosphere\b/i,
  /\bwithout losing\b.*\bpresence\b/i,
  /\bintroduce more varied texture\b/i,
  /\busing a combination of\b/i,
  /\bmore engaging\b/i,
  /\bstand out more distinctly\b/i,
  /\benhancing\b.*\bpresence\b/i,
  /\bkey spatial relationship\b/i,
  /increase contrast/i,
  /enhance definition/i,
  /background figures?/i,
  /without disrupting/i,
  /remain harmonious/i,
  /support the overall mood/i,
  /maintain(?:ing)?\s+(?:the\s+)?overall\s+(?:spatial coherence|coherence|mood|clarity|balance)/i,
  /ensure\b.*\b(?:harmonious|coherent|clarity|spatial coherence)/i,
  /enhance\b.*\bvibrancy\b.*\bcoherence/i,
  /refine edges/i,
  /refine the texture transitions/i,
  /create a stronger focal point/i,
  /improve spatial clarity/i,
  /more cohesive/i,
  /enhance focus/i,
  /\brefine the edges\b/i,
  /\badjust the lighting\b/i,
  /\badd subtle variations\b/i,
];

export const GENERIC_MAIN_ISSUE_PATTERNS: RegExp[] = [
  /clearer focal/i,
  /stronger focal/i,
  /enhance depth/i,
  /more depth/i,
  /more contrast/i,
  /spatial definition/i,
  /guide the viewer/i,
  /more cohesion/i,
];

export const GENERIC_VOICE_A_PATTERNS: RegExp[] = [
  /\bcaptures?\b/i,
  /\beffectively uses?\b/i,
  /\bcreates a sense of\b/i,
  /\bstrong sense of\b/i,
  /\baims to\b/i,
];

export function isGenericTeacherText(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  return GENERIC_TEACHER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isVagueOrGenericStudioText(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  return VAGUE_OR_GENERIC_STUDIO_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Non-Master moves must start with one of these change verbs. */
export const CRITIQUE_CHANGE_VERB_PATTERN =
  /^\s*(soften|group|separate|darken|quiet|restate|widen|narrow|cool|warm|sharpen|lose|compress|vary|lighten|lift|simplify|straighten|merge|break|integrate|adjust|reduce|shift|refine)\b/i;

/**
 * Master / preserve-only moves. Includes maintain|continue for validation parity with
 * critiqueValidation Voice B rules.
 */
export const CRITIQUE_PRESERVE_VERB_PATTERN =
  /^\s*(preserve|keep|protect|leave|hold|maintain|continue)\b/i;

export const CRITIQUE_DONT_CHANGE_PATTERN = /^\s*(?:1\.\s*)?don['\u2019]t change a thing\./i;

export const CRITIQUE_TOKEN_STOPWORDS = new Set([
  'about',
  'across',
  'after',
  'around',
  'artist',
  'because',
  'before',
  'behind',
  'between',
  'canvas',
  'could',
  'figure',
  'from',
  'into',
  'left',
  'main',
  'near',
  'over',
  'painting',
  'passage',
  'right',
  'same',
  'should',
  'some',
  'that',
  'their',
  'there',
  'these',
  'this',
  'through',
  'toward',
  'under',
  'with',
]);

/**
 * Extra stopwords for grounding token overlap (used with min token length 3).
 * Keeps short pictorial words (sky, wet, sea, hull, mast, rim) while stripping grammar.
 */
const GROUNDING_EXTRA_STOPWORDS: readonly string[] = [
  'the',
  'and',
  'or',
  'but',
  'nor',
  'not',
  'for',
  'its',
  'are',
  'was',
  'were',
  'been',
  'being',
  'have',
  'has',
  'had',
  'does',
  'did',
  'doing',
  'done',
  'will',
  'would',
  'than',
  'then',
  'too',
  'very',
  'just',
  'also',
  'only',
  'such',
  'each',
  'every',
  'both',
  'most',
  'more',
  'less',
  'few',
  'any',
  'all',
  'own',
  'other',
  'yet',
  'when',
  'what',
  'which',
  'while',
  'where',
  'whose',
  'whom',
  'how',
  'why',
  'can',
  'may',
  'must',
];

/** Union of CRITIQUE_TOKEN_STOPWORDS and grammar words for anchor/evidence overlap. */
export const GROUNDING_TOKEN_STOPWORDS = new Set<string>([
  ...CRITIQUE_TOKEN_STOPWORDS,
  ...GROUNDING_EXTRA_STOPWORDS,
]);
