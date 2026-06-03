import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as runtimeEnv from './lib/runtime-env';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

vi.mock('./lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  generateRequestId: () => 'test-req-id',
}));

import { onRequest } from './middleware';

describe('Middleware Throttling and Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows normal traffic and does not trigger fallback initially', async () => {
    const context: any = {
      url: new URL('https://killer-skills.com/en/skills'),
      clientAddress: '192.168.1.1',
      request: new Request('https://killer-skills.com/en/skills', {
        headers: { 'user-agent': 'Mozilla/5.0' },
      }),
      locals: {
        runtime: {
          ctx: {
            waitUntil: vi.fn(),
          },
        },
      },
    };

    const nextMock = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await onRequest(context, nextMock);
    expect(response).toBeDefined();
    expect(context.locals.useStaticFallback).toBeUndefined();
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it('triggers fallbackStatic / useStaticFallback when IP rate limit is exceeded', async () => {
    const nextMock = vi.fn().mockResolvedValue(new Response('OK'));

    // Mock the runtime DB
    const runMock = vi.fn().mockResolvedValue({ success: true });
    const bindMock = vi.fn().mockReturnValue({ run: runMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const dbMock = { prepare: prepareMock };

    vi.spyOn(runtimeEnv, 'getRuntimeEnv').mockResolvedValue({
      DB: dbMock,
    });

    const context: any = {
      url: new URL('https://killer-skills.com/en/skills'),
      clientAddress: '10.0.0.1',
      request: new Request('https://killer-skills.com/en/skills', {
        headers: { 'user-agent': 'Mozilla/5.0' },
      }),
      locals: {
        runtime: {
          ctx: {
            waitUntil: vi.fn(),
          },
        },
      },
    };

    // Call 500 times (the threshold is 500)
    for (let i = 0; i < 500; i++) {
      await onRequest(context, nextMock);
      expect(context.locals.useStaticFallback).toBeUndefined();
    }

    // 501st call should trigger rate limit and activate static fallback
    await onRequest(context, nextMock);
    expect(context.locals.useStaticFallback).toBe(true);

    // Verify D1 alert was queued
    expect(prepareMock).toHaveBeenCalled();
    expect(bindMock).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
    expect(context.locals.runtime.ctx.waitUntil).toHaveBeenCalled();
  });
});
