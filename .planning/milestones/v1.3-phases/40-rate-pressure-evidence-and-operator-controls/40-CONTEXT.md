# Phase 40: rate-pressure-evidence-and-operator-controls - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Completed Phase 39 routing baseline, current AI health warning output, and existing provider telemetry / health-report contracts

<domain>
## Phase Boundary

This phase turns 429-heavy provider pressure into explicit routing signals and operator-facing evidence instead of leaving it as a passive historical warning.

This phase covers:
- promoting provider-pressure history into shared routing or telemetry signals
- improving operator-facing evidence so routing reasons are visible at label/provider level
- keeping guarded recovery behavior aligned across script runtime and `skills/try`

This phase does not cover:
- GitHub issue / PR handoff automation
- phase archive / restore lifecycle automation
- widening backup-provider behavior beyond the explicit fallback contract
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Reuse the workload-aware routing contract from Phase 39 rather than introducing a second pressure-specific policy layer.
- **D-02:** Treat provider-pressure evidence as operator-visible guidance first; any guarded recovery must remain explicit and auditable.
- **D-03:** Prefer label/provider-level reasoning over one aggregated warning line so operators can see which pool members are driving degradation.
</decisions>

<specifics>
## Specific Ideas

- The latest health report still warns on historical NVIDIA volatility even though the current snapshot is healthy, which means the operator signal is accurate but not yet actionable enough.
- Phase 39 introduced workload profile metadata and shared routing parity; Phase 40 should now deepen the pressure model instead of reworking the workload contract.
- Existing telemetry already records `provider_failure`, `provider_cooldown`, and label-level counters, so Phase 40 can elevate evidence without inventing a second source of truth.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-VERIFICATION.md`
- `src/lib/ai-provider-routing.ts`
- `scripts/lib/ai.ts`
- `src/pages/api/skills/try.ts`
- `scripts/lib/ai-provider-health.ts`
- `reports/seo/latest-ai-provider-health.md`
- `reports/seo/latest-ops-summary.md`
</canonical_refs>

---

*Phase: 40-rate-pressure-evidence-and-operator-controls*
*Context gathered: 2026-04-07*
