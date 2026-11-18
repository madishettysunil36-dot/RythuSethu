export interface FetchRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  onRetry?: (info: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    status: number | null;
  }) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [429, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterHeader: string | null,
): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(maxDelayMs, seconds * 1000);
    }
  }
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * 350);
  return Math.min(maxDelayMs, exponential + jitter);
}

/**
 * Performs a fetch request with exponential backoff + jitter on transient
 * 503 / 429 / 502 / 504 responses and network errors.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelayMs = 800,
    maxDelayMs = 8000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    onRetry,
  } = options;

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(input, init);
      if (!retryableStatuses.includes(response.status) || attempt > maxRetries) {
        return response;
      }

      lastResponse = response;
      const delayMs = computeDelayMs(
        attempt,
        baseDelayMs,
        maxDelayMs,
        response.headers.get('Retry-After'),
      );
      onRetry?.({
        attempt,
        maxRetries,
        delayMs,
        status: response.status,
      });
      await sleep(delayMs);
    } catch (err) {
      lastError = err;
      if (attempt > maxRetries || (init?.signal && init.signal.aborted)) {
        throw err;
      }
      const delayMs = computeDelayMs(attempt, baseDelayMs, maxDelayMs, null);
      onRetry?.({
        attempt,
        maxRetries,
        delayMs,
        status: null,
      });
      await sleep(delayMs);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error('Network request failed after retries.');
}
