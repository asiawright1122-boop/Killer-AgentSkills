# Phase 56: authority-surface-uplift-program-and-promotion-gates - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** authority-surface program, `v1.5` editorial queue, and the need to expand only from proof-backed surfaces

<domain>
## Phase Boundary

This phase turns post-governance evidence into explicit authority-surface decisions.

This phase covers:

- defining the uplift loop for priority authority surfaces
- measuring freshness, internal-link support, CTR, impressions, and position alongside editorial effort
- setting promotion / hold / stop gates for surfaces and discovery expansion
- keeping expansion constrained to surfaces that actually earn it

This phase does not cover:

- low-level experiment automation
- reopening broad corpus growth
- creating net-new discovery products without evidence
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Authority surfaces should only be promoted when they clear both evidence and freshness thresholds.
- **D-02:** Editorial effort should be measured against outcome movement, not treated as inherently valuable.
- **D-03:** Expansion gates must be explicit enough that the team can say `not yet` without ambiguity.
- **D-04:** This phase should make `UX-EXP-01` operational, not leave it as a general warning.
</decisions>

<specifics>
## Specific Ideas

- The current authority program already tracks `17` surfaces and `5` editorial queue items; this phase should decide which ones deserve more attention.
- Homepage, collections, installation docs, and comparison / workflow surfaces may need different thresholds or cadences.
- The output should likely separate `promote now`, `keep steady`, and `stop pushing` surfaces.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-CONTEXT.md`
- `reports/seo/latest-recovery-delta-board.json`
- `reports/seo/latest-authority-surface-program.json`
- `data/authority-surfaces.json`
- `src/pages/public-links.test.ts`
</canonical_refs>

<deferred>
## Deferred Ideas

- Automation of uplift loops remains Phase `57` work.
- Net-new discovery surfaces outside the current authority inventory remain out of scope until the gates are proven.
</deferred>

---

_Phase: 56-authority-surface-uplift-program-and-promotion-gates_
_Context gathered: 2026-04-16_
