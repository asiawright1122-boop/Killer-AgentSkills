import { logger } from './logger';
import { getRuntimeEnv } from './runtime-env';

export function isCrawlerUserAgent(userAgent: string): boolean {
  return /(googlebot|bingbot|slurp|duckduckbot|yandexbot|baiduspider|petalbot|applebot|bytespider|killer-skills-warmup-bot)/.test(
    userAgent.toLowerCase(),
  );
}

export async function trackDirectoryView(
  locals: any,
  request: Request,
  locale: string,
  owner: string,
  repo: string,
): Promise<void> {
  const userAgent = request.headers.get('user-agent') || '';
  const country = request.headers.get('cf-ipcountry') || 'unknown';
  const isCrawler = isCrawlerUserAgent(userAgent);
  const trafficType = isCrawler ? 'crawler' : 'organic';

  // Log locally for structured log collection (Logpush/stdout)
  logger.info('Directory view event', {
    event: 'directory_view',
    locale,
    owner,
    repo,
    country,
    trafficType,
    userAgent,
  });

  const env = await getRuntimeEnv(locals);
  const gaId = env?.GA_MEASUREMENT_ID || (typeof process !== 'undefined' ? process.env?.GA_MEASUREMENT_ID : undefined);
  const gaSecret = env?.GA_API_SECRET || (typeof process !== 'undefined' ? process.env?.GA_API_SECRET : undefined);

  if (!gaId || !gaSecret) {
    return;
  }

  const trackPromise = (async () => {
    try {
      const clientId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);

      const payload = {
        client_id: clientId,
        events: [
          {
            name: 'directory_view',
            params: {
              locale,
              owner,
              repo,
              country,
              traffic_type: trafficType,
              user_agent: userAgent.slice(0, 100),
            },
          },
        ],
      };

      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${gaId}&api_secret=${gaSecret}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn('GA Measurement Protocol request failed', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (e: any) {
      logger.error('Failed to send event to GA', { error: e.message || String(e) });
    }
  })();

  if (locals?.runtime?.ctx?.waitUntil) {
    locals.runtime.ctx.waitUntil(trackPromise);
  } else {
    trackPromise.catch((e) => {
      logger.error('Background analytics error', { error: e.message || String(e) });
    });
  }
}
