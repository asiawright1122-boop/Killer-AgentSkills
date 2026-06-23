# Phase 133 Research — Sitemap Purity

## 1. Objective

Audit and refine dynamic sitemap generators (`sitemap-skills.xml`, `sitemap.xml`, etc.) to eliminate redirections, inactive language pages, blacklisted items, or potential 404 error URLs, ensuring 100% search crawler compliance and optimal crawl budget usage.

---

## 2. Sitemap Architecture Analysis

Currently, our sitemap is structured as a **Sitemap Index** with several logical sub-sitemaps:

- **`sitemap.xml.ts`**: The main index file.
- **`sitemap-static.xml.ts`**: Handles static layouts and solution intent pages.
- **`sitemap-docs.xml.ts`**: Formulates links for docs.
- **`sitemap-blog.xml.ts`**: Handles blog post detail pages and blog category pages.
- **`sitemap-collections.xml.ts`**: Formulates collection indexes and details.
- **`sitemap-skills.xml.ts` / `sitemap-skills-[page].xml.ts`**: Dynamic skill detail sitemaps.

---

## 3. Potential Vulnerabilities & Purity Risks

During our codebase inspection, the following crawl warning vulnerabilities were discovered:

### 3.1 Empty Blog Category 404 Vulnerability
- **Code Reference**: [sitemap-blog.xml.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/sitemap-blog.xml.ts#L72-L83) vs [[category].astro](file:///Users/kaka/Dev/Killer-Skills/src/pages/[locale]/blog/category/[category].astro#L37-L41)
- **Problem**: The category detail route `[category].astro` returns a hard `404` status code if there are 0 posts matching the category (even after falling back to English). However, `sitemap-blog.xml.ts` unconditionally loops over all `BLOG_CATEGORIES` and `SUPPORTED_LOCALES` to output pages like `/{locale}/blog/category/{cat}`. If a category lacks posts in both the locale and the English fallback, the crawlers will receive a 404 when hitting these sitemap links.
- **Fix**: Modify `sitemap-blog.xml.ts` to pre-validate category eligibility by querying whether at least one active (non-draft) post exists under the category (either in the locale or in the English fallback) before writing the URL to the sitemap.

### 3.2 Blocklist & Noindex Omission in Non-Skill Sitemaps
- **Problem**: Our `sitemap-skills.xml.ts` correctly compiles and honors `data/seo-sitemap-blocklist.json` to filter out excluded URLs. However, other sub-sitemaps (like `sitemap-collections.xml.ts`, `sitemap-blog.xml.ts`, and `sitemap-docs.xml.ts`) do not check if specific slugs or pages are blocklisted. If an operator manually excludes a collection or blog page in the future via blocklist, these pages will still leak into the sitemaps.
- **Fix**: Standardize blocklist filtering so that collections, blog posts, and docs can be filtered using the same blocklist mechanism.

### 3.3 Trailing Slash Consistency
- **Problem**: Every sitemap script uses a local helper `normalizeUrl(url)` that replaces trailing slashes (e.g. `url.replace(/\/+$/, '')`). If the router or CDN redirects these URLs to include trailing slashes, crawlers will hit 301 redirects instead of clean 200 pages.
- **Fix**: For Phase 133, ensure sitemap output maintains URL structure consistency with the router's expectations. (The deep alignment of edge routing redirects will be solved in Phase 134).

### 3.4 Hindi Pruning Validation
- **Confirmation**: After deleting `hi.json` in Phase 131, `SUPPORTED_LOCALES` no longer includes `hi`. Because all sitemaps dynamically loop over `SUPPORTED_LOCALES`, the sitemaps naturally exclude Hindi URLs. This must be covered by automated checks during compilation.

---

## 4. Proposed Verification Strategy

- Run Astro build check to verify sitemaps compile correctly.
- Add specific unit tests to verify sitemaps exclude empty blog categories.
- Assert that no Hindi locale links (`/hi/`) are output in any generated sitemap files.
