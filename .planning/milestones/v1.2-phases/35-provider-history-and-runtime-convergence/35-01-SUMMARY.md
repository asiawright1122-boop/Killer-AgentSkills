---
phase: 35-provider-history-and-runtime-convergence
plan: 01
status: completed
updated: 2026-04-07
requirements_completed:
  - AIOPS-05
  - AIOPS-07
---

# Plan 35-01 Summary: Provider History and Runtime Convergence

## Outcome

- Added the shared runtime-safe routing helper `src/lib/ai-provider-routing.ts` so script-side AI execution and `src/pages/api/skills/try.ts` now consume one common ranking and fallback contract instead of maintaining parallel ordering logic.
- Kept NVIDIA as the primary path while preserving explicit fallback posture from `src/lib/ai-fallback-policy.ts`; the shared helper never bypasses `cold`, `guarded`, or `always`.
- Refactored `scripts/lib/ai.ts` to use the shared helper for NVIDIA key ordering, backup-provider ordering, and runtime-safe eligibility checks while preserving existing quarantine, cooldown, and Workers AI free-only guardrails.
- Refactored `src/pages/api/skills/try.ts` from provider-level cooldown state to label-level runtime state, so a noisy NVIDIA key can cool independently without dragging the whole NVIDIA pool back into the same 429 loop.
- Preserved guarded-route behavior by re-evaluating fallback eligibility after primary-path failures inside the same request, so `skills/try` keeps its expected failover semantics while still using the shared contract.
- Added routing regression coverage in:
  - `src/lib/ai-provider-routing.test.ts`
  - `src/pages/api/skills/try.test.ts`
- Extended provider-health outputs with operator guidance derived from longer-window trend data:
  - preferred NVIDIA labels and backup labels now render rank/history hints
  - Workers AI free-only mode now includes an explicit note that local call caps are conservative guardrails while Cloudflare billing is neuron-based
- Refreshed provider-health artifacts:
  - `reports/seo/latest-ai-provider-health.md`
  - `reports/seo/latest-ai-provider-health.json`
  - `reports/seo/latest-ai-telemetry-summary.md`
  - `reports/seo/latest-ai-telemetry-trend.md`
  - `reports/seo/latest-ai-telemetry-trend.json`

## Requirement Coverage

- `AIOPS-05`
  - Satisfied by the new shared routing helper plus provider-health operator guidance, which expose longer-window ranking signals without relaxing explicit fallback controls.
- `AIOPS-07`
  - Satisfied by wiring both `scripts/lib/ai.ts` and `src/pages/api/skills/try.ts` to the same routing contract, with label-level 429 regression coverage on the API path.

## Verification

- `npx vitest run src/lib/ai-provider-routing.test.ts src/lib/ai-fallback-policy.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-trend.test.ts`
  - Passed (`30` tests).
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
  - Passed.
  - Refreshed the latest provider-health and telemetry-trend artifacts.
  - Current real status remains `soft warning`, but it is non-blocking at the `critical` threshold.
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
  - Passed.

## Files Changed

- `src/lib/ai-provider-routing.ts`
- `src/lib/ai-provider-routing.test.ts`
- `scripts/lib/ai.ts`
- `src/pages/api/skills/try.ts`
- `src/pages/api/skills/try.test.ts`
- `scripts/lib/ai-provider-health.ts`
- `scripts/lib/ai-provider-health.test.ts`
- `reports/seo/latest-ai-provider-health.md`
- `reports/seo/latest-ai-provider-health.json`
- `reports/seo/latest-ai-telemetry-summary.md`
- `reports/seo/latest-ai-telemetry-trend.md`
- `reports/seo/latest-ai-telemetry-trend.json`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md`
- `.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-VERIFICATION.md`

## Residual Risks

- The recent 20-sample window still shows historical NVIDIA volatility, so routing is healthier and clearer but not yet fully quiet.
- Workers AI `free-only` is still enforced through local model allowlists and conservative run/day call caps, not true Cloudflare neuron metering.
- CI and scheduled automation still do not consume the new operator guidance; that is the next milestone step in Phase 36.

## Conclusion

Phase 35 objective is complete: provider history now feeds one shared runtime-safe routing contract, operator reports explain longer-window ranking directly, and the API/runtime 429 behavior no longer drifts by implementation surface.
