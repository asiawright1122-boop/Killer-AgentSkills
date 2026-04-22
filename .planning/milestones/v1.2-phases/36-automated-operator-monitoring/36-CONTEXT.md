# Phase 36: automated-operator-monitoring - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Active `v1.2` requirements, existing GitHub Actions workflows, and the AI/content governance operator lanes completed in Phases 31, 34, and 35

<domain>
## Phase Boundary

This phase makes existing operator lanes run automatically in CI and scheduled monitoring with explicit thresholds and review artifacts.

This phase covers:
- wiring AI provider health into automated monitoring contexts with explicit threshold configuration
- wiring content governance into automated monitoring contexts with explicit threshold configuration
- making scheduled monitoring upload durable review artifacts and publish operator-facing summaries
- surfacing crawl-health thresholds explicitly in workflow configuration instead of relying on script defaults

This phase does not cover:
- remediation seeding or issue creation when thresholds are crossed
- one combined durable operator summary artifact that merges AI health, governance, and remediation state
- milestone bootstrap / closeout automation
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Reuse existing report commands (`report:ai:health`, `report:content:governance`, `report:seo:crawl-health`) instead of inventing new operator logic in workflow YAML.
- **D-02:** Prefer extending the current CI and scheduled monitoring workflows over creating a large new orchestration layer.
- **D-03:** Thresholds must be explicit in workflow env or command args, even when they match current script defaults.
- **D-04:** Scheduled monitoring should publish durable review artifacts via GitHub Actions artifacts plus job summaries.
- **D-05:** CI should validate repo-local AI health and content governance artifacts with thresholds suitable for merge protection, while scheduled monitoring keeps production/public smoke and crawl checks.
</decisions>

<specifics>
## Specific Ideas

- `data-pipeline.yml` already runs `report:ai:health`, but `content-governance` is not yet part of automated operator monitoring.
- `seo-monitoring.yml` already runs production smoke and crawl health on a schedule, but it does not currently include AI health or content governance outputs.
- `ci.yml` currently exercises tests/builds, but it does not validate AI health and content governance as first-class operator artifacts.
- `seo-crawl-health.ts` already supports threshold env vars; the workflow should declare them explicitly.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `scripts/ai-provider-health.ts`
- `scripts/content-governance-report.ts`
- `scripts/seo-crawl-health.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/data-pipeline.yml`
- `.github/workflows/seo-monitoring.yml`
- `scripts/run-pipeline.sh`
</canonical_refs>

<success_shape>
## Success Shape

- CI can run AI health and content governance with explicit thresholds and publish their artifacts.
- Scheduled monitoring can review AI health, content governance, and crawl health without manual shell intervention.
- Operators can inspect uploaded Markdown/JSON artifacts from automated runs instead of relying on local ad-hoc execution.
</success_shape>

---

*Phase: 36-automated-operator-monitoring*
*Context gathered: 2026-04-07*
