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

function explicitlyNamesPassage(text: string, area: string): boolean {
  const clause = comparable(text);
  const passage = comparable(area);
  return Boolean(clause && passage) && clause.includes(passage);
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

  const lead = explicitlyNamesPassage(issue, area)
    ? sentenceCase(issue)
    : `In ${area}, ${issue}`;

  return `${prefix}${lead}. ${sentenceCase(move)} so ${outcome}.`;
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

  const lead = explicitlyNamesPassage(currentRead, area)
    ? sentenceCase(currentRead)
    : `In ${area}, ${currentRead}`;

  return `${lead}. ${sentenceCase(move)} so ${expectedRead}.`;
}
