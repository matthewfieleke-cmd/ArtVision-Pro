import { describe, expect, it } from 'vitest';

import {
  GLOSSARY_ENTRIES,
  findGlossaryEntriesForText,
  normalizeGlossarySearchText,
  searchGlossaryEntries,
} from './glossaryData';

describe('glossaryData', () => {
  it('contains expanded general and criterion sections', () => {
    expect(GLOSSARY_ENTRIES.length).toBeGreaterThan(20);
    expect(GLOSSARY_ENTRIES.some((entry) => entry.section === 'General')).toBe(true);
    expect(
      GLOSSARY_ENTRIES.some((entry) => entry.section === 'Composition and shape structure')
    ).toBe(true);
  });

  it('matches terms through aliases and examples', () => {
    const matches = searchGlossaryEntries('scumble');
    const terms = matches.map((entry) => entry.term);
    expect(terms).toContain('Scumble');
    expect(searchGlossaryEntries('edge').map((entry) => entry.term)).toContain('Edge');
  });

  it('normalizes punctuation and casing for search', () => {
    expect(normalizeGlossarySearchText('Chroma / Saturation')).toBe('chroma saturation');
  });

  it('finds likely glossary terms inside critique text snippets', () => {
    const matches = findGlossaryEntriesForText([
      'Sharpen the jaw-to-collar edge so the focal hierarchy reads sooner.',
    ]);
    const terms = matches.map((entry) => entry.term);
    expect(terms).toContain('Edge');
    expect(terms).toContain('Focal hierarchy');
  });
});
