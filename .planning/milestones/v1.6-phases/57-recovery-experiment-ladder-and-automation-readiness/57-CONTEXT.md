# Phase 57: recovery-experiment-ladder-and-automation-readiness - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** `GEO-02`, the new authority-lift gates, and the need to keep automation behind proven manual wins

<domain>
## Phase Boundary

This phase formalizes how recovery experiments move from manual work into guarded rollout and eventually into automation candidates.

This phase covers:

- defining the experiment ladder states and their evidence requirements
- documenting promotion, hold, rollback, and retirement criteria
- linking experiment readiness to the authority uplift gates instead of bypassing them
- making sure automation candidates are explicit and auditable before they are implemented

This phase does not cover:

- running broad autonomous recovery experiments
- adding paid-provider or cost-policy changes
- promoting surfaces that failed the uplift gates
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Every experiment must have a queue state, a manual validation state, and a rollback path before it can be called automation-ready.
- **D-02:** Automation candidacy depends on repeatable manual wins, not on wishful thinking or editorial fatigue.
- **D-03:** The ladder should reduce accidental rollout risk by making failure states just as explicit as success states.
- **D-04:** This phase should hand the project a reusable governance model for later automation, not immediately automate the experiments themselves.
</decisions>

<specifics>
## Specific Ideas

- Some interventions will probably remain manual forever; that should be an allowed outcome.
- The ladder should likely include `queued`, `manual-active`, `review`, `limited-rollout`, `automation-candidate`, and `retired` states.
- Rollback reasons should include stale evidence, noisy attribution, negative movement, and cost / risk concerns.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-CONTEXT.md`
- `reports/seo/latest-authority-uplift-scorecard.json`
- `reports/seo/latest-recovery-execution-queue.json`
- `reports/seo/latest-recovery-delta-board.json`
</canonical_refs>

<deferred>
## Deferred Ideas

- Actual experiment automation implementation should wait for a later milestone after the ladder proves useful.
- Broader growth experimentation outside the authority-surface model remains out of scope.
</deferred>

---

_Phase: 57-recovery-experiment-ladder-and-automation-readiness_
_Context gathered: 2026-04-16_
