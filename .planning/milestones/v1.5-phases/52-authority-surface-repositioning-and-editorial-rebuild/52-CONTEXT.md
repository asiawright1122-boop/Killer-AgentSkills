# Phase 52: authority-surface-repositioning-and-editorial-rebuild - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** 2026-04-16 Google-guidelines SEO audit, the post-pruning recovery strategy, and the need to shift demand recovery toward fewer higher-trust pages

<domain>
## Phase Boundary

This phase re-centers organic recovery on a smaller set of authority surfaces that better reflect Killer-Skills' own curation and editorial judgment.

This phase covers:

- defining the authority-surface inventory for recovery
- rebuilding internal discovery emphasis toward those surfaces
- creating the editorial/governance program for keeping those surfaces strong over time
- making sure post-pruning recovery depends on curated, first-party assets instead of bulk skill detail expansion

This phase does not cover:

- broad site redesign unrelated to authority-surface emphasis
- net-new paid acquisition channels
- automated experimentation loops before the manual authority strategy proves itself
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Collections, official skills, comparisons, and workflow/tutorial pages should become the primary organic recovery surfaces.
- **D-02:** Internal discovery and linking should reinforce those surfaces instead of treating the entire skill corpus as equally important.
- **D-03:** Authority surfaces must carry stronger first-party editorial depth and maintenance expectations than the average long-tail skill page.
- **D-04:** The project should treat authority-surface recovery as an editorial operating model, not just a one-off metadata tweak.
</decisions>

<specifics>
## Specific Ideas

- The audit's end-state is not merely a smaller corpus; it is a site where the most important entry pages feel curated and original.
- Authority surfaces likely include collection pages, official or highly trusted skill pages, comparison pages, and workflow/tutorial content with firsthand guidance.
- Internal linking, homepage emphasis, and browse flows should help Google and users find those pages first.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-CONTEXT.md`
- `docs/seo-google-guidelines-audit-2026-04-16.md`
- `src/pages/[locale]/index.astro`
- `src/pages/[locale]/collections/index.astro`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/[locale]/skills/index.astro`
- `src/pages/[locale]/solutions/index.astro`
- `reports/seo/latest-recovery-control-board.json`
- `reports/seo/latest-coverage-drilldown.md`
- `reports/gsc/latest-ctr-report.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Collections, solutions, and docs/blog surfaces already behave more like curated landing pages than raw-source wrappers
- The homepage and browse surfaces already have strong public-link contracts that can be redirected toward the new authority inventory

### Established Patterns
- Public-link and metadata tests already exist, which makes authority-surface emphasis testable rather than purely editorial
- The project already has recovery-board artifacts that can help choose which surfaces deserve authority status first

### Integration Points
- Homepage and collection/surface routes under `src/pages/[locale]/`
- Public discovery link tests in `src/pages/public-links.test.ts`
- New authority inventory and governance artifacts under `reports/seo/` and `data/`
</code_context>

<deferred>
## Deferred Ideas

- Automated recovery experiments remain deferred until the manual authority-surface strategy shows repeatable wins
- New growth surfaces outside the current curated authority model remain out of scope for this milestone
</deferred>

---

_Phase: 52-authority-surface-repositioning-and-editorial-rebuild_
_Context gathered: 2026-04-16_
