# Phase 117: Scorecard Promotion Verification - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the enriched authority surfaces against production-like SEO evidence by refreshing GSC traffic inputs, regenerating recovery proof artifacts, and running the authority uplift scorecard plus operator queue.
</domain>

<decisions>
## Implementation Decisions

### Production-Like Inputs
- **D-01:** Refresh live Search Console inputs with `npm run report:gsc:fetch` before promotion scoring.
- **D-02:** Refresh the recovery scorecard, recovery control board, authority surface program, proof window, and recovery delta board before running the authority uplift scorecard.
- **D-03:** Run the authority scorecard without `SEO_FORCE_EXPANSION_OPEN`; promotion status must come from the current proof, traffic, ranking, and internal-link gates.

### Promotion Interpretation
- **D-04:** Treat the scorecard result as the source of truth even when it blocks expansion. Phase 117 validates promotion readiness; it does not force promotion.
- **D-05:** Discovery expansion remains closed unless at least two primary authority surfaces reach `promote`.
</decisions>

<canonical_refs>
## Canonical References

- `reports/gsc/latest-ctr-report.json`
- `reports/seo/latest-recovery-scorecard.json`
- `reports/seo/latest-recovery-control-board.json`
- `reports/seo/latest-authority-surface-program.json`
- `reports/seo/latest-recovery-proof-window.json`
- `reports/seo/latest-recovery-delta-board.json`
- `reports/seo/latest-authority-uplift-scorecard.json`
- `reports/seo/latest-authority-operator-queue.json`
</canonical_refs>
