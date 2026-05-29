# Phase 63: authority-and-intervention-readiness-reassessment - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Auto discussion from Phase `62` proof-window evidence, authority uplift scorecard, recovery delta board, recovery execution queue, and recovery experiment ladder

<domain>
## Phase Boundary

This phase reassesses whether the project is allowed to promote authority surfaces, reopen discovery expansion, or advance manual recovery interventions toward limited rollout or automation.

This phase covers:

- reading the refreshed `2026-05-06` proof window as the upstream truth source
- deciding whether any authority surface is promotion-ready
- deciding whether any manual recovery intervention is repeatable enough for limited rollout or automation candidacy
- preserving explicit closed/locked decisions when gates are not met
- creating operator-readable evidence for why traffic recovery has not been allowed to expand yet

This phase does not cover:

- creating new authority surfaces
- broad catalog expansion
- automating any intervention
- changing SEO copy or page design directly
- replacing the need for a fresh Coverage Drilldown export
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Treat the Phase `62` proof window as current but not trustworthy enough for expansion because its trust verdict is `blocking`.
- **D-02:** Keep discovery expansion closed unless the authority scorecard reports at least `2` primary surfaces with decision `promote`.
- **D-03:** Keep the Full Skills Directory out of the active uplift lane because it remains the supporting breadth surface, not the lead recovery bet.
- **D-04:** Treat manual recovery interventions as human-driven until a later proof window validates the intended success signal.
- **D-05:** Keep automation locked unless the proof substrate is trustworthy, the authority uplift boundary is open, and measurement prerequisites are clear.
- **D-06:** Prioritize measurement freshness first: stale Coverage Drilldown raw exports prevent confident cluster-level attribution even when production crawl health is clean.
</decisions>

<specifics>
## Specific Ideas

- Authority scorecard evidence currently reports `0 promote / 31 hold / 1 stop`.
- Discovery expansion boundary is `closed`.
- Recovery experiment ladder currently reports `0` limited-rollout experiments and `0` automation candidates.
- Automation policy is `locked`.
- Manual-active experiments exist, but they remain manual-only: issue cluster triage/canonicalization and guarded authority uplift loops.
- The immediate blocker is stale Coverage Drilldown evidence (`2026-04-16`, age `18` day(s) in the refreshed proof window), not a broken live sitemap.
- The sitemap/crawl lane should remain watch-only after the deployment fix because sampled production crawl health is clean.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase scope
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.8-phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-01-SUMMARY.md`
- `.planning/milestones/v1.8-phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-VERIFICATION.md`

### Current recovery evidence
- `reports/seo/latest-recovery-proof-window.json`
- `reports/seo/latest-recovery-delta-board.json`
- `reports/seo/latest-authority-uplift-scorecard.json`
- `reports/seo/latest-recovery-experiment-ladder.json`
- `reports/seo/latest-recovery-execution-queue.json`
- `reports/seo/latest-crawl-health.json`
- `reports/gsc/latest-ctr-report.json`
- `reports/seo/latest-coverage-drilldown.json`

### Reassessment code paths
- `scripts/seo-authority-uplift-scorecard.ts`
- `scripts/seo-recovery-experiment-ladder.ts`
- `scripts/seo-recovery-execution-queue.ts`
- `scripts/lib/authority-uplift-scorecard.ts`
- `scripts/lib/recovery-experiment-ladder.ts`
- `scripts/lib/recovery-execution-queue.ts`
</canonical_refs>

<deferred>
## Deferred Ideas

- Reopen discovery expansion only after the authority scorecard produces enough promote-ready primary surfaces.
- Automate recovery interventions only in a later milestone after repeatability is proven by multiple trustworthy windows.
- Create new authority surfaces only after existing surfaces earn promotion from proof, not before.
</deferred>

---

_Phase: 63-authority-and-intervention-readiness-reassessment_
_Context gathered: 2026-05-06_
