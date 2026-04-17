import { describe, expect, it } from 'vitest';

import { LAUNCH_TAB_QUERY, tabFromSearch } from './launchUrls';

describe('tabFromSearch', () => {
  it('parses tab from query string', () => {
    expect(tabFromSearch(`?${LAUNCH_TAB_QUERY}=studio`)).toBe('studio');
    expect(tabFromSearch(`${LAUNCH_TAB_QUERY}=glossary`)).toBe('glossary');
  });

  it('is case-insensitive', () => {
    expect(tabFromSearch(`?${LAUNCH_TAB_QUERY}=HOME`)).toBe('home');
  });

  it('returns null for unknown or missing', () => {
    expect(tabFromSearch('')).toBe(null);
    expect(tabFromSearch(`?${LAUNCH_TAB_QUERY}=nope`)).toBe(null);
  });
});
