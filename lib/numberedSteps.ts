function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Splits either newline-numbered or inline-numbered instructional text into
 * clean individual steps while preserving sentence punctuation inside a step.
 */
export function splitNumberedSteps(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const matches = normalized.match(/(?:^|[\n\s])(\d+[\.\)])\s+.*?(?=(?:[\n\s]+\d+[\.\)]\s+)|$)/gs);
  if (!matches) return [];
  return matches
    .map((step) =>
      normalizeWhitespace(step.replace(/^(?:^|[\n\s])?\d+[\.\)]\s+/, ''))
    )
    .filter(Boolean);
}
