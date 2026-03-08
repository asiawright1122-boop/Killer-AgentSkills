/**
 * Reusable in-memory rate limiter (per Worker isolate).
 * Sliding window counter — lightweight, zero-dependency, zero-cost.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
 *   if (limiter.isLimited(clientIP)) return rateLimitResponse();
 */

export interface RateLimiterOptions {
  /** Window duration in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Max requests per IP per window (default: 30) */
  max?: number;
  /** Cleanup interval in milliseconds (default: 300_000 = 5 minutes) */
  cleanupIntervalMs?: number;
}

export interface RateLimiter {
  /** Check if an IP is rate limited. Increments the counter. */
  isLimited: (ip: string) => boolean;
  /** Get remaining requests for an IP */
  remaining: (ip: string) => number;
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 30;
  const cleanupIntervalMs = options.cleanupIntervalMs ?? 300_000;

  const map = new Map<string, { count: number; resetAt: number }>();
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < cleanupIntervalMs) return;
    lastCleanup = now;
    for (const [ip, entry] of map) {
      if (now > entry.resetAt) map.delete(ip);
    }
  }

  function isLimited(ip: string): boolean {
    cleanup();
    const now = Date.now();
    const entry = map.get(ip);

    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      return false;
    }

    entry.count++;
    return entry.count > max;
  }

  function remaining(ip: string): number {
    const entry = map.get(ip);
    if (!entry || Date.now() > entry.resetAt) return max;
    return Math.max(0, max - entry.count);
  }

  return { isLimited, remaining };
}

/**
 * Extract client IP from request headers (Cloudflare-aware).
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Create a standardized 429 rate limit response.
 */
export function rateLimitResponse(retryAfterSeconds = 60): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please wait before trying again.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}
