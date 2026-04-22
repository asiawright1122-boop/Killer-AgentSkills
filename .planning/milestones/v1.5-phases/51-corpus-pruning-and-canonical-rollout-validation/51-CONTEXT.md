# Phase 51: corpus-pruning-and-canonical-rollout-validation - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** 2026-04-16 Google-guidelines SEO audit, current coverage duplication clusters, and the need to reduce the indexable skill corpus to a governed set

<domain>
## Phase Boundary

This phase turns the new locale and originality contracts into an explicit keep/consolidate/noindex/remove rollout across the public skill corpus.

This phase covers:

- classifying the current skill corpus into governed publication buckets
- regenerating sitemap and other publication outputs to match that governed set
- capturing before/after counts and validation artifacts for the rollout
- checking that structural pruning does not get confused with accidental crawl regressions

This phase does not cover:

- designing the first-party evaluation contract itself
- broader authority-surface repositioning after the corpus is reduced
- speculative growth expansion before the governed corpus is proven safe
</domain>

<decisions>
## Implementation Decisions

- **D-01:** The project should make explicit keep/consolidate/noindex/remove decisions instead of letting weak pages stay indexable by default.
- **D-02:** Structural pruning must remain auditable; operators need before/after counts and reasons, not just a smaller sitemap.
- **D-03:** Consolidation is preferable to duplication when the page can still serve users through a stronger canonical target.
- **D-04:** The rollout should preserve the ability to distinguish governance-driven deindexing from new crawl or canonical failures.
</decisions>

<specifics>
## Specific Ideas

- The coverage drilldown already shows large duplicate, redirected, source-file, and not-indexed clusters; pruning should directly reduce those weak surfaces where possible.
- The rollout needs a machine-readable output so future audits can tell which URLs were intentionally reduced.
- This phase is about narrowing the public corpus deliberately, not passively waiting for Google to ignore weak pages.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-CONTEXT.md`
- `.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-CONTEXT.md`
- `docs/seo-google-guidelines-audit-2026-04-16.md`
- `data/sitemap-skills.json`
- `data/seo-sitemap-blocklist.json`
- `src/pages/sitemap-skills-[page].xml.ts`
- `src/lib/sitemap-blocklist.ts`
- `scripts/build-skills-cache.ts`
- `reports/seo/latest-coverage-drilldown.md`
- `reports/seo/latest-crawl-health.md`
- `reports/gsc/latest-ctr-report.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/sitemap-skills.json` and `data/seo-sitemap-blocklist.json` already act as publication-control artifacts
- `src/lib/sitemap-blocklist.ts` and sitemap generation code already provide one place to enforce publication filtering

### Established Patterns
- The project already uses report scripts and machine-readable JSON artifacts to explain SEO state and rollout posture
- Crawl-health and coverage reports already separate technical failures from other forms of index loss; this phase should preserve that separation

### Integration Points
- Skill publication outputs in `data/` and `src/pages/sitemap-skills-[page].xml.ts`
- Governance/report scripts under `scripts/`
- Coverage and recovery validation artifacts under `reports/seo/`
</code_context>

<deferred>
## Deferred Ideas

- Repositioning internal discovery toward curated authority surfaces belongs to Phase `52`
- New recovery experiments or organic growth loops stay deferred until the governed corpus is stable and validated
</deferred>

---

_Phase: 51-corpus-pruning-and-canonical-rollout-validation_
_Context gathered: 2026-04-16_
