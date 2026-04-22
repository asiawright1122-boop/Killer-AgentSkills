# Phase 49: skill-locale-index-governance - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** 2026-04-16 Google-guidelines SEO audit, current skill locale indexing behavior, and the existing collection locale-governance precedent

<domain>
## Phase Boundary

This phase stops the skills corpus from over-indexing multilingual variants whose crawler-visible content is not actually localized.

This phase covers:

- defining an explicit locale-eligibility contract for skill detail pages
- aligning runtime canonical, hreflang, and noindex behavior to that contract
- aligning the skill sitemap output to the same contract
- shipping audit artifacts that quantify which locales remain indexable versus suppressed

This phase does not cover:

- redesigning the skill page around first-party evaluation instead of imported README content
- broad keep/consolidate/remove decisions across the whole skill corpus
- rebuilding authority surfaces such as collections, comparisons, or tutorials
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Skill locale governance should be at least as strict as the collection locale contract that already exists in the project.
- **D-02:** A non-English skill URL must not remain self-canonicalized if the crawler-visible title, description, or primary body are still effectively source-language content.
- **D-03:** Reduced index volume is an acceptable tradeoff if it produces stronger canonical and multilingual trust signals.
- **D-04:** One shared locale-eligibility rule should drive runtime metadata, sitemap emission, and governance reporting rather than each surface guessing independently.
</decisions>

<specifics>
## Specific Ideas

- The current skill sitemap emits every supported locale for every skill, which is too broad relative to actual localized content quality.
- The skill detail page skips localization for crawler requests, so Googlebot can see a non-English URL with English or source-language body content.
- Initial governance should likely preserve English by default and allow additional locales only when title, description, and crawler-visible main body all qualify.
- The output of this phase should make it obvious how many locale variants are being kept, suppressed, or consolidated.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `docs/seo-google-guidelines-audit-2026-04-16.md`
- `docs/seo-index-governance-2026-03-15.md`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/lib/site/metadata.ts`
- `src/lib/i18n-dynamic.ts`
- `src/pages/sitemap-skills-[page].xml.ts`
- `reports/seo/latest-coverage-drilldown.md`
- `reports/seo/latest-crawl-health.md`
- `reports/gsc/latest-ctr-report.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/[locale]/collections/[...slug].astro` — already implements a stricter locale eligibility and canonical-locale pattern for collections
- `src/lib/site/metadata.ts` — central metadata builder that emits canonical and hreflang links
- `src/lib/i18n-dynamic.ts` — current localization path and the source of crawler vs user localization divergence

### Established Patterns
- Collection pages already treat locale eligibility as an explicit SEO contract instead of assuming all locales are indexable
- Skill pages currently treat all locales as alternates unless overridden, which is the main contract mismatch this phase needs to remove

### Integration Points
- Skill detail runtime metadata in `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Skill sitemap emission in `src/pages/sitemap-skills-[page].xml.ts`
- Governance and regression coverage in `src/pages/public-links.test.ts` plus any new locale-governance report script added in this phase
</code_context>

<deferred>
## Deferred Ideas

- Rebuilding the skill detail template around a first-party evaluation layer belongs to Phase `50`
- Large-scale keep/consolidate/noindex/remove decisions across the full corpus belong to Phase `51`
- Re-centering organic recovery on collections, official skills, and other authority surfaces belongs to Phase `52`
</deferred>

---

_Phase: 49-skill-locale-index-governance_
_Context gathered: 2026-04-16_
