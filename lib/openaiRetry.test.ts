import { describe, expect, it, vi } from 'vitest';

import { openAIErrorIsRetryable, withOpenAIRetries } from './openaiRetry.js';

describe('openAIErrorIsRetryable', () => {
  it('treats rate limits and 5xx messages as retryable', () => {
    expect(openAIErrorIsRetryable(new Error('OpenAI error 429'))).toBe(true);
    expect(openAIErrorIsRetryable(new Error('OpenAI error 503'))).toBe(true);
    expect(openAIErrorIsRetryable(new Error('fetch failed'))).toBe(true);
    expect(openAIErrorIsRetryable(new Error('socket hang up'))).toBe(true);
  });

  it('treats validation-style errors as non-retryable', () => {
    expect(openAIErrorIsRetryable(new Error('Observation stage validation failed: x'))).toBe(false);
    expect(openAIErrorIsRetryable(new Error('Model returned non-JSON'))).toBe(false);
  });
});

describe('withOpenAIRetries', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    await expect(withOpenAIRetries('t', fn, { maxAttempts: 3 })).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('OpenAI error 503'))
      .mockResolvedValueOnce('ok');
    await expect(withOpenAIRetries('t', fn, { maxAttempts: 3, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad request'));
    await expect(withOpenAIRetries('t', fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
