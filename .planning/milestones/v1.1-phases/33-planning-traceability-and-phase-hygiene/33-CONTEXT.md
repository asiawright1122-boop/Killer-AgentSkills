# Phase 33: planning-traceability-and-phase-hygiene - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Auto-generated context from v1.1 requirements, the v1.0 milestone audit, and the current `.planning/` directory state

<domain>
## Phase Boundary

This phase makes the active milestone's planning evidence machine-traceable and removes planning-directory noise that can distort GSD state, audit, and closeout workflows.

This phase covers:
- defining a consistent machine-readable metadata contract for active-phase summaries and verification artifacts
- making requirement coverage derivable from `REQUIREMENTS.md`, roadmap state, and phase artifacts without manual reconstruction
- normalizing or filtering stale planning artifacts so active-phase discovery is driven by the roadmap instead of raw directory leftovers
- producing repository-local traceability evidence that future milestone audits can consume directly

This phase does not cover:
- adding new end-user product features or locale-governance checks from Phase 34
- rewriting the historical narrative content of every legacy summary beyond the metadata needed for traceability
- replacing upstream GSD tooling with a custom planning system
- changing already-shipped milestone outcomes for `v1.0`
</domain>

<decisions>
## Implementation Decisions

### Traceability contract
- **D-01:** Active milestone phase summaries and verification files must expose machine-readable frontmatter for the data future audits need, with requirement completion recorded explicitly instead of inferred from prose.
- **D-02:** Requirement closure for the active milestone should be computable from repository files alone: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, summary frontmatter, and verification artifacts.
- **D-03:** The machine-readable contract should extend the Phase 31/32 frontmatter pattern rather than inventing a second documentation format.

### Discovery and hygiene rules
- **D-04:** Active-phase discovery must be roadmap-driven and phase-number-aware; directories that are not valid roadmap phases must not influence completion or progress calculations.
- **D-05:** Legacy artifacts may remain available for reference, but stale directories under active `phases/` must be archived, renamed, or ignored by the active traceability path so they cannot distort GSD scans.
- **D-06:** Current milestone indexes (`STATE.md`, `ROADMAP.md`, `MILESTONES.md`, milestone archives) should define the authoritative boundary between active work and archived work.

### Rollout posture
- **D-07:** Phase 33 should normalize metadata and discovery first; it should not require a risky full rewrite of all historical planning prose before audits become reliable.
- **D-08:** Any new traceability output should be reproducible in local and CI workflows from checked-in files, not from conversational memory or one-off manual interpretation.
- **D-09:** Human-readable summaries remain the primary narrative artifact; machine-readable additions should stay lightweight and adjacent to the existing docs.

### the agent's Discretion
- Exact file names for any generated traceability index or audit-ready summary
- Whether hygiene is enforced via a dedicated script, existing GSD-compatible report command, or both
- How aggressively to retrofit older milestone files once the active-milestone contract is in place
</decisions>

<specifics>
## Specific Ideas

- The `v1.0` milestone audit already names the Phase 33 debt explicitly:
  - `REQUIREMENTS.md` was stale during the audit
  - most older `SUMMARY.md` files were not machine-readable
  - the former stray `audit-comprehensive` directory has been archived under `.planning/milestones/v1.0-audit-comprehensive/` so active `phases/` discovery no longer sees it as current work
- Phase 31 and Phase 32 already establish the target metadata direction: both summary and verification artifacts include YAML frontmatter plus `requirements_completed`.
- Older phases still use mixed summary formats, mixed plan naming (`01-PLAN.md`, `PLAN.md`, `30-PLAN.md`), and no consistent requirements metadata, so passive discovery alone is not reliable enough.
- `.planning/MILESTONES.md` and `.planning/milestones/v1.0-{ROADMAP,REQUIREMENTS}.md` now provide a workable active-vs-archived milestone boundary that Phase 33 should formalize instead of duplicating.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and requirement state
- `.planning/PROJECT.md` — v1.1 hardening posture and the reason planning traceability is an active requirement
- `.planning/REQUIREMENTS.md` — `TRACE-01`, `TRACE-02`, and `TRACE-03`
- `.planning/ROADMAP.md` — Phase 33 goal and success criteria
- `.planning/STATE.md` — active milestone and current GSD position
- `.planning/MILESTONES.md` — current milestone registry and archive boundary

### Audit evidence and target contract
- `.planning/v1.0-MILESTONE-AUDIT.md` — explicit statement of the traceability and hygiene debt this phase must close
- `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md` — current summary frontmatter contract
- `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-VERIFICATION.md` — current verification frontmatter contract
- `.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-01-SUMMARY.md` — latest completed summary with requirement metadata
- `.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-VERIFICATION.md` — latest verification artifact with requirement metadata

### Hygiene problem examples
- `.planning/milestones/v1.0-audit-comprehensive/AUDIT.md` — archived audit input retained for reference without polluting active phase discovery
- `.planning/milestones/v1.0-phases/30-audit-comprehensive/30-01-SUMMARY.md` — valid numbered roadmap phase for comparison against the stray legacy directory
- `.planning/milestones/v1.0-phases/01-resolve-ui/01-01-SUMMARY.md` — older summary format without machine-readable requirement metadata
- `.planning/milestones/v1.0-phases/02-re-enrichment-pipeline-run/02-VERIFICATION.md` — older verification format that is human-readable but not fully traceable

### Codebase and planning structure maps
- `.planning/codebase/STRUCTURE.md` — location and purpose of `.planning/` within the repo
- `.planning/codebase/CONCERNS.md` — existing planning and operational debt notes
- `.planning/codebase/CONVENTIONS.md` — naming and documentation conventions to preserve
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 31/32 summary and verification frontmatter provide a live example of the metadata shape the active milestone should standardize on.
- `.planning/MILESTONES.md` plus `.planning/milestones/v1.0-*.md` already give the repo an archive pattern that Phase 33 can build on.
- `v1.0-MILESTONE-AUDIT.md` already enumerates the exact traceability gaps, so the phase does not need to rediscover the problem statement.

### Established Patterns
- Planning artifacts live directly in `.planning/` and are intended to be readable in git, not hidden in a separate database.
- Historical phases are heterogeneous: some use frontmatter, some are pure prose, and plan file naming is not uniform.
- Recent phases favor explicit machine-readable metadata alongside human-readable Markdown, which is the right compatibility path for this cleanup.

### Integration Points
- Requirement coverage work must reconcile `REQUIREMENTS.md`, `ROADMAP.md`, and phase summary/verification artifacts.
- Hygiene work must operate on `.planning/phases/`, `.planning/milestones/`, and `STATE.md` together so archived artifacts stop polluting active-phase discovery.
- Any audit-ready output should be easy for both local operators and future milestone-closeout flows to regenerate.
</code_context>

<deferred>
## Deferred Ideas

- Automatic milestone bootstrap/closeout generation for future milestones (`TRACE-04`)
- Hosted planning dashboards or richer UI around milestone traceability
- Automatically opening follow-up todos/issues when planning hygiene checks fail
- Phase 34 locale/content governance checks and drift blocking
</deferred>

---

*Phase: 33-planning-traceability-and-phase-hygiene*
*Context gathered: 2026-04-06*
