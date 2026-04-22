---
status: passed
phase: 39-workload-aware-provider-routing-and-budget-guards
started: 2026-04-07
updated: 2026-04-07
requirements_completed:
  - AIOPS-08
  - AIOPS-10
---

## Phase Goal
Let workload class influence provider ordering across runtime surfaces while preserving explicit fallback policy and Workers AI `free-only` guardrails.

## Verification Run

- ✓ Confirmed `src/lib/ai-provider-routing.ts` now parses workload profiles and applies workload-specific backup priority ordering inside the shared routing helper.
- ✓ Confirmed `scripts/lib/ai.ts` now carries a default `batch_generation` workload profile into runtime routing and telemetry snapshots.
- ✓ Confirmed `src/pages/api/skills/try.ts` now carries an `interactive_demo` workload profile into guarded fallback selection, cache entries, and API responses.
- ✓ Confirmed the shared routing snapshot now exposes `workloadProfile` and `backupPriorityOrder`, so operator-facing reports can explain which routing posture is active.
- ✓ Confirmed Workers AI gating remains explicit and workload-aware routing does not bypass the existing `free-only` budget / allowlist contract.
- ✓ Confirmed provider-health rendering now includes workload profile and backup priority order.
- ✓ `npx vitest run src/lib/ai-provider-routing.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts` passed (`26` tests).
- ✓ `npm run report:planning:traceability` passed.
- ✓ `npm run report:planning:milestones` passed.
- ✓ `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze` passed.

## Residual Risks

- The historical NVIDIA warning remains unresolved at the operator-report level; Phase 40 still needs to promote pressure history into richer routing evidence and guarded controls.
- Workload-aware routing currently differentiates backup-order posture and operator metadata, not a full workload-specific pressure model.
- External remediation issue / PR handoff remains future work for Phase 41.

## Conclusion
Phase 39 is verified complete: workload-aware routing is now shared across runtime surfaces, operator-visible, and still constrained by the existing fallback and Workers AI free-only contract.
