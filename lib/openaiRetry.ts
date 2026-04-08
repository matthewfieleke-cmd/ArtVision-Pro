/**
 * Shared retry policy for OpenAI Chat Completions used in the critique pipeline.
 * Retries transient HTTP/API failures only (not validation, truncation, or bad JSON).
 */

const RETRYABLE_HTTP_STATUS = new Set([408, 409, 429, 500, 502, 503, 529]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when another attempt might succeed (rate limits, server errors, network blips). */
export function openAIErrorIsRetryable(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = msg.toLowerCase();
  if (
    /\b(429|500|502|503|529)\b/.test(msg) ||
    /openai error (429|500|502|503|529)\b/i.test(msg)
  ) {
    return true;
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('overloaded') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up') ||
    lower.includes('network') ||
    lower.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

export function openAIHttpStatusIsRetryable(status: number): boolean {
  return RETRYABLE_HTTP_STATUS.has(status);
}

/**
 * Runs `fn` up to `maxAttempts` times with exponential backoff + jitter on retryable failures.
 */
export async function withOpenAIRetries<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = options?.baseDelayMs ?? 450;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const retryable = openAIErrorIsRetryable(e);
      if (!retryable || attempt === maxAttempts) {
        throw e;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 150;
      console.warn(
        `[openai retry ${label}] attempt ${attempt}/${maxAttempts} failed: ${e instanceof Error ? e.message : String(e)}; retrying in ${Math.round(delay)}ms`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}
