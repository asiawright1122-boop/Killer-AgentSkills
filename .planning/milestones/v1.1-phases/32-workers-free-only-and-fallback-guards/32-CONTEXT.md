# Phase 32: workers-free-only-and-fallback-guards - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Auto-generated context from v1.1 requirements, Phase 31 outcomes, and current AI runtime audit

<domain>
## Phase Boundary

This phase hardens runtime provider routing so Workers AI stays provably inside its free-only budget and backup providers only activate under explicit, auditable conditions.

The phase covers:
- Restoring and preserving Workers AI run-level and daily free-only budget evidence across checkpoint resumes
- Making Workers AI budget state machine-readable, including current budget status and block reasons
- Introducing an explicit fallback-routing policy instead of silently appending backup providers behind NVIDIA
- Recording each backup-provider activation with an explicit reason in telemetry outputs
- Surfacing fallback policy and Workers AI budget evidence in provider-health outputs

This phase does not cover:
- Changing primary-provider preference away from NVIDIA
- Adding paid Workers AI expansion or broader Cloudflare usage
- Building a hosted dashboard or historical analytics surface
- Tuning long-window self-optimizing provider selection
</domain>

<decisions>
## Implementation Decisions

### Workers AI free-only enforcement
- **D-01:** Workers AI must remain `free-only` by default, with no silent path that can exceed run or daily caps.
- **D-02:** Run-scoped Workers AI usage evidence must survive checkpoint resume so resumable unattended runs cannot reset the run cap simply by restoring state.
- **D-03:** Telemetry snapshots must expose explicit Workers AI budget status and block reason, not just remaining counters.

### Fallback-provider policy
- **D-04:** Non-NVIDIA providers are treated as backups and must not silently join the live rotation by default.
- **D-05:** Backup activation requires an explicit routing policy plus a concrete activation reason such as `nvidia_unavailable` or `no_nvidia_configured`.
- **D-06:** Every backup activation attempt must be recorded in telemetry with provider, label, and reason so later reports can explain why the escape happened.

### Product posture
- **D-07:** NVIDIA remains the preferred healthy path whenever at least one eligible NVIDIA label exists.
- **D-08:** Cold-backup posture is the default operational contract; more permissive fallback routing must be an explicit policy choice, not an implicit side effect of configured API keys.
- **D-09:** Workers AI is also part of backup-policy control, but its free-only budget gate remains stricter than the general fallback policy.

### Reporting and machine readability
- **D-10:** Provider-health outputs should surface fallback policy, current backup eligibility, recent fallback activations, and Workers AI budget-state evidence in machine-readable form.
- **D-11:** Phase 32 should extend the Phase 31 contract rather than create a parallel report lane.

### the agent's Discretion
- Exact environment variable names for fallback policy controls
- Whether cold-backup policy is represented as `cold` / `guarded` / `always` or a close equivalent
- How many recent activation events to surface prominently in Markdown vs leaving only in JSON/event history
</decisions>

<specifics>
## Specific Ideas

- Current `AIService` still appends `siliconflow`, `openrouter`, and `cloudflare` into the provider list after NVIDIA without a separate routing-policy gate.
- `restoreTelemetrySnapshot()` restores provider health state, but not `workersAiCallsThisRun`, which weakens free-only run-cap enforcement after resume.
- The current provider-health report shows backup providers and Workers AI counts, but not why backups were allowed or why Workers AI is blocked when it is unavailable.
- The user preference for this project is conservative: multiple NVIDIA keys are primary, `siliconflow` and `openrouter` are backups, and Workers AI must stay strictly in the free range.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and milestone state
- `.planning/PROJECT.md` — v1.1 hardening posture
- `.planning/REQUIREMENTS.md` — `AIOPS-03` and `AIOPS-04` requirements
- `.planning/ROADMAP.md` — Phase 32 goal and success criteria
- `.planning/STATE.md` — current project state after Phase 31 completion
- `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-CONTEXT.md` — prior phase decisions for provider-health contract
- `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md` — shipped provider-health behavior and residual risks
- `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-VERIFICATION.md` — confirmed Phase 31 outputs and remaining gaps

### Runtime routing and telemetry
- `scripts/lib/ai.ts` — provider ordering, fallback behavior, Workers AI counters, and telemetry snapshot/restore logic
- `scripts/build-skills-cache.ts` — checkpoint resume path that restores telemetry during resumable runs
- `scripts/lib/ai-provider-health.ts` — current canonical provider-health report contract
- `scripts/ai-provider-health.ts` — current operator/CI health command
- `scripts/lib/ai.test.ts` — current runtime behavior coverage
- `scripts/lib/ai-provider-health.test.ts` — current provider-health contract coverage

### Current runtime evidence
- `reports/seo/latest-ai-provider-health.json` — latest machine-readable provider-health output after Phase 31
- `reports/seo/latest-ai-runtime-summary.json` — latest run-scoped checkpoint evidence
- `reports/seo/latest-ai-telemetry-trend.json` — current trend summary showing warning-only NVIDIA volatility
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/lib/ai.ts`: already contains the core hooks needed for provider gating, telemetry events, and Workers AI budget checks.
- `scripts/build-skills-cache.ts`: already persists AI telemetry into resumable checkpoint artifacts, so Phase 32 can attach stronger evidence to the same run artifacts.
- `scripts/lib/ai-provider-health.ts`: already merges snapshot and trend output, making it the right place to surface fallback-policy evidence.

### Established Patterns
- Routing policy is still largely implicit in provider list construction, not in an explicit policy layer.
- Workers AI already has free-only counters and limits, but resume durability and audit semantics are incomplete.
- Provider-health evidence is script-backed and artifact-backed, so new policy data should be exposed through the same contract.

### Integration Points
- `AIService.getAvailableProviders()` is the critical integration point for fallback-policy hardening.
- `AIService.restoreTelemetrySnapshot()` is the critical integration point for restoring Workers AI run evidence.
- `buildAiProviderHealthReport()` is the right place to expose new policy and activation evidence without creating another reporting lane.
</code_context>

<deferred>
## Deferred Ideas

- Persistent provider-routing dashboard
- Automatic escalation/todo creation when fallback activations exceed threshold
- Adaptive provider-routing policy based on long-window success rates
- Phase 33 planning-index automation work
</deferred>

---

*Phase: 32-workers-free-only-and-fallback-guards*
*Context gathered: 2026-04-06*
