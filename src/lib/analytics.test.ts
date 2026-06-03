import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isCrawlerUserAgent, trackDirectoryView } from './analytics';
import { logger } from './logger';
import * as runtimeEnv from './runtime-env';

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('isCrawlerUserAgent', () => {
  it('correctly identifies web crawlers', () => {
    const crawlers = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Baiduspider+(+http://www.baidu.com/search/spider.htm)',
      'YandexBot/3.0; +http://yandex.com/bots',
      'Killer-Skills-Warmup-Bot/1.0',
    ];
    for (const ua of crawlers) {
      expect(isCrawlerUserAgent(ua)).toBe(true);
    }
  });

  it('does not flag normal human user agents as crawlers', () => {
    const humans = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1',
    ];
    for (const ua of humans) {
      expect(isCrawlerUserAgent(ua)).toBe(false);
    }
  });
});

describe('trackDirectoryView', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('OK', { status: 200 })));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('logs local structured event but skips GA fetch when GA credentials are missing', async () => {
    vi.spyOn(runtimeEnv, 'getRuntimeEnv').mockResolvedValue({});

    const request = new Request('https://killer-skills.com/zh/skills/owner/repo', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'cf-ipcountry': 'CN',
      },
    });

    await trackDirectoryView({}, request, 'zh', 'owner', 'repo');

    expect(logger.info).toHaveBeenCalledWith(
      'Directory view event',
      expect.objectContaining({
        event: 'directory_view',
        locale: 'zh',
        owner: 'owner',
        repo: 'repo',
        country: 'CN',
        trafficType: 'crawler',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('triggers GA Measurement Protocol POST payload when GA credentials are provided', async () => {
    vi.spyOn(runtimeEnv, 'getRuntimeEnv').mockResolvedValue({
      GA_MEASUREMENT_ID: 'G-TEST1234',
      GA_API_SECRET: 'SECRET5678',
    });

    const request = new Request('https://killer-skills.com/en/skills/owner/repo', {
      headers: {
        'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        'cf-ipcountry': 'US',
      },
    });

    await trackDirectoryView({}, request, 'en', 'owner', 'repo');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options]: [any, any] = fetchSpy.mock.calls[0];
    expect(url).toContain('measurement_id=G-TEST1234');
    expect(url).toContain('api_secret=SECRET5678');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.client_id).toBeDefined();
    expect(body.events[0].name).toBe('directory_view');
    expect(body.events[0].params).toEqual({
      locale: 'en',
      owner: 'owner',
      repo: 'repo',
      country: 'US',
      traffic_type: 'organic',
      user_agent: 'Mozilla/5.0 Chrome/120.0.0.0',
    });
  });

  it('uses Cloudflare waitUntil if available in ctx', async () => {
    vi.spyOn(runtimeEnv, 'getRuntimeEnv').mockResolvedValue({
      GA_MEASUREMENT_ID: 'G-TEST1234',
      GA_API_SECRET: 'SECRET5678',
    });

    const request = new Request('https://killer-skills.com/en/skills/owner/repo', {
      headers: {
        'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        'cf-ipcountry': 'US',
      },
    });

    const waitUntilMock = vi.fn();
    const locals = {
      runtime: {
        ctx: {
          waitUntil: waitUntilMock,
        },
      },
    };

    await trackDirectoryView(locals, request, 'en', 'owner', 'repo');

    // Should immediately defer execution to waitUntil instead of resolving
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
  });
});
