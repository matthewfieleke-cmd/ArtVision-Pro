import { describe, expect, it } from 'vitest';
import { findStripeReturnParams } from './stripeReturnParams';

describe('findStripeReturnParams', () => {
  it('reads payment success from router search', () => {
    const match = findStripeReturnParams({
      routerSearch: '?payment=success&jwt=abc&kind=critique',
    });

    expect(match?.source).toBe('router');
    expect(match?.params.get('jwt')).toBe('abc');
    expect(match?.params.get('kind')).toBe('critique');
  });

  it('falls back to browser search when router search is empty', () => {
    const match = findStripeReturnParams({
      routerSearch: '',
      browserSearch: '?payment=success&jwt=abc&kind=preview_edit',
    });

    expect(match?.source).toBe('browser');
    expect(match?.params.get('kind')).toBe('preview_edit');
  });

  it('falls back to hash query when needed', () => {
    const match = findStripeReturnParams({
      routerSearch: '',
      browserSearch: '',
      hash: '#/?payment=success&jwt=abc&kind=critique',
    });

    expect(match?.source).toBe('hash');
    expect(match?.params.get('payment')).toBe('success');
  });

  it('ignores unrelated queries', () => {
    const match = findStripeReturnParams({
      routerSearch: '?tab=home',
      browserSearch: '?foo=bar',
      hash: '#/?tab=home',
    });

    expect(match).toBeNull();
  });
});
