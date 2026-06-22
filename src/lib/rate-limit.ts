/**
 * Two-tier rate limiter for Cloudflare Workers / Pages.
 *
 * 1. **Cross-isolate path** (production):
 *    Uses Cloudflare's native rate-limiting binding (declared in
 *    `wrangler.toml`'s `[[ratelimits]]` blocks). The binding atomically
 *    counts per PoP with sub-ms latency, so an attacker can't bypass the
 *    cap by hitting different Worker isolates.
 *
 * 2. **In-memory fallback path** (local dev, tests, missing binding):
 *    Per-isolate `Map`-backed sliding window. Same API as before so call
 *    sites can be migrated incrementally.
 *
 * Migration:
 *   const ok = await checkRateLimit(env.RATE_LIMIT_SEARCH, clientIP);
 *   if (!ok) return rateLimitResponse();
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
 * Minimal Workers KV namespace interface — only the methods we use.
 * Avoids importing `@cloudflare/workers-types` here so this file stays
 * test-friendly under plain Node + Vitest.
 */
export interface KVNamespaceLike {
  get(key: string, options?: { type: 'text' }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface KVRateLimitOptions {
  /** Bucket name — namespacing different routes / quotas. */
  bucket: string;
  /** Identifier of the actor (usually `getClientIP(request)`). */
  key: string;
  /** Token count allowed per period. */
  max: number;
  /** Window duration in seconds. KV TTL must be ≥ 60 in production. */
  periodSec: number;
}

/**
 * Cross-isolate rate limit using Workers KV as a counter store.
 *
 * Limitations & design notes:
 *
 * 1. **No atomic increment.** Two concurrent requests can each read N and
 *    write N+1, missing one. For rate limiting this means slight
 *    over-allowance — strictly better than the previous per-isolate Map
 *    where bypass was unbounded across PoPs.
 * 2. **~30s propagation between PoPs.** An attacker pivoting between
 *    regions sees a slightly higher effective ceiling during the window,
 *    but is still bounded. Tune `max` accordingly (we default to 2x the
 *    intended cap to avoid false positives for legit cross-PoP CDN
 *    behaviour).
 * 3. **Fixed window**, not sliding. Simpler and cheaper than a sliding
 *    window and good enough for abuse prevention.
 * 4. **Fail open** on KV errors — a broken KV must not 429 every visitor.
 *    The optional in-memory fallback covers local dev where KV is absent.
 *
 * Returns `true` when allowed, `false` when over the limit.
 */
export interface CheckRateLimitResult {
  allowed: boolean;
  /** Which code path was taken — useful for tagging response headers in dev. */
  source: 'kv' | 'memory' | 'fail-open';
  /** Counter value after this request (only set when source==='kv'). */
  count?: number;
}

export async function checkRateLimit(
  kv: KVNamespaceLike | undefined,
  options: KVRateLimitOptions,
  inMemoryFallback?: RateLimiter,
): Promise<boolean> {
  return (await checkRateLimitDetailed(kv, options, inMemoryFallback)).allowed;
}

/**
 * Same as `checkRateLimit` but returns the source path + counter value.
 * Routes can stash these in observability headers (e.g. `X-RL-Source`) to
 * confirm cross-isolate consistency is actually being enforced in prod.
 */
export async function checkRateLimitDetailed(
  kv: KVNamespaceLike | undefined,
  options: KVRateLimitOptions,
  inMemoryFallback?: RateLimiter,
): Promise<CheckRateLimitResult> {
  const { bucket, key, max, periodSec } = options;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    try {
      const windowStart = Math.floor(Date.now() / 1000 / periodSec) * periodSec;
      const counterKey = `rl:${bucket}:${key}:${windowStart}`;
      const current = parseInt((await kv.get(counterKey, { type: 'text' })) || '0', 10) || 0;
      if (current >= max) return { allowed: false, source: 'kv', count: current };
      const ttl = Math.max(60, periodSec + 5);
      await kv.put(counterKey, String(current + 1), { expirationTtl: ttl });
      return { allowed: true, source: 'kv', count: current + 1 };
    } catch (err) {
      console.warn('[rate-limit] KV failed, falling back', err);
    }
  }
  if (inMemoryFallback) {
    return { allowed: !inMemoryFallback.isLimited(key), source: 'memory' };
  }
  return { allowed: true, source: 'fail-open' };
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
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
