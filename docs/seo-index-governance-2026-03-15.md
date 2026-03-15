# SEO Index Governance (2026-03-15)

## What Changed

This phase focuses on three indexing safeguards:

1. Collection detail pages now index only locale variants with direct localized `title` and `description`.
2. Collection sitemap output now follows the same locale eligibility rules as the page runtime.
3. Skill detail structured data no longer emits synthetic `AggregateRating` derived from internal scores.

## Rules

### 1. Locale eligibility is explicit

A localized collection page is indexable only when that locale has both:

- `title[locale]`
- `description[locale]`

If a locale is missing either field:

- the page renders for users
- the page is `noindex`
- canonical points to the preferred eligible locale
- `hreflang` excludes that locale
- sitemap excludes that locale

Implementation lives in:

- [seo-locales.ts](/Users/kaka/Dev/Killer-Skills/src/lib/seo-locales.ts)

### 2. Sitemap and runtime must agree

Collection sitemap generation uses the same locale eligibility helper as the page template. This avoids advertising non-indexable locale URLs to Google.

Implementation lives in:

- [sitemap-collections.xml.ts](/Users/kaka/Dev/Killer-Skills/src/pages/sitemap-collections.xml.ts)
- [[...slug].astro](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/collections/[...slug].astro)

### 3. Structured data must stay policy-safe

Skill detail pages use `SoftwareApplication` structured data, but must not fabricate review or rating signals from internal metadata.

Implementation lives in:

- [skill-schema.ts](/Users/kaka/Dev/Killer-Skills/src/lib/skill-schema.ts)

## Audit Commands

Run these before shipping SEO-sensitive changes:

```bash
npm run audit:seo:index-integrity
npm run audit:seo:index-quality
npm run seo:frontmatter:guard
npm run seo:smoke -- http://127.0.0.1:4321
```

## Current Follow-Up Debt

The new index integrity audit currently reports these non-blocking warnings:

- 30 collections with partial locale coverage

For CI or release branches, use `npm run audit:seo:index-quality` to fail builds when missing/thin skill content exists.
