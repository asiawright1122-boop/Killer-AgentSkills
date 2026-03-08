import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter, getClientIP, rateLimitResponse } from './rate-limit';

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
