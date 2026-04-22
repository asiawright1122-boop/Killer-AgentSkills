---
phase: 40-rate-pressure-evidence-and-operator-controls
plan: 01
status: completed
updated: 2026-04-07
requirements_completed:
  - AIOPS-09
---

# Plan 40-01 Summary: Rate-pressure Evidence and Operator Controls

## Outcome

- Extended the shared routing contract in `src/lib/ai-provider-routing.ts` so label health now carries recent pressure memory alongside instantaneous state:
  - `recent429Count`
  - `recentCooldownCount`
  - `recentRetryableFailureCount`
  - `lastPressureAt`
  - pressure-score-based routing evidence
- Updated shared routing pressure output so `decisionReason` and `pressureLabels` now explain both current and recent pressure instead of only current cooldown / quarantine state.
- Updated `scripts/lib/ai.ts` so the canonical script runtime:
  - tracks recent pressure memory per label
  - decays pressure gradually on success instead of forgetting it immediately
  - restores legacy checkpoints by rebuilding pressure memory from `recentEvents` when old snapshots do not yet carry the new fields
  - emits the richer pressure evidence in telemetry snapshots
- Updated `src/pages/api/skills/try.ts` so the live demo runtime now mirrors the same pressure-memory contract and returns a compact `routing` block with policy, decision, activation reason, and label-level pressure evidence.
- Updated `scripts/lib/ai-provider-health.ts` so provider-health artifacts now surface:
  - routing decision
  - routing reason
  - rate-pressure evidence by label/provider
  - operator control guidance
  - historical watch labels
  - explicit Workers AI `free-only` guardrail language
- Added compatibility backfill for legacy health artifacts so older checkpoints without Phase 40 routing fields still render safely instead of crashing.
- Added a lightweight runtime probe script so operators can trigger a real AI call and refresh the canonical runtime telemetry snapshot without rerunning the entire cache pipeline.
- Added regression coverage across:
  - shared routing pressure behavior
  - script-runtime telemetry snapshots
  - `skills/try` routing metadata
  - provider-health rendering and normalization

## Requirement Coverage

- `AIOPS-09`
  - Satisfied by turning recent 429 / cooldown pressure into shared routing evidence, exposing the same reasoning in both runtime surfaces, and rendering operator-facing label/provider evidence in health artifacts without widening backup or Workers AI behavior.

## Verification

- `npx vitest run src/lib/ai-provider-routing.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts`
  - Passed (`27` tests).
- `npx tsc --noEmit --pretty false`
  - Passed.
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
  - Passed.
  - Refreshed `reports/seo/latest-ai-provider-health.{md,json}`, `latest-ai-telemetry-summary.md`, and `latest-ai-telemetry-trend.{md,json}`.
  - Current real repository signal remains `soft warning`, but the new report now surfaces routing decision, operator controls, and historical watch labels directly.
- `npm run probe:ai:runtime`
  - Passed.
  - Issued a real NVIDIA-backed probe call and refreshed `reports/seo/latest-ai-runtime-summary.{json,md}` plus `reports/seo/phase-40-runtime-probe.json`.
  - Confirmed the newest canonical runtime sample now carries native Phase 40 fields including `fallbackRouting.decision`, `fallbackRouting.decisionReason`, `fallbackRouting.pressureLabels`, and label-level recent pressure counters.
- `npm run report:ai:health -- --limit=20 --fail-on=warning`
  - Failed intentionally with exit code `1`.
  - Confirmed the shared gate still blocks when the same historical NVIDIA volatility window is evaluated at the warning threshold.
- `npm run report:planning:traceability`
  - Passed before closeout update; showed `AIOPS-09` as the only remaining active AI-ops gap.
- `npm run report:planning:milestones`
  - Passed and refreshed the active milestone support artifacts.
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
  - Passed.
  - Confirmed Phase `40` is the next phase to close on disk and Phase `41` is the next logical milestone step after summary/verification artifacts land.

## Files Changed

- `src/lib/ai-provider-routing.ts`
- `src/pages/api/skills/try.ts`
- `scripts/lib/ai.ts`
- `scripts/lib/ai-provider-health.ts`
- `src/pages/api/skills/try.test.ts`
- `scripts/lib/ai.test.ts`
- `scripts/lib/ai-provider-health.test.ts`
- `reports/seo/latest-ai-provider-health.md`
- `reports/seo/latest-ai-provider-health.json`
- `reports/seo/latest-ai-runtime-summary.md`
- `reports/seo/latest-ai-telemetry-summary.md`
- `reports/seo/latest-ai-telemetry-trend.md`
- `reports/seo/latest-ai-telemetry-trend.json`
- `reports/seo/phase-40-runtime-probe.json`
- `scripts/ai-runtime-probe.ts`
- `package.json`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md`
- `.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-VERIFICATION.md`

## Residual Risks

- Historical NVIDIA volatility remains a real trailing-window warning even though the latest snapshot is currently healthy and now recorded in native Phase 40 format.
- The runtime probe proves the canonical snapshot path is current, but it is still a targeted operator probe rather than a full-cache batch refresh.
- External remediation issue / PR handoff and phase lifecycle automation are still future work for Phases `41` and `42`.

## Conclusion

Phase 40 objective is complete: provider-pressure history now survives as shared routing evidence, `AIService` and `skills/try` stay aligned on guarded recovery reasoning, operator-facing health artifacts explain both the current routing posture and the label/provider history behind it, and the canonical runtime snapshot now persists the native Phase 40 telemetry contract.
