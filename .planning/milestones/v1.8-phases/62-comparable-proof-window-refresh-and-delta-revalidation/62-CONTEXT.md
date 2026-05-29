# Phase 62: comparable-proof-window-refresh-and-delta-revalidation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `v1.8` roadmap scope, Phase `61` freshness outputs, live crawl audit, current proof-window artifacts, and refreshed SEO remediation evidence

<domain>
## Phase Boundary

This phase turns the refreshed Coverage substrate into an actually comparable proof window and revalidates the delta board against current inputs instead of stale or missing evidence.

This phase covers:

- restoring the missing demand-side proof inputs that currently leave impressions, clicks, and CTR as `n/a`
- making live crawl accessibility part of the proof-input contract when sitemap failures suppress exposure
- regenerating the recovery proof window and recovery delta board from refreshed inputs
- ensuring blocking input states produce explicit operator-readable artifacts instead of brittle script failures

This phase does not cover:

- reopening authority-surface promotion or expansion decisions
- automation rollout or experiment scheduling
- broad copy, design, or catalog expansion work
- unrelated repo cleanup outside the proof-input and delta-validation lane
</domain>

<decisions>
## Implementation Decisions

- **D-01:** The `2026-04-23` proof window is a seeded baseline, not a trustworthy comparison window; it must not be treated as recovery proof.
- **D-02:** Missing Search Console configuration is a blocking proof-input failure because it removes the evidence needed to judge impressions, clicks, CTR, and page/query movement.
- **D-03:** Live skills sitemap availability is part of exposure proof. A sitemap index that advertises broken skills sitemap URLs is an SEO blocker, not a cosmetic bug.
- **D-04:** Phase `62` should prefer stable `blocking` artifacts over abrupt script crashes when required inputs are absent or stale.
- **D-05:** Recovery delta revalidation must consume the refreshed proof window sequentially; downstream boards should not be treated as valid if their upstream artifacts are missing or seeded-only.
</decisions>

<specifics>
## Specific Ideas

- The live site currently serves `https://killer-skills.com/sitemap.xml` with six broken `sitemap-skills-{n}.xml` entries returning `404`, which directly harms discovery and crawl trust.
- Local code now introduces a stable `/sitemap-skills.xml` route and middleware redirects for legacy `/sitemap-skills-{n}.xml`, but the live proof lane remains blocked until that fix ships.
- `reports/gsc/latest-ctr-report.json` is currently `blocking` with `sourceMode=missing-config`, so all demand-side proof remains absent.
- `reports/seo/latest-crawl-health.md` now records the sitemap failure explicitly: `6` sitemap fetch errors and `744` sampled page URLs checked successfully from the surviving sitemap set.
- `reports/seo/latest-404-remediation-plan.md` shows the 404 waste is still dominated by invalid routes rather than missed canonicalization alone: `155` redirect candidates, `828` `410` candidates, `12` manual review, `5` observe.
- `reports/seo/latest-authority-uplift-scorecard.md` currently keeps `31` surfaces on hold and `1` stopped because impressions/clicks remain unavailable and the proof window is still `blocking`.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase scope
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-VERIFICATION.md`
- `.planning/milestones/v1.6-phases/54-post-governance-recovery-proof-window/54-CONTEXT.md`
- `.planning/milestones/v1.6-phases/54-post-governance-recovery-proof-window/54-PLAN.md`

### Current proof and crawl evidence
- `reports/gsc/latest-ctr-report.json`
- `reports/seo/latest-crawl-health.json`
- `reports/seo/latest-coverage-drilldown.json`
- `reports/seo/latest-recovery-proof-window.json`
- `reports/seo/latest-recovery-delta-board.json`
- `reports/seo/latest-authority-uplift-scorecard.json`
- `reports/seo/latest-404-remediation-plan.json`

### Proof and exposure code paths
- `scripts/gsc-fetch-report.ts`
- `scripts/seo-crawl-health.ts`
- `scripts/seo-recovery-proof-window.ts`
- `scripts/seo-recovery-delta-board.ts`
- `scripts/seo-authority-uplift-scorecard.ts`
- `scripts/lib/recovery-proof-window.ts`
- `scripts/lib/recovery-delta-board.ts`
- `src/pages/sitemap.xml.ts`
- `src/pages/sitemap-skills.xml.ts`
- `src/middleware.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/gsc-fetch-report.ts` already writes a durable blocking artifact when Search Console configuration is missing.
- `scripts/lib/recovery-proof-window.ts` and `scripts/lib/recovery-delta-board.ts` already encode the comparison and trust-verdict contracts that Phase `62` should strengthen.
- `scripts/seo-crawl-health.ts` now preserves sitemap-fetch failures in the report instead of crashing before operators can see what broke.
- `src/pages/sitemap.xml.ts`, `src/pages/sitemap-skills.xml.ts`, and `src/middleware.ts` now define the intended stable skills sitemap contract.

### Established Patterns
- Recovery evidence lives as `latest-*` JSON and Markdown artifacts plus dated proof-window snapshots.
- SEO governance prefers explicit guardrails and machine-readable blocker states over silent best-effort behavior.

### Integration Points
- Live skills sitemap correctness affects crawl health, which affects whether exposure proof is trustworthy.
- GSC demand evidence feeds the proof window, which feeds the delta board, which in turn feeds Phase `63` authority readiness.
- 404 remediation evidence helps explain why exposure may stay suppressed even after structural governance work ships.
</code_context>

<deferred>
## Deferred Ideas

- Authority-surface promotion decisions belong to Phase `63`.
- Recovery experiment ladder and automation readiness remain deferred until the proof window is trustworthy and repeatable.
- Broader growth bets should stay closed while demand evidence is missing and sitemap trust is broken live.
</deferred>

---

_Phase: 62-comparable-proof-window-refresh-and-delta-revalidation_
_Context gathered: 2026-04-23_
