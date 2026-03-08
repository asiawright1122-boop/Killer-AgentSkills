/**
 * Structured API error handling utilities.
 * Provides consistent JSON error responses across all API routes.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(error: unknown, fallbackStatus = 500): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        success: false,
        error: error.message,
        ...(error.code && { code: error.code }),
      },
      error.statusCode,
    );
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('[API Error]', error);

  return jsonResponse(
    {
      success: false,
      error: message,
    },
    fallbackStatus,
  );
}

/**
 * Returns a 400 validation error response with consistent format.
 */
export function validationError(message: string, code?: string): Response {
  return jsonResponse({ success: false, error: message, ...(code && { code }) }, 400);
}

/**
 * Returns a 404 not-found error response with consistent format.
 */
export function notFoundError(message: string): Response {
  return jsonResponse({ success: false, error: message }, 404);
}

/**
 * Fetch with timeout — prevents hanging requests to external APIs.
 * Throws an AbortError if the request exceeds the timeout.
 *
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 10_000 = 10s)
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Wraps an async API handler with structured error handling.
 * Catches unhandled errors and returns consistent JSON error responses.
 */
export function withErrorHandling(handler: (request: Request, context: unknown) => Promise<Response>) {
  return async (request: Request, context: unknown): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
