import { tokenOverlapRatio } from './critiqueGrounding.js';
import { normalizeWhitespace } from './critiqueTextRules.js';

function cleanClause(text: string): string {
  return normalizeWhitespace(text).replace(/[.!?]+$/, '');
}

function sentenceCase(text: string): string {
  const cleaned = cleanClause(text);
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** After "In ", the following phrase should not look like a sentence break mid-line (use lowercase). */
function lowerFirst(text: string): string {
  const cleaned = cleanClause(text);
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

/**
 * When plan.currentRead (or issue) accidentally repeats anchor.areaSummary as a stacked title
 * before the real read ("The purple wash across the foreground The wash transitions…"),
 * drop the duplicate. Do not strip when the anchor phrase is the grammatical subject of one
 * sentence ("the jaw edge … is no crisper…").
 */
function stripRedundantAnchorPrefix(text: string, area: string): string {
  const cleaned = cleanClause(text);
  const a = cleanClause(area);
  if (!cleaned || !a) return cleaned;
  const tLow = cleaned.toLowerCase();
  const aLow = a.toLowerCase();
  if (!tLow.startsWith(aLow)) return cleaned;
  let rest = cleaned.slice(a.length).trim();
  rest = rest.replace(/^[,;]\s*/, '');
  if (rest.length < 6) return cleaned;
  // Same sentence: "[anchor] is/reads/stays …" — keep full text.
  if (/^(is|are|was|were|reads|stays|has|have|shows|creates|cuts|meets|sits|lies|runs|feels)\b/i.test(rest)) {
    return cleaned;
  }
  // Second clause still largely repeats the anchor tokens (title pasted twice).
  if (passageAlreadyReferenced(rest, area)) {
    return cleaned;
  }
  return rest;
}

/** "[full anchor] The wash …" → drop repeated "The <noun>" when that noun already appears in the anchor. */
function stripStackedTitleEcho(text: string, area: string): string {
  const cleaned = cleanClause(text);
  const a = cleanClause(area);
  if (!cleaned || !a || cleaned.length <= a.length + 4) return cleaned;
  if (!cleaned.toLowerCase().startsWith(a.toLowerCase())) return cleaned;
  let rest = cleaned.slice(a.length).trim();
  rest = rest.replace(/^[,;]\s*/, '');
  const m = rest.match(/^the\s+([a-z]{3,})\b/i);
  if (!m) return cleaned;
  const noun = m[1]!.toLowerCase();
  if (!new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(a)) {
    return cleaned;
  }
  rest = rest.replace(/^the\s+[a-z]{3,}\b\s*/i, '').trim();
  return rest.length >= 8 ? rest : cleaned;
}

function sanitizeAnchoredLead(text: string, area: string): string {
  return stripStackedTitleEcho(stripRedundantAnchorPrefix(text, area), area);
}

export function looksLikeSentenceObservation(text: string): boolean {
  const cleaned = cleanClause(text);
  if (!cleaned) return false;
  if (/[.!?]$/.test(text.trim())) return true;
  if (cleaned.length > 96) return true;
  return /\b(contrasts?|creates?|suggests?|enhances?|making|indicating|showing|highlighting)\b/i.test(cleaned);
}

function looksLikeSentenceLikeArea(text: string): boolean {
  const cleaned = cleanClause(text);
  if (!cleaned) return false;
  if (/[.!?]$/.test(text.trim())) return true;
  if (cleaned.length > 72) return true;
  return /\b(is|are|was|were|creates?|contrasts?|suggests?|enhances?|making|indicating|showing|highlighting)\b/i.test(cleaned);
}

function looksLikeLocationPhrase(text: string): boolean {
  const cleaned = cleanClause(text);
  if (!cleaned) return false;
  return !looksLikeSentenceLikeArea(cleaned);
}

export function sanitizeVoiceBAreaForProse(area: string, fallbackArea?: string): string {
  const cleanedArea = cleanClause(area);
  if (looksLikeLocationPhrase(cleanedArea)) return cleanedArea;
  return cleanClause(fallbackArea || cleanedArea) || 'the anchored passage';
}

function chooseUsableArea(area: string, currentRead: string, move: string): string {
  const cleanedArea = cleanClause(area);
  if (looksLikeLocationPhrase(cleanedArea)) return cleanedArea;
  const read = cleanClause(currentRead);
  const moveClause = cleanClause(move);
  const readMatch = read.match(
    /\b(the|a|an)\s+[a-z0-9'"-]+(?:\s+[a-z0-9'"-]+){0,8}\s+(?:against|between|under|over|where|along|around|beside|near)\s+[a-z0-9'"-]+(?:\s+[a-z0-9'"-]+){0,8}\b/i
  );
  if (readMatch) return readMatch[0]!;
  const moveMatch = moveClause.match(
    /\b(the|a|an)\s+[a-z0-9'"-]+(?:\s+[a-z0-9'"-]+){0,8}\s+(?:against|between|under|over|where|along|around|beside|near)\s+[a-z0-9'"-]+(?:\s+[a-z0-9'"-]+){0,8}\b/i
  );
  if (moveMatch) return moveMatch[0]!;

  return 'the anchored passage';
}

function sanitizeCurrentReadForTeacher(currentRead: string, area: string): string {
  const cleaned = sanitizeAnchoredLead(cleanClause(currentRead), area);
  if (!cleaned) return `the key relationship in ${area} is still doing too much at once`;
  if (!looksLikeSentenceObservation(cleaned) && !passageAlreadyReferenced(cleaned, area)) {
    return `the key relationship in ${area} is still doing too much at once`;
  }
  return cleaned;
}

function sanitizeMoveForTeacher(move: string, area: string): string {
  const cleaned = cleanClause(move);
  if (!cleaned) return `adjust the clearest relationship in ${area}`;
  if (
    /\b(?:in|along|around|against)\s+the\s+[a-z].*\b(contrasts?|creates?|suggests?|enhances?|making|indicating|showing|highlighting)\b/i.test(
      cleaned
    )
  ) {
    return `adjust the clearest relationship in ${area}`;
  }
  if (looksLikeSentenceObservation(cleaned) && !/^(soften|group|separate|darken|quiet|restate|widen|narrow|cool|warm|sharpen|lose|compress|vary|lighten|lift|simplify|straighten|merge|break|integrate|adjust|reduce|shift|refine|preserve|keep|protect|leave|hold|maintain|continue)\b/i.test(cleaned)) {
    return `adjust the clearest relationship in ${area}`;
  }
  return cleaned;
}

export function sanitizeVoiceBMoveForProse(move: string, area: string): string {
  return sanitizeMoveForTeacher(move, area);
}

function comparable(text: string): string {
  return cleanClause(text).toLowerCase();
}

const LEAD_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'it',
  'this',
  'that',
  'these',
  'those',
  'with',
  'from',
  'by',
  'into',
  'through',
  'than',
  'then',
  'so',
  'too',
  'very',
  'just',
  'only',
  'also',
  'not',
  'no',
  'if',
  'when',
  'while',
  'its',
  'their',
]);

function contentTokens(phrase: string): string[] {
  return comparable(phrase)
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter((w) => w.length > 2 && !LEAD_STOPWORDS.has(w));
}

/**
 * True when `text` already situates the reader in the same passage as `area`
 * (substring match, or most anchor content words appear in text).
 * Avoids "In the distant house against the horizon, the house is small against the horizon…".
 */
export function passageAlreadyReferenced(text: string, area: string): boolean {
  if (explicitlyNamesPassage(text, area)) return true;
  const clause = comparable(text);
  const areaTokens = contentTokens(area);
  if (areaTokens.length === 0) return false;
  const hits = areaTokens.filter((t) => {
    const boundary = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return boundary.test(clause);
  }).length;
  return hits / areaTokens.length >= 0.65;
}

function explicitlyNamesPassage(text: string, area: string): boolean {
  const clause = comparable(text);
  const passage = comparable(area);
  return Boolean(clause && passage) && clause.includes(passage);
}

const READS_SOONER_LIKE =
  /\b(reads sooner|reads more clearly|reads more decisively|reads sooner without|structure reads|separation reads|hierarchy reads|passage reads)\b/i;

/**
 * When `move` already ends with "so …" (from normalization templates), appending
 * " so {expectedRead}" stacks two outcomes ("…value structure reads sooner so the light-dark separation reads sooner").
 */
function shouldAppendOutcomeAfterMove(move: string, expectedRead: string): boolean {
  const m = cleanClause(move);
  const e = cleanClause(expectedRead);
  if (!m || !e) return Boolean(e);

  const lower = m.toLowerCase();
  const lastSo = lower.lastIndexOf(' so ');
  if (lastSo === -1) return true;

  const tail = m.slice(lastSo + 4).trim();
  const tailLow = tail.toLowerCase();
  const eLow = e.toLowerCase();

  if (READS_SOONER_LIKE.test(tail) && READS_SOONER_LIKE.test(e)) {
    return false;
  }

  if (tokenOverlapRatio(tailLow, eLow) >= 0.45) {
    return false;
  }

  if (eLow.length >= 12 && tailLow.includes(eLow.slice(0, 12))) {
    return false;
  }
  if (tailLow.length >= 12 && eLow.includes(tailLow.slice(0, 12))) {
    return false;
  }

  if (
    /\b(carries the painting'?s intent more decisively|carries the human pressure more clearly)\b/i.test(tail) &&
    /\b(intent reads|narrative|viewer'?s attention|focal point|seclusion|atmosphere)\b/i.test(eLow)
  ) {
    return true;
  }

  return true;
}

function leadOverlapsExpectedRead(lead: string, expectedRead: string): boolean {
  const l = comparable(lead);
  const e = comparable(expectedRead);
  if (!l || !e) return false;
  return tokenOverlapRatio(l, e) >= 0.32;
}

export function renderStructuredVoiceBStep(args: {
  area: string;
  issue: string;
  move: string;
  outcome: string;
  index?: number;
}): string {
  const area = cleanClause(args.area);
  const issue = sanitizeAnchoredLead(cleanClause(args.issue), area);
  const move = cleanClause(args.move);
  const outcome = cleanClause(args.outcome);
  const prefix = typeof args.index === 'number' ? `${args.index + 1}. ` : '';

  const lead = passageAlreadyReferenced(issue, area)
    ? sentenceCase(issue)
    : `In ${lowerFirst(area)}, ${lowerFirst(issue)}`;

  const moveSent = sentenceCase(move);
  const tail =
    shouldAppendOutcomeAfterMove(move, outcome) && !leadOverlapsExpectedRead(lead, outcome)
      ? ` so ${cleanClause(outcome)}.`
      : '.';
  return `${prefix}${lead}. ${moveSent}${tail}`;
}

export function renderGroundedTeacherNextSteps(args: {
  area: string;
  currentRead: string;
  move: string;
  expectedRead: string;
}): string {
  const area = looksLikeSentenceLikeArea(args.area)
    ? chooseUsableArea(args.area, args.currentRead, args.move)
    : cleanClause(args.area);
  const currentRead = sanitizeCurrentReadForTeacher(args.currentRead, area);
  const move = sanitizeMoveForTeacher(args.move, area);
  const expectedRead = cleanClause(args.expectedRead);

  const lead = passageAlreadyReferenced(currentRead, area)
    ? sentenceCase(currentRead)
    : `In ${lowerFirst(area)}, ${lowerFirst(currentRead)}`;

  const moveSent = sentenceCase(move);
  const tail =
    shouldAppendOutcomeAfterMove(move, expectedRead) && !leadOverlapsExpectedRead(lead, expectedRead)
      ? ` so ${cleanClause(expectedRead)}.`
      : '.';
  return `${lead}. ${moveSent}${tail}`;
}
