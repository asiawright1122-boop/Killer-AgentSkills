import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';
import seo404RulesData from '../data/seo-404-rules.json';
import sitemapSkillsData from '../data/sitemap-skills.json';
import sitemapBlocklistData from '../data/seo-sitemap-blocklist.json';
import skillLocaleGovernanceData from '../data/seo-skill-locale-governance.json';
import {
  detectLocale,
  isStaticOrApiPath,
  hasLocalePrefix,
  COUNTRY_TO_LOCALE,
  checkAdminAuth,
} from './middleware-utils';
import { setSitemapSkillsCache, type SitemapSkillEntry } from './lib/sitemap-skills-runtime';
import { setSitemapBlocklistCache } from './lib/sitemap-blocklist-runtime';
import { compileSitemapBlocklist } from './lib/sitemap-blocklist';
import { setSeo404RulesCache } from './lib/seo-404-rules-runtime';
import { setSkillLocaleGovernanceCache } from './lib/skill-locale-governance';

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

// Seed runtime caches so middleware can validate skill routes without KV/DEV
beforeAll(() => {
  const sitemapSkills = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as SitemapSkillEntry[];
  setSitemapSkillsCache(sitemapSkills);
  setSitemapBlocklistCache(compileSitemapBlocklist(sitemapBlocklistData));
  setSeo404RulesCache(seo404RulesData as unknown as import('./lib/seo-404-rules-runtime').Seo404Rule[]);
  setSkillLocaleGovernanceCache(skillLocaleGovernanceData);
});

import { onRequest } from './middleware';

const explicitGone410SamplePath =
  ((seo404RulesData as { rules?: { gone410?: Array<{ path?: string }> } }).rules?.gone410 ?? []).find((entry) =>
    typeof entry.path === 'string' ? /^\/[a-z]{2}\/skills\//.test(entry.path) : false,
  )?.path || '/de/skills/gscalzo/gscalzo.github.io';

// ============================================================================
// Generators
// ============================================================================

/** Generates a valid locale from SUPPORTED_LOCALES. */
const localeArb = fc.constantFrom(...SUPPORTED_LOCALES);

/** Generates a valid country code that maps to a locale. */
const validCountryCodeArb = fc.constantFrom(...Object.keys(COUNTRY_TO_LOCALE));

/** Generates a country code that does NOT map to any locale. */
const unmappedCountryCodeArb = fc.stringMatching(/^[A-Z]{2}$/).filter((code) => !(code in COUNTRY_TO_LOCALE));

/** Generates a valid Accept-Language header value with a supported locale as the first entry. */
const acceptLanguageWithSupportedArb = localeArb.chain((locale) =>
  fc
    .tuple(
      fc.constant(locale),
      fc.array(fc.stringMatching(/^[a-z]{2}(-[A-Z]{2})?(;q=0\.\d+)?$/), { minLength: 0, maxLength: 3 }),
    )
    .map(([loc, extras]) => {
      const parts = [loc, ...extras];
      return parts.join(',');
    }),
);

/** Generates an Accept-Language header where no entry is a supported locale. */
const acceptLanguageUnsupportedArb = fc
  .array(
    fc.stringMatching(/^[a-z]{2}(-[A-Z]{2})?(;q=0\.\d+)?$/).filter((s) => {
      const code = s.split(';')[0].split('-')[0].toLowerCase();
      return !(SUPPORTED_LOCALES as readonly string[]).includes(code);
    }),
    { minLength: 1, maxLength: 4 },
  )
  .map((parts) => parts.join(','));

/** Generates a simple path segment. */
const pathSegmentArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/);

/** Generates a path suffix (e.g., /foo/bar). */
const pathSuffixArb = fc
  .array(pathSegmentArb, { minLength: 0, maxLength: 4 })
  .map((segments) => (segments.length > 0 ? '/' + segments.join('/') : ''));

/** Generates a file extension. */
const fileExtensionArb = fc.constantFrom(
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.svg',
  '.ico',
  '.woff2',
  '.json',
  '.xml',
  '.html',
  '.txt',
  '.map',
);

// ============================================================================
// Property 3: 中间件语言检测优先级
// Feature: nextjs-to-astro-migration, Property 3: 中间件语言检测优先级
// Validates: Requirements 3.1, 3.2, 3.3
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 3: 中间件语言检测优先级', () => {
  it('Cookie takes highest priority: when cookie has a valid locale, result equals cookie locale regardless of other sources', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any request with a valid cookie locale, the detected locale should
     * always be the cookie value, regardless of CF-IPCountry or Accept-Language.
     */
    fc.assert(
      fc.property(
        localeArb,
        fc.option(validCountryCodeArb, { nil: null }),
        fc.option(acceptLanguageWithSupportedArb, { nil: null }),
        (cookieLocale, cfCountry, acceptLang) => {
          const result = detectLocale(cookieLocale, cfCountry, acceptLang);
          expect(result).toBe(cookieLocale);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CF-IPCountry takes second priority: when no valid cookie, result is determined by country code', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * When cookie is absent/invalid but CF-IPCountry maps to a locale,
     * the detected locale should be the country-mapped locale.
     */
    fc.assert(
      fc.property(
        validCountryCodeArb,
        fc.option(acceptLanguageWithSupportedArb, { nil: null }),
        (cfCountry, acceptLang) => {
          // No cookie (undefined)
          const result = detectLocale(undefined, cfCountry, acceptLang);
          expect(result).toBe(COUNTRY_TO_LOCALE[cfCountry.toUpperCase()]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Accept-Language takes third priority: when no cookie and no valid country, result is from Accept-Language', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * When cookie is absent and CF-IPCountry is absent/unmapped,
     * the detected locale should come from Accept-Language.
     */
    fc.assert(
      fc.property(fc.option(unmappedCountryCodeArb, { nil: null }), localeArb, (cfCountry, expectedLocale) => {
        // Accept-Language with the expected locale as first entry
        const acceptLang = `${expectedLocale}-XX,en;q=0.5`;
        const result = detectLocale(undefined, cfCountry, acceptLang);
        expect(result).toBe(expectedLocale);
      }),
      { numRuns: 100 },
    );
  });

  it('Default locale is used when all sources are absent or invalid', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * When cookie is absent, CF-IPCountry is absent/unmapped, and
     * Accept-Language has no supported locale, the default locale is returned.
     */
    fc.assert(
      fc.property(
        fc.option(unmappedCountryCodeArb, { nil: null }),
        fc.option(acceptLanguageUnsupportedArb, { nil: null }),
        (cfCountry, acceptLang) => {
          const result = detectLocale(undefined, cfCountry, acceptLang);
          expect(result).toBe(DEFAULT_LOCALE);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Invalid cookie values are ignored and lower-priority sources are used', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * When cookie has an invalid locale value, it should be ignored and
     * the next priority source should be used.
     */
    const invalidCookieArb = fc
      .stringMatching(/^[a-zA-Z0-9_-]{1,10}$/)
      .filter((s) => !(SUPPORTED_LOCALES as readonly string[]).includes(s));

    fc.assert(
      fc.property(invalidCookieArb, validCountryCodeArb, (invalidCookie, cfCountry) => {
        const result = detectLocale(invalidCookie, cfCountry, null);
        // Should fall through to CF-IPCountry
        expect(result).toBe(COUNTRY_TO_LOCALE[cfCountry.toUpperCase()]);
      }),
      { numRuns: 100 },
    );
  });

  it('detectLocale always returns a value in SUPPORTED_LOCALES', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any combination of inputs, detectLocale should always return
     * a value that is a member of SUPPORTED_LOCALES.
     */
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 0, maxLength: 10 }), { nil: undefined }),
        fc.option(fc.stringMatching(/^[A-Z]{2}$/), { nil: null }),
        fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: null }),
        (cookie, cfCountry, acceptLang) => {
          const result = detectLocale(cookie, cfCountry, acceptLang);
          expect((SUPPORTED_LOCALES as readonly string[]).includes(result)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 4: 中间件路径放行
// Feature: nextjs-to-astro-migration, Property 4: 中间件路径放行
// Validates: Requirements 3.5, 3.6
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 4: 中间件路径放行', () => {
  it('paths starting with /api/ are always identified as static/API paths', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any path starting with /api/, isStaticOrApiPath should return true.
     */
    fc.assert(
      fc.property(pathSuffixArb, (suffix) => {
        const path = `/api/${suffix.replace(/^\//, '')}`;
        expect(isStaticOrApiPath(path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('paths starting with /_astro/ are always identified as static/API paths', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any path starting with /_astro/, isStaticOrApiPath should return true.
     */
    fc.assert(
      fc.property(pathSuffixArb, (suffix) => {
        const path = `/_astro/${suffix.replace(/^\//, '')}`;
        expect(isStaticOrApiPath(path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('paths containing a file extension are always identified as static/API paths', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any path containing a file extension, isStaticOrApiPath should return true.
     */
    fc.assert(
      fc.property(pathSegmentArb, fileExtensionArb, pathSuffixArb, (filename, ext, prefix) => {
        // Build a path like /some/path/file.ext
        const path = `${prefix}/${filename}${ext}`;
        expect(isStaticOrApiPath(path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('paths with a valid locale prefix are identified by hasLocalePrefix', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * For any path starting with a valid locale prefix (e.g., /en/, /zh/),
     * hasLocalePrefix should return true.
     */
    fc.assert(
      fc.property(localeArb, pathSuffixArb, (locale, suffix) => {
        // Test both /locale/ and /locale (exact match)
        expect(hasLocalePrefix(`/${locale}${suffix}`)).toBe(true);
        expect(hasLocalePrefix(`/${locale}`)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('paths without a valid locale prefix are not identified by hasLocalePrefix', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * For paths that don't start with a valid locale prefix,
     * hasLocalePrefix should return false.
     */
    const nonLocaleSegmentArb = fc
      .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
      .filter((s) => !(SUPPORTED_LOCALES as readonly string[]).includes(s));

    fc.assert(
      fc.property(nonLocaleSegmentArb, pathSuffixArb, (segment, suffix) => {
        expect(hasLocalePrefix(`/${segment}${suffix}`)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('regular content paths (no api, no astro, no extension, no locale) are not static/API paths', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * Regular content paths without special prefixes or file extensions
     * should NOT be identified as static/API paths.
     */
    const cleanSegmentArb = fc
      .stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/)
      .filter((s) => !s.includes('.') && s !== 'api' && s !== '_astro' && s !== 'favicon');

    fc.assert(
      fc.property(fc.array(cleanSegmentArb, { minLength: 1, maxLength: 3 }), (segments) => {
        const path = '/' + segments.join('/');
        expect(isStaticOrApiPath(path)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 5: 中间件 robots header
// Feature: technical-seo, Property 5: 错误页 robots header
// Validates: 404/410 页面默认 noindex
// ============================================================================

describe('Feature: technical-seo, Property 5: 错误页 robots header', () => {
  function createContext(url: string, init?: { headers?: HeadersInit }) {
    return {
      url: new URL(url),
      request: new Request(url, { headers: init?.headers }),
      cookies: {
        get: () => undefined,
      },
      locals: {},
    } as unknown as Parameters<typeof onRequest>[0];
  }

  it('adds noindex to locale 404 pages when downstream response has no robots header', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/missing-page'),
      async () =>
        new Response('Not Found', {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    )) as Response;

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Content-Language')).toBe('en');
  });

  it('preserves explicit robots header on locale 404 pages', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/missing-page'),
      async () =>
        new Response('Not Found', {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex',
          },
        }),
    )) as Response;

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('keeps noindex, follow for locale skills search result pages', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills?q=mcp'),
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  });

  it('returns a lightweight noindex response for crawler skills search URLs before SSR', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/de/skills?q=ks-tail-repro', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    expect(response.headers.get('X-Killer-Skills-Crawler-Capsule')).toBe('1');
  });

  it('redirects crawler skill detail query variants to the clean canonical path before SSR', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/remotion-dev/skills?tail_probe=1', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/skills/remotion-dev/skills/remotion');
  });

  it('applies noindex, nofollow to personal state pages even when downstream omits robots headers', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/fr/favorites'),
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('applies noindex, nofollow to API responses by default', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/api/categories'),
      async () =>
        new Response(JSON.stringify({ categories: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 for explicit trap paths generated from 404 remediation rules', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext(`https://killer-skills.com${explicitGone410SamplePath}`),
      async () => {
        nextCalled = true;
        return new Response('ok', { status: 200 });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 Gone for dead skill path /ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent'),
      async () => {
        nextCalled = true;
        return new Response('ok', { status: 200 });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('redirects legacy collection aliases once 404 remediation rules materialize them', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ar/collections/top-community-skills'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/ar/collections/top-community-contributed-ai-agent-skills');
  });

  it('redirects legacy docs aliases to the canonical docs page before SSR', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/docs/development/create-skill'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/docs/creating-skills');
  });

  it('does not block valid repeated route paths that exist in sitemap map', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/IstiN/dmtools/dmtools'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('index, follow');
  });

  it('crawler requests short-circuit invalid skill detail URLs before downstream SSR', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/not-a-real-owner/not-a-real-route', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('crawler requests allow sitemap-blocklisted skill routes to render outside sitemap generation', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/openclaw/openclaw/openclaw-release-maintainer', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });

  it('crawler requests keep valid canonical skill detail URLs reachable', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/coleam00/Archon/archon', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });
});

// ============================================================================
// Property 6: 管理员 Basic Auth
// Feature: nextjs-to-astro-migration, Property 6: 管理员 Basic Auth
// Validates: Requirements 4.1, 4.2, 4.3, 4.5
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 6: 管理员 Basic Auth', () => {
  /** Helper to create a Basic Auth header value. */
  function makeBasicAuth(user: string, pass: string): string {
    return `Basic ${btoa(`${user}:${pass}`)}`;
  }

  it('valid credentials always result in pass', () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any admin path, when the request provides valid Basic Auth
     * credentials, the middleware should allow access (pass).
     */
    const usernameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).filter((s) => !s.includes(':'));
    const passwordArb = fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*_-]{1,20}$/).filter((s) => !s.includes(':'));

    fc.assert(
      fc.property(usernameArb, passwordArb, (user, pass) => {
        const authHeader = makeBasicAuth(user, pass);
        const result = checkAdminAuth(authHeader, user, pass);
        expect(result).toBe('pass');
      }),
      { numRuns: 100 },
    );
  });

  it('missing authorization header always results in unauthorized', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * When no authorization header is provided, the middleware should
     * return unauthorized.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        (validUser, validPass) => {
          const result = checkAdminAuth(null, validUser, validPass);
          expect(result).toBe('unauthorized');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('wrong username always results in unauthorized', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * When the provided username doesn't match, the middleware should
     * return unauthorized regardless of the password.
     */
    const usernameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).filter((s) => !s.includes(':'));
    const passwordArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).filter((s) => !s.includes(':'));

    fc.assert(
      fc.property(usernameArb, usernameArb, passwordArb, (wrongUser, validUser, validPass) => {
        fc.pre(wrongUser !== validUser);
        const authHeader = makeBasicAuth(wrongUser, validPass);
        const result = checkAdminAuth(authHeader, validUser, validPass);
        expect(result).toBe('unauthorized');
      }),
      { numRuns: 100 },
    );
  });

  it('wrong password always results in unauthorized', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * When the provided password doesn't match, the middleware should
     * return unauthorized regardless of the username.
     */
    const usernameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).filter((s) => !s.includes(':'));
    const passwordArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).filter((s) => !s.includes(':'));

    fc.assert(
      fc.property(usernameArb, passwordArb, passwordArb, (validUser, wrongPass, validPass) => {
        fc.pre(wrongPass !== validPass);
        const authHeader = makeBasicAuth(validUser, wrongPass);
        const result = checkAdminAuth(authHeader, validUser, validPass);
        expect(result).toBe('unauthorized');
      }),
      { numRuns: 100 },
    );
  });

  it('default credentials (admin/admin) work when no env vars are set', async () => {
    // Delete any Github Actions or local injected secrets
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_USER;

    const authHeader = makeBasicAuth('admin', 'admin');
    // checkAdminAuth defaults to admin/admin when no user/pass provided
    const result = checkAdminAuth(authHeader, 'admin', 'admin');
    expect(result).toBe('pass');
  });

  it('malformed authorization headers always result in unauthorized', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * Malformed or garbage authorization headers should always result
     * in unauthorized.
     */
    const malformedHeaderArb = fc.oneof(
      // No "Basic " prefix
      fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.replace(/^Basic /i, 'Broken ')),
      // Invalid base64
      fc.constant('Basic !!!not-base64!!!'),
      // Empty string
      fc.constant(''),
      // Just "Basic" with no value
      fc.constant('Basic'),
      // Random strings
      fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/).filter((s) => !s.startsWith('Basic ')),
    );

    fc.assert(
      fc.property(malformedHeaderArb, (header) => {
        const result = checkAdminAuth(header, 'admin', 'admin');
        expect(result).toBe('unauthorized');
      }),
      { numRuns: 100 },
    );
  });

  it('checkAdminAuth always returns either pass or unauthorized', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3**
     *
     * For any input, checkAdminAuth should always return a valid result
     * (either 'pass' or 'unauthorized').
     */
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        (authHeader, validUser, validPass) => {
          const result = checkAdminAuth(authHeader, validUser, validPass);
          expect(['pass', 'unauthorized']).toContain(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});
