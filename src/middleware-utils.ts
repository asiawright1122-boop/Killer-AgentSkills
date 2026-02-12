/**
 * Pure utility functions extracted from middleware for testability.
 * These functions contain the core logic without Astro framework dependencies.
 */
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from './i18n';

/**
 * Country code to Locale mapping (80+ countries)
 * Used for IP-based language detection via Cloudflare CF-IPCountry header
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Chinese (5 countries/regions)
  'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'MO': 'zh', 'SG': 'zh',
  // Japanese (1 country)
  'JP': 'ja',
  // Korean (2 countries)
  'KR': 'ko', 'KP': 'ko',
  // Spanish (19 countries)
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es',
  'CL': 'es', 'VE': 'es', 'EC': 'es', 'GT': 'es', 'CU': 'es',
  'BO': 'es', 'DO': 'es', 'HN': 'es', 'PY': 'es', 'SV': 'es',
  'NI': 'es', 'CR': 'es', 'PA': 'es', 'UY': 'es',
  // French (21 countries)
  'FR': 'fr', 'BE': 'fr', 'CA': 'fr', 'CH': 'fr', 'LU': 'fr',
  'MC': 'fr', 'SN': 'fr', 'CI': 'fr', 'ML': 'fr', 'BF': 'fr',
  'NE': 'fr', 'TD': 'fr', 'GN': 'fr', 'RW': 'fr', 'BJ': 'fr',
  'HT': 'fr', 'TG': 'fr', 'CF': 'fr', 'CG': 'fr', 'GA': 'fr', 'CD': 'fr',
  // German (3 countries)
  'DE': 'de', 'AT': 'de', 'LI': 'de',
  // Russian (7 countries)
  'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'KG': 'ru', 'TJ': 'ru', 'UZ': 'ru', 'TM': 'ru',
  // Portuguese (8 countries)
  'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt', 'GW': 'pt', 'CV': 'pt', 'ST': 'pt', 'TL': 'pt',
  // Arabic (22 countries)
  'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'MA': 'ar', 'DZ': 'ar',
  'IQ': 'ar', 'SD': 'ar', 'SY': 'ar', 'YE': 'ar', 'TN': 'ar',
  'JO': 'ar', 'LY': 'ar', 'LB': 'ar', 'OM': 'ar', 'KW': 'ar',
  'QA': 'ar', 'BH': 'ar', 'PS': 'ar', 'MR': 'ar', 'SO': 'ar', 'DJ': 'ar', 'KM': 'ar',
};

/**
 * Check if a path should be skipped by the middleware (static assets, API routes, etc.)
 */
export function isStaticOrApiPath(pathname: string): boolean {
  // IMPORTANT: /api/admin/* must NOT be skipped — it needs admin auth from middleware
  if (pathname.startsWith('/api/admin/') || pathname === '/api/admin') {
    return false;
  }
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_astro/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  );
}

/**
 * Check if a path already has a valid locale prefix
 */
export function hasLocalePrefix(pathname: string): boolean {
  return SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

/**
 * Result of admin auth check.
 * - 'pass': credentials are valid, allow access
 * - 'unauthorized': credentials are missing, invalid, or malformed
 */
export type AdminAuthResult = 'pass' | 'unauthorized';

/**
 * Check Basic Auth credentials for admin routes.
 * Returns 'pass' if credentials match, 'unauthorized' otherwise.
 *
 * @param authHeader - The Authorization header value (or null if missing)
 * @param validUser - The expected username (defaults to 'admin')
 * @param validPass - The expected password (defaults to 'admin')
 */
export function checkAdminAuth(
  authHeader: string | null,
  validUser: string = 'admin',
  validPass: string = 'admin',
): AdminAuthResult {
  if (!authHeader) {
    return 'unauthorized';
  }

  try {
    const authValue = authHeader.split(' ')[1];
    const decoded = atob(authValue);
    // RFC 7617: split only on the first colon — password may contain ':'
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return 'unauthorized';
    const user = decoded.substring(0, colonIndex);
    const pwd = decoded.substring(colonIndex + 1);

    if (user === validUser && pwd === validPass) {
      return 'pass';
    }
  } catch {
    // Auth header parsing failed
  }

  return 'unauthorized';
}

/**
 * Detect the preferred locale from the request using the priority:
 * Cookie > CF-IPCountry > Accept-Language > default (en)
 */
export function detectLocale(
  cookieValue: string | undefined,
  cfCountry: string | null,
  acceptLanguage: string | null,
): Locale {
  // 1. Cookie preference (highest priority)
  if (cookieValue && SUPPORTED_LOCALES.includes(cookieValue as Locale)) {
    return cookieValue as Locale;
  }

  // 2. Cloudflare CF-IPCountry header
  if (cfCountry) {
    const countryLocale = COUNTRY_TO_LOCALE[cfCountry.toUpperCase()];
    if (countryLocale) {
      return countryLocale;
    }
  }

  // 3. Accept-Language header
  if (acceptLanguage) {
    // Parse Accept-Language: e.g. "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
    const languages = acceptLanguage.split(',');
    for (const lang of languages) {
      const code = lang.split(';')[0].trim().split('-')[0].toLowerCase();
      if (SUPPORTED_LOCALES.includes(code as Locale)) {
        return code as Locale;
      }
    }
  }

  // 4. Default locale
  return DEFAULT_LOCALE;
}
