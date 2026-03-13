import { defineMiddleware } from 'astro:middleware';
import {
  isStaticOrApiPath,
  hasLocalePrefix,
  checkAdminAuth,
  detectLocale,
  shouldPreserveHostForSeoInfra,
} from './middleware-utils';
import { logger, generateRequestId } from './lib/logger';

// Re-export for backward compatibility
export {
  COUNTRY_TO_LOCALE,
  isStaticOrApiPath,
  hasLocalePrefix,
  checkAdminAuth,
  detectLocale,
  shouldPreserveHostForSeoInfra,
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

  // 0. Enforce canonical domain: redirect www.killer-skills.com to killer-skills.com
  if (context.url.hostname === 'www.killer-skills.com' && !shouldPreserveHostForSeoInfra(pathname)) {
    const url = new URL(context.url);
    url.hostname = 'killer-skills.com';
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 0.5. Enforce trailingSlash: 'never'
  // If the pathname ends with a slash (and isn't the root URL), 301 redirect to the path without the slash
  if (pathname !== '/' && pathname.endsWith('/')) {
    const newPath = pathname.replace(/\/+$/, '');
    return new Response(null, {
      status: 301,
      headers: {
        Location: newPath + context.url.search,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

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

  // 3b. Block deeply nested skill paths (crawl traps like /skills/owner/repo/a/b/c/d)
  //     Only owner/repo is valid; anything beyond 2 segments after /skills/ is a trap.
  const deepNestMatch = pathname.match(/^\/[a-z]{2}\/skills\/([^/]+)\/([^/]+)\/(.+)/);
  if (deepNestMatch) {
    const subPath = deepNestMatch[3];
    // If there are 2+ extra path segments beyond owner/repo, it's a crawl trap
    if (subPath.split('/').length >= 2) {
      return new Response(null, {
        status: 404,
        statusText: 'Not Found',
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
  }

  // 3c. Redirect legacy ?tag= parameter to ?topic= (consolidate duplicate params)
  const searchParams = context.url.searchParams;
  if (searchParams.has('tag')) {
    const tagValue = searchParams.get('tag')!;
    const newUrl = new URL(context.url);
    newUrl.searchParams.delete('tag');
    newUrl.searchParams.set('topic', tagValue);
    return new Response(null, {
      status: 301,
      headers: {
        Location: newUrl.pathname + newUrl.search,
        'Cache-Control': 'public, s-maxage=86400',
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

      // +++ ADD API CACHE +++
      // Cache global read-only API endpoints at the Cloudflare Edge to prevent Worker billing overload.
      if (context.request.method === 'GET' && !pathname.startsWith('/api/admin/') && pathname !== '/api/health') {
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
      }

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
    const isSkillsListingWithParams = /^\/[a-z]{2}\/skills$/.test(pathname) && searchParams.size > 0;
    // X-Robots-Tag as HTTP header reinforcement for Googlebot
    if (!response.headers.has('X-Robots-Tag')) {
      // noindex for search result pages (?q= / ?query=) — thin/dynamic content
      if (isSkillsListingWithParams || searchParams.has('q') || searchParams.has('query')) {
        response.headers.set('X-Robots-Tag', 'noindex, follow');
      } else {
        response.headers.set('X-Robots-Tag', 'index, follow');
      }
    }
    setSecurityHeaders(response);

    // +++ ADD HTML CACHE +++
    // Islands Architecture guarantees anonymous users get exactly the same SSR HTML payload.
    // Client-side local storage handles all user state (e.g. favorites / history). Edge cache it heavily.
    if (context.request.method === 'GET') {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
      }
    }

    return response;
  }

  // 5. Language detection and redirect for paths without locale prefix
  const cookieLocale = context.cookies.get('locale')?.value;
  const cfCountry = context.request.headers.get('cf-ipcountry');
  const acceptLanguage = context.request.headers.get('accept-language');

  const targetLocale = detectLocale(cookieLocale, cfCountry, acceptLanguage);

  const redirectPath = pathname === '/' ? `/${targetLocale}` : `/${targetLocale}${pathname}`;

  // Locale detection redirects depend on request headers/cookies.
  // Use 302 to avoid cacheable permanent redirect conflicts in crawlers.
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectPath,
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Accept-Language, CF-IPCountry',
    },
  });
});
