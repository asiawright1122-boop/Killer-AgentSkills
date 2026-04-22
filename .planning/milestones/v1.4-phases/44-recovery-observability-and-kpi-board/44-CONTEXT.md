# Phase 44: recovery-observability-and-kpi-board - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Phase `43` closure evidence, latest crawl / coverage / index / AI health artifacts, and the currently missing Search Console and newer Coverage Drilldown inputs

<domain>
## Phase Boundary

This phase turns the now-stable crawl recovery into an operator-facing recovery scorecard so we can distinguish "technical recovery is fixed" from "traffic is actually returning."

This phase covers:

- consolidating crawl, coverage, index, and traffic evidence into one scorecard artifact
- surfacing missing or stale source inputs explicitly instead of silently reporting a false green state
- defining weekly gates for crawl health, coverage freshness, index integrity, and traffic visibility
- carrying forward AI runtime posture as contextual evidence so recovery work does not hide provider risk

This phase does not cover:

- changing provider routing or relaxing Workers AI `free-only` posture
- re-running large traffic recovery loops beyond report generation
- fixing Search Console authentication or importing missing raw exports by hand
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Treat `https://killer-skills.com` production evidence as the source of truth for recovery status; preview domains remain validation-only.
- **D-02:** Reuse existing report inputs (`latest-crawl-health`, `latest-coverage-drilldown`, `index-drift`, `latest-ai-provider-health`) instead of inventing a parallel monitoring path.
- **D-03:** Missing or stale inputs must produce explicit `warning` / `blocking` states in the board, not empty sections or implied passes.
- **D-04:** Separate "technical recovery" from "business recovery" in the scorecard so crawl closure is not mistaken for traffic closure.
- **D-05:** AI runtime posture is included as recovery context, but policy remains unchanged: NVIDIA primary, backups explicit, Workers AI `free-only` at `60/60`.
  </decisions>

<specifics>
## Specific Ideas

- Phase `43` completed on 2026-04-09 with sampled main-domain crawl health at `2xx=1650`, `4xx=0`, `5xx=0`, and `Cloudflare 1102=0`.
- `reports/seo/latest-coverage-drilldown.json` currently points only to `/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-03`, so coverage attribution is present but stale.
- `reports/seo/index-drift.json` currently reports `onlyInSitemap=0` and `onlyInIndexableCache=0`, which is the clean technical baseline we want to preserve.
- `reports/gsc/` is not currently present in this workspace, so traffic recovery cannot be business-validated from fresh Search Console evidence.
- `reports/seo/latest-ai-provider-health.json` confirms Workers AI remains `free-only` at `60/60`, while SiliconFlow still shows a billing/access warning.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-01-SUMMARY.md`
- `.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-VERIFICATION.md`
- `reports/seo/latest-traffic-recovery-audit.md`
- `reports/seo/latest-crawl-health.json`
- `reports/seo/latest-coverage-drilldown.json`
- `reports/seo/index-drift.json`
- `reports/seo/latest-ai-provider-health.json`
- `scripts/seo-crawl-health.ts`
- `scripts/seo-coverage-drilldown.ts`
- `scripts/seo-index-integrity.ts`
- `scripts/gsc-fetch-report.ts`
- `scripts/gsc-ctr-report.ts`
- `scripts/operator-ops-summary.ts`
- `scripts/lib/operator-ops-summary.ts`
  </canonical_refs>

---

_Phase: 44-recovery-observability-and-kpi-board_
_Context gathered: 2026-04-09_
