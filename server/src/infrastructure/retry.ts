const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;

function isRetryable(error: unknown): boolean {
  const err = error as { status?: number; code?: string; message?: string };
  const status = err?.status;
  if (status === 429 || (status && status >= 500)) return true;
  const code = (err?.code ?? '').toLowerCase();
  if (code === 'econnreset' || code === 'etimedout' || code === 'econnrefused') return true;
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('429')) return true;
  if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('network')) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; initialDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !isRetryable(err)) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
