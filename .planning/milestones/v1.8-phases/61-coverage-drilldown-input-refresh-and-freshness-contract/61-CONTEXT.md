# Phase 61: coverage-drilldown-input-refresh-and-freshness-contract - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `v1.8` roadmap scope, existing Coverage Drilldown ingest/report scripts, and the current stale local raw export dated `2026-04-03`

<domain>
## Phase Boundary

This phase restores the freshness contract for Coverage Drilldown raw inputs before any new recovery proof claim is made.

This phase covers:

- ingesting and archiving fresh Coverage Drilldown raw inputs as dated repository-local evidence
- making the raw-input freshness state explicit in operator-facing reports and machine-readable artifacts
- ensuring downstream recovery-proof phases can trust the newest Coverage source selection instead of inheriting the stale `2026-04-03` local export

This phase does not cover:

- generating the second comparable proof window itself
- reinterpreting authority-surface promotion posture
- re-scoring manual interventions for rollout or automation
- broad SEO cleanup work outside the raw-input freshness lane
</domain>

<decisions>
## Implementation Decisions

### Freshness contract
- **D-01:** Phase `61` should reuse the existing Coverage Drilldown archive and ingest lane under `data/coverage-drilldown-raw/` instead of inventing a separate raw-data contract.
- **D-02:** Freshness must be proven from dated repository-local artifacts, not by assuming the newest file in `~/Downloads` is good enough.
- **D-03:** Operator-facing outputs must make it obvious when Coverage Drilldown freshness is fresh, warning, blocking, or missing before downstream proof work proceeds.

### Scope boundaries
- **D-04:** This phase stops at restoring trustworthy raw-input freshness and the freshness contract; the refreshed proof-window comparison belongs to Phase `62`.
- **D-05:** If ingest or source discovery reveals ambiguity between archived and downloaded raw sources, Phase `61` should make the selection rules explicit instead of silently picking one.

### Output posture
- **D-06:** The lane should preserve both machine-readable and operator-readable artifacts so later proof and audit phases can reuse the same freshness evidence.
</decisions>

<specifics>
## Specific Ideas

- Keep `reports/seo/latest-coverage-drilldown-ingest.{md,json}` as the operator-visible ingest checkpoint for what was imported, skipped, and selected as latest.
- Keep `reports/seo/latest-coverage-drilldown.{md,json}` as the downstream freshness report that Phase `62` can consume.
- Prefer extending `scripts/lib/coverage-drilldown-source.ts` and the existing CLI/report scripts over adding new one-off scripts.
- Preserve the currently explicit freshness thresholds (`warning` vs `blocking`) unless execution proves they are mismatched to the repo's actual cadence.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase scope
- `.planning/PROJECT.md` — Active `v1.8` milestone framing and recovery-proof constraints
- `.planning/REQUIREMENTS.md` — `REC-24` requirement contract
- `.planning/ROADMAP.md` — Phase `61` goal, boundaries, and success criteria
- `.planning/STATE.md` — Current blocker state and active milestone context
- `.planning/milestones/v1.6-phases/54-post-governance-recovery-proof-window/54-CONTEXT.md` — Prior proof-window decisions that this freshness phase must support
- `.planning/milestones/v1.6-phases/54-post-governance-recovery-proof-window/54-PLAN.md` — Earlier proof-window execution pattern and verification expectations

### Coverage Drilldown ingest and reporting
- `scripts/lib/coverage-drilldown-source.ts` — Canonical raw-source discovery, archive, and ingest helpers
- `scripts/lib/coverage-drilldown-source.test.ts` — Existing regression surface for source classification and ingest behavior
- `scripts/seo-coverage-drilldown-ingest.ts` — Current ingest/report entry point for raw Coverage Drilldown sources
- `scripts/seo-coverage-drilldown.ts` — Current freshness and cluster report generator

### Downstream proof consumers
- `scripts/seo-recovery-proof-window.ts` — Phase `62` consumer of refreshed Coverage outputs
- `scripts/seo-recovery-delta-board.ts` — Delta board consumer that depends on trustworthy proof inputs
- `reports/seo/latest-coverage-drilldown-ingest.json` — Current ingest artifact shape
- `reports/seo/latest-coverage-drilldown.json` — Current freshness artifact shape
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/lib/coverage-drilldown-source.ts`: already encapsulates archive discovery, downloads discovery, ingest, and canonical source-path logic.
- `scripts/seo-coverage-drilldown-ingest.ts`: already writes the latest ingest artifacts and is the best place to harden import/selection reporting.
- `scripts/seo-coverage-drilldown.ts`: already computes freshness and cluster priorities, so Phase `61` should extend this reporting contract instead of branching it.

### Established Patterns
- Recovery evidence lanes preserve `latest-*` outputs plus dated archive history rather than replacing operator context with one-off files.
- Machine-readable JSON and operator-readable Markdown are kept in parallel for planning, audit, and follow-on automation decisions.

### Integration Points
- Phase `61` feeds Phase `62` by making Coverage freshness trustworthy enough for a new proof window.
- The ingest/source helpers are the shared integration seam between raw downloads, archive history, and downstream recovery reports.
</code_context>

<deferred>
## Deferred Ideas

- The second comparable proof window itself belongs to Phase `62`.
- Re-evaluating authority-surface promotion posture belongs to Phase `63`.
- Re-scoring manual interventions for repeatability belongs to Phase `63`.
</deferred>

---

_Phase: 61-coverage-drilldown-input-refresh-and-freshness-contract_
_Context gathered: 2026-04-23_
