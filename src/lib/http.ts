/**
 * HTTP client wrapper with retry logic for Azure CU API calls.
 * Uses native fetch with exponential backoff and configurable retries.
 */

import { CliError, ErrorCodes } from './errors.js';

/**
 * Request body type compatible with fetch.
 */
type RequestBody = string | FormData | Blob | ArrayBuffer | URLSearchParams | ReadableStream<Uint8Array>;

/**
 * HTTP request options.
 */
export interface HttpRequestOptions {
  /** Request method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON.stringify'd if object) */
  body?: RequestBody | Record<string, unknown> | unknown[];
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number;
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * HTTP response wrapper.
 */
export interface HttpResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Parsed response body */
  data: T;
  /** Whether the response was successful (2xx) */
  ok: boolean;
}

/**
 * Default configuration for HTTP client.
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * HTTP status codes that should trigger a retry.
 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Delays execution for the specified duration.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Converts Headers object to plain object.
 */
function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Determines if an error or status code is retryable.
 */
function isRetryable(error: unknown, status?: number): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
    return true;
  }

  // Check retryable status codes
  if (status !== undefined && RETRYABLE_STATUS_CODES.includes(status)) {
    return true;
  }

  return false;
}

/**
 * Calculates the retry delay using exponential backoff with jitter.
 */
function calculateRetryDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter: ±25% randomization
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Makes an HTTP request with retry logic.
 * @param url - The URL to request
 * @param options - Request options
 * @returns Parsed response
 */
export async function httpRequest<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
  const { method = 'GET', headers = {}, body, timeout = DEFAULT_CONFIG.timeout, maxRetries = DEFAULT_CONFIG.maxRetries, retryDelay = DEFAULT_CONFIG.retryDelay, signal } = options;

  let lastError: Error | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create abort controller for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine external signal with timeout signal
    const combinedSignal = signal !== undefined
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      // Prepare request body
      let requestBody: RequestBody | undefined;
      const requestHeaders: Record<string, string> = { ...headers };

      if (body !== undefined) {
        if (typeof body === 'string' || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
          requestBody = body;
        } else {
          requestBody = JSON.stringify(body);
          requestHeaders['Content-Type'] ??= 'application/json';
        }
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(requestBody !== undefined && { body: requestBody }),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;

      // Parse response body
      let data: T;
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else if (contentType.includes('text/')) {
        data = (await response.text()) as T;
      } else {
        // Return raw blob for binary content
        data = (await response.blob()) as T;
      }

      // Check if we should retry on error status
      if (!response.ok && isRetryable(undefined, response.status) && attempt < maxRetries) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('retry-after');
        const retryMs = retryAfter !== null && retryAfter !== ''
          ? (parseInt(retryAfter, 10) || 1) * 1000
          : calculateRetryDelay(attempt, retryDelay);

        await delay(retryMs, signal);
        continue;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        data,
        ok: response.ok,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const caughtError = err instanceof Error ? err : new Error(String(err));
      lastError = caughtError;

      // Check if request was aborted by user
      if (signal?.aborted === true) {
        throw new CliError(
          ErrorCodes.OPERATION_CANCELLED,
          'Request cancelled',
          'The request was cancelled by the user',
          'Run the command again to retry'
        );
      }

      // Check for timeout
      if (caughtError.name === 'AbortError' || caughtError.message.includes('aborted')) {
        if (attempt < maxRetries) {
          await delay(calculateRetryDelay(attempt, retryDelay), signal);
          continue;
        }
        throw new CliError(
          ErrorCodes.API_TIMEOUT,
          'Request timed out',
          `The request to ${url} exceeded the timeout of ${timeout}ms`,
          'Check your network connection and try again. Use --verbose for more details.'
        );
      }

      // Check if error is retryable
      if (isRetryable(caughtError) && attempt < maxRetries) {
        await delay(calculateRetryDelay(attempt, retryDelay), signal);
        continue;
      }

      // Non-retryable error
      throw new CliError(ErrorCodes.API_ERROR, `HTTP request failed: ${caughtError.message}`, `Request to ${url} failed after ${attempt + 1} attempt(s)`, 'Check your network connection and endpoint configuration.');
    }
  }

  // All retries exhausted
  throw new CliError(
    ErrorCodes.API_ERROR,
    `HTTP request failed after ${maxRetries + 1} attempts`,
    `Request to ${url} failed with status ${lastStatus ?? 'unknown'}: ${lastError?.message ?? 'unknown error'}`,
    'Check your network connection and try again later.'
  );
}

/**
 * Creates an HTTP client with default headers (e.g., auth token).
 * @param defaultHeaders - Headers to include in all requests
 * @returns Configured request function
 */
export function createHttpClient(defaultHeaders: Record<string, string> = {}): {
  get: <T>(url: string, options?: HttpRequestOptions) => Promise<HttpResponse<T>>;
  post: <T>(url: string, body?: HttpRequestOptions['body'], options?: HttpRequestOptions) => Promise<HttpResponse<T>>;
  put: <T>(url: string, body?: HttpRequestOptions['body'], options?: HttpRequestOptions) => Promise<HttpResponse<T>>;
  delete: <T>(url: string, options?: HttpRequestOptions) => Promise<HttpResponse<T>>;
  request: <T>(url: string, options?: HttpRequestOptions) => Promise<HttpResponse<T>>;
} {
  const request = <T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> => {
    return httpRequest<T>(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });
  };

  return {
    get: <T>(url: string, options?: HttpRequestOptions) => request<T>(url, { ...options, method: 'GET' }),
    post: <T>(url: string, body?: HttpRequestOptions['body'], options?: HttpRequestOptions) => request<T>(url, { ...options, method: 'POST', ...(body !== undefined && { body }) }),
    put: <T>(url: string, body?: HttpRequestOptions['body'], options?: HttpRequestOptions) => request<T>(url, { ...options, method: 'PUT', ...(body !== undefined && { body }) }),
    delete: <T>(url: string, options?: HttpRequestOptions) => request<T>(url, { ...options, method: 'DELETE' }),
    request,
  };
}
