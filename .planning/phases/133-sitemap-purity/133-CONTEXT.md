# Phase 133: Sitemap Purity - Context

**Gathered:** 2026-06-23
**Status:** Ready for execution
**Source:** User request and research

<domain>
## Phase Boundary

This phase refines sitemap generation logic to guarantee sitemap purity by filtering out redundant or dead links (specifically empty blog categories) and standardizing blocklist exclusions for blog and collection pages.

</domain>

<decisions>
## Implementation Decisions

### Empty Blog Category Cleanup
- Before adding a category URL like `/${locale}/blog/category/${cat}` to the sitemap, we must check if there is at least one active blog post belonging to that category in that locale (or in the English fallback, as supported by `[category].astro`).

### Blocklist Validation
- Non-skill sitemap files (such as `sitemap-blog.xml.ts` and `sitemap-collections.xml.ts`) should import the compiled blocklist and filter out URLs present in the exclusion rules.

### Hindi Locale Exclusion
- Ensure sitemap generation strictly loops over `SUPPORTED_LOCALES` to naturally prevent any `/hi/` paths from leaking.

</decisions>

<canonical_refs>
## Canonical References

- [sitemap-blog.xml.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/sitemap-blog.xml.ts)
- [sitemap-collections.xml.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/sitemap-collections.xml.ts)
- [sitemap-blocklist.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/sitemap-blocklist.ts)

</canonical_refs>
