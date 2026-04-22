# Phase 31: provider-telemetry-and-alerting - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Auto-generated context from v1.1 requirements, existing telemetry code, and current pipeline usage

<domain>
## Phase Boundary

This phase turns existing AI provider telemetry into one canonical operator health lane that can both explain the current provider state and explicitly gate unattended runs.

The phase covers:
- One operator-facing provider health summary that combines latest snapshot state with recent trend severity
- One machine-readable provider health contract that downstream scripts and CI can consume
- Explicit warning vs blocking gate behavior driven by configured severity thresholds
- Wiring the health contract into unattended batch/report flows so provider instability is never silent

This phase does not cover:
- Changing provider selection policy beyond surfacing current order and state
- Expanding Workers AI policy beyond the existing free-only guardrails already implemented in runtime code
- Broad provider failover redesign or self-tuning selection logic
- Dashboard/UI work outside script, report, and workflow surfaces
</domain>

<decisions>
## Implementation Decisions

### Operator health contract
- **D-01:** Introduce one canonical `provider health` report that merges the latest telemetry snapshot with the recent trend window instead of asking operators to cross-read separate artifacts.
- **D-02:** The canonical report must always expose current provider order, cooldowns, quarantines, hard-disables, strongest NVIDIA labels, Workers AI free-tier state, and current alert severity in one place.
- **D-03:** The canonical report must emit both Markdown for humans and JSON for automation from the same underlying data model.

### Gate semantics
- **D-04:** Severity vocabulary remains `clear`, `soft warning`, and `blocking`, derived from the existing warning/critical alert model rather than inventing a second scale.
- **D-05:** Exit-code gating is threshold-driven via an explicit `fail-on` severity contract so unattended runs can block at `critical` by default and optionally tighten to `warning` when desired.
- **D-06:** Batch/report flows must surface whether the run is blocking at the chosen threshold; silent degraded success is not acceptable.

### Provider posture visibility
- **D-07:** The report must make fallback-provider ordering visible even when NVIDIA has recovered so operators can detect drift without reading raw checkpoint JSON.
- **D-08:** Historical NVIDIA volatility should remain warning-only unless the latest snapshot or thresholded alerts justify a blocking state.
- **D-09:** Workers AI usage remains part of the same health contract so free-only budget pressure is visible next to provider availability, not in a separate lane.

### Rollout scope
- **D-10:** Reuse existing telemetry snapshot/trend logic where possible; Phase 31 is a consolidation and contract-hardening phase, not a telemetry rewrite.
- **D-11:** Local unattended scripts and GitHub Actions should consume the same health command/output shape to reduce behavior drift.
- **D-12:** Replace ad-hoc inline workflow summarization with reusable script output where practical.

### the agent's Discretion
- Exact report section naming and JSON field nesting
- Whether the canonical report also regenerates companion trend artifacts or only consumes them
- How much detail from the trend window is repeated in Markdown vs linked through nested JSON
</decisions>

<specifics>
## Specific Ideas

- Current telemetry already shows a real soft-warning case: the latest 20-sample window reports historical NVIDIA volatility while the latest snapshot has recovered provider availability.
- The existing GitHub workflow already gates on `report:ai:trend --fail-on=critical`, but the operator summary logic is still partially duplicated inline in YAML.
- The local `scripts/run-pipeline.sh` path currently builds and syncs without an explicit AI health gate; Phase 31 should close that gap.
- Backup providers should remain visible in the health summary even when they are cold backups so any silent ordering drift is obvious.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and milestone state
- `.planning/PROJECT.md` — v1.1 milestone intent and hardening posture
- `.planning/REQUIREMENTS.md` — `AIOPS-01` and `AIOPS-02` acceptance criteria
- `.planning/ROADMAP.md` — Phase 31 goal and success criteria
- `.planning/STATE.md` — current project state for milestone `v1.1`
- `.planning/v1.0-MILESTONE-AUDIT.md` — evidence that provider observability is the next meaningful hardening lane

### Existing telemetry foundation
- `scripts/lib/ai.ts` — provider ordering, cooldown/quarantine/hard-disable state, Workers AI free-only counters, and telemetry snapshot API
- `scripts/lib/ai-telemetry-report.ts` — current latest-snapshot Markdown rendering
- `scripts/lib/ai-telemetry-trend.ts` — alert derivation, severity summary, and trend-window reporting
- `scripts/ai-telemetry-report.ts` — current CLI for snapshot summary generation
- `scripts/ai-telemetry-trend.ts` — current CLI for trend reports and fail-on exit gating
- `scripts/lib/ai.test.ts` — provider telemetry/runtime behavior coverage
- `scripts/lib/ai-telemetry-report.test.ts` — snapshot reporting coverage
- `scripts/lib/ai-telemetry-trend.test.ts` — alert summary and gate coverage

### Current batch and workflow integration
- `scripts/build-skills-cache.ts` — runtime checkpoint persistence and latest AI runtime summary generation
- `.github/workflows/data-pipeline.yml` — current CI AI trend gate and inline step-summary logic
- `scripts/run-pipeline.sh` — local unattended pipeline path currently missing explicit AI health gating
- `package.json` — canonical script surface for operator/report commands

### Runtime evidence
- `reports/seo/latest-ai-runtime-summary.json` — latest snapshot with provider order and Workers AI state
- `reports/seo/latest-ai-telemetry-trend.json` — latest trend-window alert summary (`soft warning` at present)
- `reports/seo/latest-ai-telemetry-trend.md` — operator-facing evidence of the current NVIDIA volatility warning
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/lib/ai.ts`: already emits a rich snapshot including provider availability order, quarantines, cooldowns, hard-disables, and Workers AI free-tier budget state.
- `scripts/lib/ai-telemetry-report.ts`: already formats latest-checkpoint provider state into a readable operator summary.
- `scripts/lib/ai-telemetry-trend.ts`: already computes alert codes, severities, summaries, and threshold filtering suitable for gating.
- `scripts/build-skills-cache.ts`: already persists runtime checkpoint JSON/Markdown during runs, so new health reporting can build on existing artifacts instead of instrumenting runtime again.

### Established Patterns
- AI operations in this repo are script-first, artifact-backed, and designed for unattended runs.
- Provider behavior is intentionally conservative: NVIDIA first, backups cold, Workers AI budgeted.
- Current gate semantics already exist in trend reporting, but the contract is spread across scripts and YAML instead of one reusable output.

### Integration Points
- The new health contract should sit above latest-checkpoint + trend derivation rather than inside `AIService`.
- `package.json` should expose the canonical operator command.
- Both `.github/workflows/data-pipeline.yml` and `scripts/run-pipeline.sh` should consume the same command/threshold model.
</code_context>

<deferred>
## Deferred Ideas

- Persistent dashboard or hosted review surface for provider health history
- Self-tuning provider order based on long-window success rates
- Automatic issue/todo creation when provider health crosses thresholds
- Phase 32 policy changes for stricter fallback activation and Workers AI audit evidence
</deferred>

---

*Phase: 31-provider-telemetry-and-alerting*
*Context gathered: 2026-04-06*
