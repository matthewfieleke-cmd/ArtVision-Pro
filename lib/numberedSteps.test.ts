import { describe, expect, it } from 'vitest';

import { splitNumberedSteps } from './numberedSteps';

describe('splitNumberedSteps', () => {
  it('returns empty array for empty input', () => {
    expect(splitNumberedSteps('')).toEqual([]);
    expect(splitNumberedSteps('   ')).toEqual([]);
  });

  it('splits newline-numbered steps', () => {
    const text = '1. First step here.\n2. Second step there.';
    expect(splitNumberedSteps(text)).toEqual(['First step here.', 'Second step there.']);
  });

  it('handles parenthesis numbering', () => {
    const text = '1) Do this.\n2) Then that.';
    expect(splitNumberedSteps(text)).toEqual(['Do this.', 'Then that.']);
  });
});
