# Phase 35: provider-history-and-runtime-convergence - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Auto-generated context from `v1.2` requirements, `v1.1` audit debt, current AI routing code, and latest provider-health artifacts

<domain>
## Phase Boundary

This phase turns the current provider-health lane from a short-window operator view into a longer-window routing foundation, while removing the last meaningful policy split between the script-side AI runtime and `src/pages/api/skills/try.ts`.

This phase covers:
- longer-window provider history and ranking guidance derived from existing telemetry artifacts
- reusable routing logic that both script-side AI execution and the skill-try API route can share
- explicit preservation of NVIDIA-primary, guarded backups, and Workers AI `free-only` posture
- provider-health outputs and regression coverage that explain how 429-heavy history influences current selection order

This phase does not cover:
- introducing paid Workers AI or widening backup-provider policy
- building a hosted dashboard product or external observability service
- wiring CI or scheduled monitoring for the new reports (that belongs to Phase 36)
- auto-seeding remediation work when thresholds are crossed (that belongs to Phase 37)
</domain>

<decisions>
## Implementation Decisions

### Routing contract shape
- **D-01:** Phase 35 should extend the existing report-first telemetry architecture instead of inventing a separate routing-control subsystem.
- **D-02:** Longer-window provider history may influence ranking and guidance, but it must never override explicit fallback policy semantics such as `cold` and `guarded`.
- **D-03:** NVIDIA remains the preferred healthy path; backup providers remain explicit backups, and Workers AI remains separately constrained by `free-only` budget logic.
- **D-04:** Shared routing logic should live in pure TypeScript helpers that both the script runtime and the API route can import, rather than trying to force the Astro route to depend on the full Node-side `AIService`.

### History and ranking posture
- **D-05:** Existing telemetry samples and trend builders should be reused as the basis for longer-window ranking signals where practical, instead of adding a second history format.
- **D-06:** Provider-health outputs should expose enough ranking and history context that operators can understand why the runtime currently prefers one NVIDIA label over another.
- **D-07:** Historical instability should degrade priority or surface warnings, but it must not silently push traffic into backup providers unless explicit fallback gates allow that move.

### Rollout and verification
- **D-08:** The route-level `skills/try` flow and script-side AI runtime should share one common fallback and ranking contract, with tests covering healthy NVIDIA, unavailable NVIDIA, and repeated-429 conditions.
- **D-09:** Real-data artifacts should stay human-readable and machine-readable, following the existing provider-health Markdown + JSON pattern.
- **D-10:** Phase 35 should be locally verifiable without requiring live production calls beyond the existing provider-health report command.

### the agent's Discretion
- Exact score or weighting formula for longer-window provider guidance
- Whether the shared helper is added to `src/lib/` or another runtime-safe shared location
- Exact field names for new ranking/history details in the Markdown and JSON artifacts
</decisions>

<specifics>
## Specific Ideas

- The current provider-health report already shows the central operator pain point:
  - current severity is `soft warning`
  - latest snapshot is healthy
  - historical NVIDIA volatility across the recent 20-sample window is still noisy
- `scripts/lib/ai.ts` already computes available-provider order, fallback gating, and label-level telemetry, but the live ranking is still mostly based on current availability plus local rotation.
- `src/pages/api/skills/try.ts` already imports the shared fallback-policy helper, but it still keeps its own cooldown state, provider waterfall, and selection behavior separate from the script-side runtime.
- The highest-leverage outcome is one runtime-safe routing contract that can answer:
  - is NVIDIA configured and currently healthy?
  - how noisy has each label been across the recent window?
  - what should the selection order be right now?
  - are backups still blocked by policy, even if history is noisy?
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and requirement state
- `.planning/PROJECT.md` — active `v1.2` milestone definition
- `.planning/REQUIREMENTS.md` — `AIOPS-05`, `AIOPS-07`
- `.planning/ROADMAP.md` — Phase 35 goal and success criteria
- `.planning/STATE.md` — active milestone position after bootstrap
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md` — carry-forward debt motivating this phase
- `.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-01-SUMMARY.md` — prior fallback-policy hardening decisions

### Existing AI routing and report implementation
- `scripts/lib/ai.ts` — current provider routing, telemetry snapshot, and fallback activation recording
- `scripts/lib/ai-provider-health.ts` — current provider-health report contract
- `scripts/lib/ai-telemetry-trend.ts` — recent-window trend and alert derivation
- `src/lib/ai-fallback-policy.ts` — current pure fallback-policy helper shared across runtimes
- `src/pages/api/skills/try.ts` — current route-level provider waterfall and cooldown handling

### Current evidence artifacts
- `reports/seo/latest-ai-provider-health.md` — latest operator-facing provider-health summary
- `reports/seo/latest-ai-provider-health.json` — latest machine-readable provider-health output
- `reports/seo/latest-ai-runtime-summary.json` — latest raw telemetry checkpoint consumed by reports

### Existing tests
- `scripts/lib/ai.test.ts` — script-side routing and provider-state regression coverage
- `scripts/lib/ai-provider-health.test.ts` — provider-health report semantics
- `src/lib/ai-fallback-policy.test.ts` — pure fallback-policy semantics
- `src/pages/api/skills/try.test.ts` — route-level fallback behavior under `cold`, `guarded`, and `always`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai-fallback-policy.ts` already provides a runtime-safe pure helper for `cold`, `guarded`, and `always` fallback semantics.
- `scripts/lib/ai.ts` already produces label-level telemetry, cooldown/quarantine signals, and recent fallback activations.
- `scripts/lib/ai-provider-health.ts` already turns telemetry plus trend data into one Markdown + JSON operator contract.
- `src/pages/api/skills/try.ts` already has test coverage for policy posture across healthy and unhealthy NVIDIA scenarios.

### Established Patterns
- AI operations in this repo are report-first, artifact-backed, and designed to be consumed by both humans and automated workflows.
- Backup providers are explicit cold or guarded backups; they are not supposed to become hidden members of the primary rotation.
- Runtime-safe shared helpers belong outside the Node-only `AIService` implementation, then get imported by both sides.

### Integration Points
- Phase 35 should add shared ranking and fallback helpers that both `scripts/lib/ai.ts` and `src/pages/api/skills/try.ts` can consume.
- The provider-health report should surface longer-window ranking context using the same artifact lane operators already trust.
- Existing tests provide a strong base for adding 429-heavy history and ranking scenarios without inventing a new test harness.
</code_context>

<deferred>
## Deferred Ideas

- CI or scheduled workflow execution of the new provider-health ranking lane
- Auto-seeding GitHub issues, todos, or remediation artifacts from provider thresholds
- Hosted dashboards or persistent external storage beyond repo-local review artifacts
- Re-scoping Workers AI into paid or hybrid modes
</deferred>

---

*Phase: 35-provider-history-and-runtime-convergence*
*Context gathered: 2026-04-07*
