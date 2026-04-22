# Phase 34: locale-content-governance-guards - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Auto-generated context from v1.1 requirements, current SEO/content scripts, and existing public-surface contract tests

<domain>
## Phase Boundary

This phase consolidates locale/content/SEO drift detection into one governance lane so operators can see warning-only debt vs publish-blocking failures before another large repair cycle accumulates.

This phase covers:
- one canonical governance command that aggregates locale/content drift signals into Markdown + JSON
- explicit warning vs blocking severity for governance checks
- representative localized public-route verification for translation, breadcrumb, metadata, and tutorial-shell contract drift
- machine-readable outputs suitable for operator review and future milestone audit inputs

This phase does not cover:
- re-running broad content regeneration or translation backfills
- changing the product copy strategy or adding new public surfaces
- replacing existing SEO smoke or collection audit scripts with a new platform
- automatic issue creation or backlog seeding beyond reporting
</domain>

<decisions>
## Implementation Decisions

### Governance lane shape
- **D-01:** Phase 34 should aggregate existing good checks into one governance command instead of inventing a parallel drift system from scratch.
- **D-02:** The governance lane must emit both human-readable Markdown and machine-readable JSON from one underlying data model.
- **D-03:** Severity must distinguish warning-only debt from blocking failures, with an explicit threshold gate similar to the provider-health lane.

### Drift signals to include
- **D-04:** Collection locale coverage and collection SEO-slug/canonical drift should remain part of the governance lane because they are cheap, structured early-warning signals.
- **D-05:** Representative localized public-route contracts should be enforced through targeted regression tests covering translation usage, breadcrumb/metadata builders, and tutorial-shell/markdown-heading behavior.
- **D-06:** Translation, breadcrumb, metadata, and tutorial-shell drift should be treated as blocking when contract tests fail; structured collection drift can remain warning-only unless thresholds are tightened later.

### Rollout posture
- **D-07:** Reuse and extract logic from existing scripts where practical; Phase 34 is a consolidation/governance phase, not a full SEO-tool rewrite.
- **D-08:** The operator command should be runnable locally with no external services required for its core checks.
- **D-09:** Current clean baseline should remain green at the default threshold so the governance lane can be adopted immediately.

### the agent's Discretion
- Exact report section naming and JSON field nesting
- Whether the command shells out to targeted Vitest suites or inlines equivalent checks
- Where governance artifacts live on disk, as long as they are stable and committed to one obvious location
</decisions>

<specifics>
## Specific Ideas

- Current baseline is healthy:
  - `scripts/seo-collection-locale-gaps.ts` reports `35/35` collections with full locale coverage
  - `scripts/seo-collection-drift.ts` reports `0` issues
  - targeted route/content contract suites pass (`50` tests)
- The existing checks are already valuable, but they are fragmented:
  - `scripts/seo-collection-locale-gaps.ts`
  - `scripts/seo-collection-drift.ts`
  - `src/pages/public-links.test.ts`
  - `src/messages/public-copy.test.ts`
  - `src/lib/markdown-headings.test.ts`
  - `src/lib/site/breadcrumbs.test.ts`
  - `src/lib/site/metadata.test.ts`
- The highest-leverage outcome is one governance report that operators can run before drift becomes another broad Phase 02-style cleanup.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and requirement state
- `.planning/PROJECT.md` — v1.1 hardening posture
- `.planning/REQUIREMENTS.md` — `GOV-01`, `GOV-02`, `GOV-03`
- `.planning/ROADMAP.md` — Phase 34 goal and success criteria
- `.planning/STATE.md` — active milestone position after Phase 33 completion
- `.planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md` — current traceability/reporting conventions

### Existing governance signals
- `scripts/seo-collection-locale-gaps.ts` — collection locale coverage audit
- `scripts/seo-collection-drift.ts` — collection slug/canonical drift audit
- `scripts/seo-smoke.ts` — representative public-surface smoke coverage
- `scripts/seo-crawl-health.ts` — broader crawl monitoring context
- `data/seo-collection-locale-gaps.json` — latest locale-gap evidence
- `data/seo-collection-drift.json` — latest drift evidence

### Public contract checks
- `src/pages/public-links.test.ts` — public route i18n, breadcrumb, metadata, and content contract checks
- `src/messages/public-copy.test.ts` — localized copy integrity checks
- `src/lib/markdown-headings.test.ts` — tutorial-shell heading extraction contract
- `src/lib/site/breadcrumbs.test.ts` — breadcrumb JSON-LD parity
- `src/lib/site/metadata.test.ts` — canonical / alternate / locale metadata parity

### Existing operator patterns
- `scripts/lib/ai-provider-health.ts` — reusable report + gate pattern to mirror for governance
- `scripts/ai-provider-health.ts` — CLI wrapper structure for operator commands
- `.planning/traceability/latest-milestone-traceability.json` — example of machine-readable milestone artifact style
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seo-collection-locale-gaps.ts` already computes structured locale-gap data with stable JSON output.
- `scripts/seo-collection-drift.ts` already computes structured collection drift issues and code buckets.
- Existing Vitest suites already encode the most important translation/breadcrumb/metadata/tutorial-shell contracts.
- `scripts/lib/ai-provider-health.ts` provides a proven pattern for severity gates, Markdown + JSON outputs, and operator-friendly rendering.

### Established Patterns
- Operational reporting in this repo is script-first, artifact-backed, and usually paired with an npm command.
- Warning vs blocking thresholds are already part of the project's AI observability posture and should be mirrored here.
- Public-surface regressions are often caught most reliably through focused contract tests rather than through raw source scanning alone.

### Integration Points
- Phase 34 should aggregate collection audits and targeted Vitest route/content contracts into one report lane.
- `package.json` should expose the canonical governance command.
- The resulting JSON report should be easy for future milestone audit or workflow wiring to consume.
</code_context>

<deferred>
## Deferred Ideas

- Auto-opening TODOs or issues when governance severity crosses threshold
- Scheduled GitHub workflow enforcement for the governance lane
- Full live-site crawl/smoke integration into the same command if a later milestone needs broader production gating
- Cross-locale semantic diffing for blog/body translations beyond current contract checks
</deferred>

---

*Phase: 34-locale-content-governance-guards*
*Context gathered: 2026-04-06*
