# Phase 134 Research — Trailing-Slash Consistency

## 1. Objective

Harmonize URL trailing-slash handling across the edge router, pages, and sitemaps in accordance with the project's global setting `trailingSlash: 'never'` to eliminate duplicate indexing paths and avoid wasting search crawler budget on 301 redirects.

---

## 2. Codebase Investigation Findings

### 2.1 Trailing Slash Configuration & Router Actions
- **Global Configuration**: Configured in `astro.config.mjs` as `trailingSlash: 'never'`.
- **Edge Middleware Redirects**: In `src/middleware.ts` (lines 542-598), any request pathname that ends with a trailing slash (and is not `/`) is intercepted. If it represents a valid route, it is 301 redirected to the extension-less, slash-less path.
- **Sitemap Uniformity**: All sitemaps (`sitemap-blog.xml`, `sitemap-collections.xml`, etc.) consistently sanitize URLs before outputting them using `normalizeUrl(url)`.

### 2.2 Hardcoded Trailing Slash Leaks (SLASH-01)
We ran a dedicated scan across all components and contents for relative links containing trailing slashes (`href="/..."` or markdown links `(/.../)`).
The scan revealed exactly **10 leaks** in the blog content files:
- `src/content/blog/ar/automating-i18n-workflows-with-llms.md` (line 25): `[Killer-Skills](/ar/)`
- `src/content/blog/de/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills-Portal](/de/)`
- `src/content/blog/en/automating-i18n-workflows-with-llms.md` (line 34): `[Killer-Skills Portal](/en/)`
- `src/content/blog/es/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills Portal](/es/)`
- `src/content/blog/fr/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills](/fr/)`
- `src/content/blog/ja/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills Portal](/ja/)`
- `src/content/blog/ko/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills Portal](/ko/)`
- `src/content/blog/pt/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills Portal](/pt/)`
- `src/content/blog/ru/automating-i18n-workflows-with-llms.md` (line 26): `[Killer-Skills Portal](/ru/)`
- `src/content/blog/zh/automating-i18n-workflows-with-llms.md` (line 23): `[Killer-Skills Portal](/zh/)`

These relative links trigger unnecessary 301 redirects when visited by users or search crawlers.

---

## 3. Proposed Fix Strategy

1. **Fix Blog Content Leaks**: Update all 10 localizations of `automating-i18n-workflows-with-llms.md` to change home links from `(/<locale>/)` to `(/<locale>)`.
2. **Defensive Testing Expansion**: Update `tests/pages/public-links.test.ts` to include detection patterns for relative URLs containing trailing slashes (e.g. `href="/..."` or markdown links `(/.../)`), preventing future regressions from sliding into production.

---

## 4. Verification Plan

- Run `npm run build` and `npm test` to verify zero regression.
- Assert that the updated tests flag any new trailing slash regressions.
