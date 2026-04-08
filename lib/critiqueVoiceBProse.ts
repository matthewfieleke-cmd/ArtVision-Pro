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

export function renderStructuredVoiceBStep(args: {
  area: string;
  issue: string;
  move: string;
  outcome: string;
  index?: number;
}): string {
  const area = cleanClause(args.area);
  const issue = cleanClause(args.issue);
  const move = cleanClause(args.move);
  const outcome = cleanClause(args.outcome);
  const prefix = typeof args.index === 'number' ? `${args.index + 1}. ` : '';

  const lead = passageAlreadyReferenced(issue, area)
    ? sentenceCase(issue)
    : `In ${area}, ${issue}`;

  const moveSent = sentenceCase(move);
  const tail = shouldAppendOutcomeAfterMove(move, outcome)
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
  const area = cleanClause(args.area);
  const currentRead = cleanClause(args.currentRead);
  const move = cleanClause(args.move);
  const expectedRead = cleanClause(args.expectedRead);

  const lead = passageAlreadyReferenced(currentRead, area)
    ? sentenceCase(currentRead)
    : `In ${area}, ${currentRead}`;

  const moveSent = sentenceCase(move);
  const tail = shouldAppendOutcomeAfterMove(move, expectedRead)
    ? ` so ${cleanClause(expectedRead)}.`
    : '.';
  return `${lead}. ${moveSent}${tail}`;
}
