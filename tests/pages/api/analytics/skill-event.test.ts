import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../../src/lib/api-test-utils';

vi.mock('../../../../src/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/rate-limit')>();
  return { ...actual, checkRateLimit: vi.fn() };
});

describe('POST /api/analytics/skill-event', () => {
  let POST: typeof import('../../../../src/pages/api/analytics/skill-event').POST;
  let checkRateLimit: typeof import('../../../../src/lib/rate-limit').checkRateLimit;
  let run: ReturnType<typeof vi.fn>;
  let prepare: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ POST } = await import('../../../../src/pages/api/analytics/skill-event'));
    ({ checkRateLimit } = await import('../../../../src/lib/rate-limit'));
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
    prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run })) }));
  });

  function context(body: unknown, headers: Record<string, string> = {}, withDb = true) {
    return createAPIContext({
      url: 'http://localhost/api/analytics/skill-event',
      body,
      headers: {
        'user-agent': 'killer-skills/1.10.1',
        'cf-connecting-ip': '203.0.113.5',
        ...headers,
      },
      env: createMockEnv({
        ANALYTICS_HASH_SALT: 'test-secret',
        ...(withDb ? { DB: { prepare } as unknown as D1Database } : {}),
      }),
    }) as any;
  }

  it('stores one valid CLI event and returns 204', async () => {
    const response = await POST(
      context({
        eventType: 'cli_install',
        skillRef: 'owner/repo/skill',
        platform: 'codex',
        surface: 'cli',
        clientVersion: '1.10.1',
      }),
    );

    expect(response.status).toBe(204);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO skill_interactions'));
    expect(run).toHaveBeenCalledOnce();
  });

  it('returns 400 for an invalid skill reference', async () => {
    const response = await POST(
      context({ eventType: 'cli_install', skillRef: '../secret', platform: 'codex', surface: 'cli' }),
    );

    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-JSON content type', async () => {
    const response = await POST(
      context(
        { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' },
        { 'Content-Type': 'text/plain' },
      ),
    );

    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 204 without D1 writes for Googlebot', async () => {
    const response = await POST(
      context(
        { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' },
        { 'user-agent': 'Googlebot/2.1' },
      ),
    );

    expect(response.status).toBe(204);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 204 when D1 is unavailable', async () => {
    const response = await POST(
      context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }, {}, false),
    );

    expect(response.status).toBe(204);
  });

  it('returns 429 when the rate limit rejects the request', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const response = await POST(
      context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('always returns noindex API headers', async () => {
    const response = await POST(
      context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }),
    );

    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});
