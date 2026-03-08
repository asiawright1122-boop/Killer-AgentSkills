import { defineMiddleware } from 'astro:middleware';
import {
  isStaticOrApiPath,
  hasLocalePrefix,
  checkAdminAuth,
  detectLocale,
  COUNTRY_TO_LOCALE,
} from './middleware-utils';

// Re-export for backward compatibility
export { COUNTRY_TO_LOCALE, isStaticOrApiPath, hasLocalePrefix, checkAdminAuth, detectLocale } from './middleware-utils';
export type { AdminAuthResult } from './middleware-utils';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // 1. Admin API routes require authentication (checked BEFORE skipping API routes)
  if (pathname.startsWith('/api/admin/')) {
    const authHeader = context.request.headers.get('authorization');
    const env = context.locals.runtime?.env;
    const validUser = env?.ADMIN_USER || 'admin';
    const validPass = env?.ADMIN_PASSWORD || 'admin';

    const authResult = checkAdminAuth(authHeader, validUser, validPass);
    if (authResult !== 'pass') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="Admin API"',
        },
      });
    }
    return next();
  }

  // 2. Skip static assets and non-admin API routes
  if (isStaticOrApiPath(pathname)) {
    return next();
  }

  // 3. Admin pages Basic Auth
  if (pathname.startsWith('/admin')) {
    const authHeader = context.request.headers.get('authorization');
    const env = context.locals.runtime?.env;
    const validUser = env?.ADMIN_USER || 'admin';
    const validPass = env?.ADMIN_PASSWORD || 'admin';

    const authResult = checkAdminAuth(authHeader, validUser, validPass);
    if (authResult === 'pass') {
      return next();
    }

    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  // 4. If path already has a valid locale prefix, pass through with Content-Language header
  if (hasLocalePrefix(pathname)) {
    const localeSegment = pathname.split('/')[1];
    const response = await next();
    response.headers.set('Content-Language', localeSegment);
    return response;
  }

  // 5. Language detection and redirect for paths without locale prefix
  const cookieLocale = context.cookies.get('locale')?.value;
  const cfCountry = context.request.headers.get('cf-ipcountry');
  const acceptLanguage = context.request.headers.get('accept-language');

  const targetLocale = detectLocale(cookieLocale, cfCountry, acceptLanguage);

  const redirectPath = pathname === '/' ? `/${targetLocale}` : `/${targetLocale}${pathname}`;

  // Use a custom Response to add Edge caching headers to the redirect
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectPath,
      'Cache-Control': 'public, s-maxage=3600',
      'Vary': 'Cookie, Accept-Language, CF-IPCountry'
    }
  });
});
