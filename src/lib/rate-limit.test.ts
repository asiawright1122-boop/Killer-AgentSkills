import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit, createRateLimiter, getClientIP, rateLimitResponse, type KVNamespaceLike } from './rate-limit';

/** Build a tiny in-memory KV mock that mirrors the slice we use in prod. */
function makeKV(): KVNamespaceLike & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const baseOpts = (key: string, max = 1, periodSec = 60) => ({
  bucket: 'test',
  key,
  max,
  periodSec,
});

describe('createRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.isLimited('1.2.3.4')).toBe(false); // 1st
    expect(limiter.isLimited('1.2.3.4')).toBe(false); // 2nd
    expect(limiter.isLimited('1.2.3.4')).toBe(false); // 3rd
  });

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect(limiter.isLimited('1.2.3.4')).toBe(false); // 1st
    expect(limiter.isLimited('1.2.3.4')).toBe(false); // 2nd
    expect(limiter.isLimited('1.2.3.4')).toBe(true); // 3rd — blocked
  });

  it('tracks IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.isLimited('1.1.1.1')).toBe(false);
    expect(limiter.isLimited('2.2.2.2')).toBe(false);
    expect(limiter.isLimited('1.1.1.1')).toBe(true); // blocked
    expect(limiter.isLimited('2.2.2.2')).toBe(true); // blocked
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });

    expect(limiter.isLimited('1.2.3.4')).toBe(false);
    expect(limiter.isLimited('1.2.3.4')).toBe(true);

    // Advance past the window
    vi.advanceTimersByTime(1_100);

    expect(limiter.isLimited('1.2.3.4')).toBe(false); // reset
    vi.useRealTimers();
  });

  it('remaining() returns correct count', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.remaining('1.2.3.4')).toBe(3);
    limiter.isLimited('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(2);
    limiter.isLimited('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(1);
    limiter.isLimited('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(0);
  });
});

describe('getClientIP', () => {
  it('extracts cf-connecting-ip first', () => {
    const req = new Request('https://example.com', {
      headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
    });
    expect(getClientIP(req)).toBe('1.1.1.1');
  });

  it('falls back to x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
    });
    expect(getClientIP(req)).toBe('3.3.3.3');
  });

  it('returns unknown when no IP headers', () => {
    const req = new Request('https://example.com');
    expect(getClientIP(req)).toBe('unknown');
  });
});

describe('checkRateLimit (KV-backed)', () => {
  it('allows requests under the configured cap', async () => {
    const kv = makeKV();
    const opts = baseOpts('1.2.3.4', 3);
    expect(await checkRateLimit(kv, opts)).toBe(true);
    expect(await checkRateLimit(kv, opts)).toBe(true);
    expect(await checkRateLimit(kv, opts)).toBe(true);
  });

  it('rejects when the cap is exceeded', async () => {
    const kv = makeKV();
    const opts = baseOpts('9.9.9.9', 2);
    expect(await checkRateLimit(kv, opts)).toBe(true); // 1
    expect(await checkRateLimit(kv, opts)).toBe(true); // 2
    expect(await checkRateLimit(kv, opts)).toBe(false); // over
  });

  it("isolates buckets so different routes don't share counters", async () => {
    const kv = makeKV();
    const a = { ...baseOpts('shared', 1), bucket: 'route-a' };
    const b = { ...baseOpts('shared', 1), bucket: 'route-b' };
    expect(await checkRateLimit(kv, a)).toBe(true);
    expect(await checkRateLimit(kv, b)).toBe(true); // separate bucket
    expect(await checkRateLimit(kv, a)).toBe(false);
    expect(await checkRateLimit(kv, b)).toBe(false);
  });

  it("isolates keys so different IPs don't share counters", async () => {
    const kv = makeKV();
    expect(await checkRateLimit(kv, baseOpts('1.1.1.1'))).toBe(true);
    expect(await checkRateLimit(kv, baseOpts('2.2.2.2'))).toBe(true);
    expect(await checkRateLimit(kv, baseOpts('1.1.1.1'))).toBe(false);
    expect(await checkRateLimit(kv, baseOpts('2.2.2.2'))).toBe(false);
  });

  it('falls back to the in-memory limiter when KV is missing', async () => {
    const fallback = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(await checkRateLimit(undefined, baseOpts('k'), fallback)).toBe(true);
    expect(await checkRateLimit(undefined, baseOpts('k'), fallback)).toBe(false);
  });

  it('falls back to the in-memory limiter when KV throws', async () => {
    const kv: KVNamespaceLike = {
      get: vi.fn().mockRejectedValue(new Error('kv-down')),
      put: vi.fn(),
    };
    const fallback = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(await checkRateLimit(kv, baseOpts('k'), fallback)).toBe(true);
    expect(await checkRateLimit(kv, baseOpts('k'), fallback)).toBe(false);
  });

  it('fails open when neither KV nor fallback are configured', async () => {
    // Deliberate design choice — a misconfigured deployment must NOT 429
    // every visitor. Pin the behaviour so we notice any drift to fail-
    // closed (which would silently break production).
    expect(await checkRateLimit(undefined, baseOpts('k'))).toBe(true);
  });

  it('writes a TTL of at least 60 seconds (KV API floor)', async () => {
    const put = vi.fn();
    const kv: KVNamespaceLike = {
      get: vi.fn().mockResolvedValue(null),
      put,
    };
    await checkRateLimit(kv, { bucket: 't', key: 'k', max: 5, periodSec: 10 });
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^rl:t:k:/),
      '1',
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
    const ttl = (put.mock.calls[0][2] as { expirationTtl: number }).expirationTtl;
    expect(ttl).toBeGreaterThanOrEqual(60);
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 with correct headers', async () => {
    const resp = rateLimitResponse(30);
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).toBe('30');
    expect(resp.headers.get('Content-Type')).toBe('application/json');

    const body = (await resp.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Rate limit');
  });
});
