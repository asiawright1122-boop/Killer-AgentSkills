import { defineMiddleware } from 'astro:middleware';
import { isStaticOrApiPath, hasLocalePrefix, checkAdminAuth, detectLocale } from './middleware-utils';
import { logger, generateRequestId } from './lib/logger';

// Re-export for backward compatibility
export {
  COUNTRY_TO_LOCALE,
  isStaticOrApiPath,
  hasLocalePrefix,
  checkAdminAuth,
  detectLocale,
} from './middleware-utils';
export type { AdminAuthResult } from './middleware-utils';

/**
 * Add security and performance headers to page responses.
 */
function setSecurityHeaders(response: Response): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // 1. Admin routes (API + pages) require Basic Auth
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isAdminPage = !isAdminApi && pathname.startsWith('/admin');
  if (isAdminApi || isAdminPage) {
    const authHeader = context.request.headers.get('authorization');
    const env = context.locals.runtime?.env;
    const validUser = env?.ADMIN_USER || 'admin';
    const validPass = env?.ADMIN_PASSWORD || 'admin';

    const authResult = checkAdminAuth(authHeader, validUser, validPass);
    if (authResult === 'pass') {
      return next();
    }

    // API routes return JSON error; pages return plain text
    return isAdminApi
      ? new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="Admin API"' },
        })
      : new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
        });
  }

  // 2. Block known invalid root-level paths (crawled by Googlebot but never valid)
  const INVALID_ROOT_PATHS = ['/.cursor/', '/04-Initiatives/', '/ORCHESTRATION.md', '/agent-os/'];
  if (INVALID_ROOT_PATHS.some((p) => pathname.startsWith(p) || pathname === p.replace(/\/$/, ''))) {
    return new Response(null, {
      status: 410, // Gone — tells Google to drop from index permanently
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
    });
  }

  // 3. Intercept skill paths ending with source-code file extensions (.md, .ts, .py, etc.)
  //    These are GitHub repo file paths that get matched by the catch-all [...]repo route
  //    but never correspond to actual pages — return cached 404 to save crawl budget.
  const FILE_EXT_REGEX = /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt)$/i;
  if (pathname.match(/^\/[a-z]{2}\/skills\//) && FILE_EXT_REGEX.test(pathname)) {
    return new Response(null, {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  // 4. Skip static assets; apply security headers + observability to API routes
  if (isStaticOrApiPath(pathname)) {
    if (pathname.startsWith('/api/')) {
      const requestId = generateRequestId();
      const start = Date.now();

      const response = await next();

      const durationMs = Date.now() - start;
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Response-Time', `${durationMs}ms`);
      setSecurityHeaders(response);

      logger.info('API request', {
        requestId,
        method: context.request.method,
        path: pathname,
        status: response.status,
        durationMs,
      });

      return response;
    }
    return next();
  }

  // 4. If path already has a valid locale prefix, pass through with Content-Language header
  if (hasLocalePrefix(pathname)) {
    const localeSegment = pathname.split('/')[1];
    const response = await next();
    response.headers.set('Content-Language', localeSegment);
    // X-Robots-Tag as HTTP header reinforcement for Googlebot
    if (!response.headers.has('X-Robots-Tag')) {
      response.headers.set('X-Robots-Tag', 'index, follow');
    }
    setSecurityHeaders(response);
    return response;
  }

  // 5. Language detection and redirect for paths without locale prefix
  const cookieLocale = context.cookies.get('locale')?.value;
  const cfCountry = context.request.headers.get('cf-ipcountry');
  const acceptLanguage = context.request.headers.get('accept-language');

  const targetLocale = detectLocale(cookieLocale, cfCountry, acceptLanguage);

  const redirectPath = pathname === '/' ? `/${targetLocale}` : `/${targetLocale}${pathname}`;

  // Use 301 permanent redirect so Google consolidates PageRank to the locale URL
  return new Response(null, {
    status: 301,
    headers: {
      Location: redirectPath,
      'Cache-Control': 'public, s-maxage=86400',
      Vary: 'Cookie, Accept-Language, CF-IPCountry',
    },
  });
});
