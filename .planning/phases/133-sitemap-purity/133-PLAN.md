---
phase: 133
plan: 133-01
type: execute
wave: 1
depends_on:
  - 132
files_modified:
  - src/pages/sitemap-blog.xml.ts
  - src/pages/sitemap-collections.xml.ts
autonomous: true
---

# Phase 133 Plan — Sitemap Purity

## Objective

Refine sitemap generators (`sitemap-blog.xml.ts`, `sitemap-collections.xml.ts`, etc.) to filter out empty blog categories (preventing GSC 404 crawl errors) and support blocklist filtering across non-skill sitemaps.

## Requirement Traceability

- **SITEMAP-01**: Ensure sitemap generation excludes redirects, dead links, or dynamic drafts.

***

## Tasks

### Task 1: Pre-validate Blog Categories in sitemap-blog.xml.ts

<read_first>
- File: `src/pages/sitemap-blog.xml.ts`
- Reference: `src/pages/[locale]/blog/category/[category].astro` (specifically post fallback logic)
</read_first>

<acceptance_criteria>
- Blog category URLs (`/${locale}/blog/category/${cat}`) are only output to `sitemap-blog.xml` if that category has at least one active, non-draft blog post (or fallback English post).
- `npm run build` compiles without errors.
</acceptance_criteria>

<action>
Modify `src/pages/sitemap-blog.xml.ts`:
1. Query active blog posts: `await getCollection('blog', ({ data }) => !data.draft)`.
2. For each category and locale: check if there exists at least one post for `data.lang === locale && data.category === category`, or if `locale !== 'en'`, check if there exists a post for `data.lang === 'en' && data.category === category`.
3. If no posts exist in either, skip writing that category sitemap URL.
</action>

***

### Task 2: Standardize Blocklist Check in Blog & Collections Sitemaps

<read_first>
- File: `src/pages/sitemap-blog.xml.ts`
- File: `src/pages/sitemap-collections.xml.ts`
- Reference: `src/lib/sitemap-blocklist.ts`
</read_first>

<acceptance_criteria>
- Both sitemap scripts import and parse `seo-sitemap-blocklist.json`.
- Blocklisted blog posts and collections are filtered out from the sitemap.
</acceptance_criteria>

<action>
1. Import `sitemapBlocklistData` from `../../data/seo-sitemap-blocklist.json`.
2. Compile blocklist using `compileSitemapBlocklist(sitemapBlocklistData)`.
3. Before writing a blog post URL (e.g. `/blog/${slug}`) or collection URL (e.g. `/collections/${slug}`), check if the exact URL/slug is blocked in `exactKeys`. Skip the URL if it is blocklisted.
</action>

***

### Task 3: Build Verification and Purity Asserts

<read_first>
- Reference: `package.json` (specifically `build` script)
- Reference: `src/build-validation.test.ts`
</read_first>

<acceptance_criteria>
- `npm run build` exits with code 0.
- All sitemap files are successfully compiled.
- No `/hi/` (Hindi) locale URLs are output in any generated sitemap files.
</acceptance_criteria>

<action>
1. Execute Astro production build:
   ```bash
   npm run build
   ```
2. Write a scratch test or inspection script to parse the output in `dist/` and assert that no sitemap contains `/hi/` paths.
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Blog category pre-validation drops legitimate categories | Ensure the validation logic accurately mirrors the English fallback rendering fallback defined in `[category].astro`. |
| Empty collections return 404 but are included in sitemap | Keep checking `localizedSeoLocales.length === 0` in `sitemap-collections.xml.ts` to skip empty collections. |
