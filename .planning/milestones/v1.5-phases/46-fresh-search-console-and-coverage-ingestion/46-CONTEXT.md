# Phase 46: fresh-search-console-and-coverage-ingestion - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** `v1.4` audit, latest recovery scorecard, missing GSC summary, stale Coverage Drilldown raw exports, and the current report scripts under `scripts/`

<domain>
## Phase Boundary

This phase restores the freshness and reliability of the business-evidence lane that the recovery scorecard depends on.

This phase covers:

- making Search Console summary generation reproducible and fresh
- making Coverage Drilldown raw-input freshness explicit and operator-visible
- ensuring stale or missing traffic evidence fails honestly instead of quietly degrading confidence
- preserving the current technical-recovery and AI-guardrail truths while business evidence is rebuilt

This phase does not cover:

- broad public-surface recovery execution
- new acquisition surfaces or growth experiments
- changing the NVIDIA-primary or Workers AI `free-only` posture
- claiming traffic has recovered before fresh business evidence exists
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Treat missing Search Console evidence as a first-class blocker, not a soft warning.
- **D-02:** Treat Coverage Drilldown freshness as an SLA that should be visible in reports and operator handoff.
- **D-03:** Preserve the recovery scorecard as the top-level truth surface; ingestion improvements should feed that board rather than create a competing dashboard.
- **D-04:** Prefer deterministic repo-local artifacts over one-off manual exports so business recovery can be reviewed asynchronously.
  </decisions>

<specifics>
## Specific Ideas

- `reports/gsc/latest-ctr-report.md` is currently missing, which is the biggest reason `businessRecoveryStatus` remains `BLOCKING`.
- `reports/seo/latest-coverage-drilldown.json` is fresh as a generated artifact, but its newest raw source is still dated `2026-04-03`, so freshness handling needs to distinguish generated freshness from source freshness.
- `scripts/seo-recovery-scorecard.ts` already consumes both traffic and coverage evidence; Phase `46` should improve those upstream inputs first.
- The milestone should end this phase with one reliable evidence lane, not with another temporary manual checklist.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.4-MILESTONE-AUDIT.md`
- `reports/seo/latest-recovery-scorecard.json`
- `reports/seo/latest-coverage-drilldown.json`
- `reports/seo/latest-crawl-health.json`
- `reports/gsc/latest-ctr-report.md`
- `scripts/seo-recovery-scorecard.ts`
- `scripts/seo-coverage-drilldown.ts`
- `scripts/gsc-fetch-report.ts`
  </canonical_refs>

---

_Phase: 46-fresh-search-console-and-coverage-ingestion_
_Context gathered: 2026-04-09_
