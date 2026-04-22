---
phase: 39-workload-aware-provider-routing-and-budget-guards
plan: 01
status: completed
updated: 2026-04-07
requirements_completed:
  - AIOPS-08
  - AIOPS-10
---

# Plan 39-01 Summary: Workload-aware Provider Routing and Budget Guards

## Outcome

- Extended the shared routing helper in `src/lib/ai-provider-routing.ts` with explicit workload profiles, safe parsing, and workload-specific backup priority order.
- Added operator-visible routing metadata so the shared fallback snapshot now records:
  - workload profile
  - backup priority order
  - the existing explicit fallback activation state
- Threaded workload-aware routing through `scripts/lib/ai.ts`:
  - `AIService` now accepts and persists a workload profile
  - the default script/runtime posture is `batch_generation`
  - telemetry snapshots now expose the active workload profile and backup priority order
- Threaded workload-aware routing through `src/pages/api/skills/try.ts`:
  - `skills/try` now uses the `interactive_demo` workload by default
  - route responses and cache entries now include `workloadProfile`
  - guarded fallback ordering can now differ by workload without branching the routing contract
- Preserved the Workers AI `free-only` contract while adding workload awareness:
  - Workers AI availability and blocked reasons still gate Cloudflare usage
  - no workload profile can silently widen paid Workers usage
  - the existing explicit backup-provider posture remains intact
- Extended provider-health rendering so operator-facing Markdown now explains the active routing workload and backup priority order.
- Added regression coverage in:
  - `src/lib/ai-provider-routing.test.ts`
  - `src/pages/api/skills/try.test.ts`
  - `scripts/lib/ai.test.ts`
  - `scripts/lib/ai-provider-health.test.ts`

## Requirement Coverage

- `AIOPS-08`
  - Satisfied by adding a shared workload-profile input to provider routing, then wiring it into both `AIService` and `skills/try`.
- `AIOPS-10`
  - Satisfied by preserving Workers AI `free-only` gating and blocked-reason reporting under the new workload-aware routing contract.

## Verification

- `npx vitest run src/lib/ai-provider-routing.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts`
  - Passed (`26` tests).
- `npm run report:planning:traceability`
  - Passed after marking `AIOPS-08` and `AIOPS-10` complete for Phase 39.
- `npm run report:planning:milestones`
  - Passed and refreshed the active `v1.3` milestone index plus bootstrap / closeout support artifacts.
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
  - Passed and now recognizes Phase `39` as planned/completed-documentation groundwork for the active `v1.3` milestone.

## Files Changed

- `src/lib/ai-provider-routing.ts`
- `src/lib/ai-provider-routing.test.ts`
- `scripts/lib/ai.ts`
- `scripts/lib/ai.test.ts`
- `scripts/lib/ai-provider-health.ts`
- `scripts/lib/ai-provider-health.test.ts`
- `src/pages/api/skills/try.ts`
- `src/pages/api/skills/try.test.ts`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-CONTEXT.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-PLAN.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md`
- `.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-VERIFICATION.md`

## Residual Risks

- Historical NVIDIA volatility is still present in the trailing operator window; Phase 39 only makes workload intent explicit, it does not yet promote that pressure into richer routing evidence or guarded recovery controls.
- The current `v1.3` milestone still lacks external remediation issue / PR handoff and phase archive lifecycle automation.
- `skills/try` now returns `workloadProfile`, but the broader operator lane still needs Phase 40 to make provider-pressure reasoning more visible at label/provider level.

## Conclusion

Phase 39 objective is complete: workload intent now exists in the shared provider-routing contract, `AIService` and `skills/try` stay aligned on that contract, and Workers AI remains explicitly constrained to the free-only envelope.
