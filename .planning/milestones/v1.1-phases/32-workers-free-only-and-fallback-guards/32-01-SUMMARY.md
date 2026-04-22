---
phase: 32-workers-free-only-and-fallback-guards
plan: 01
status: completed
updated: 2026-04-06
requirements_completed:
  - AIOPS-03
  - AIOPS-04
---

# Plan 32-01 Summary: Free-Only Workers and Explicit Fallback Routing

## Outcome

- Hardened `scripts/lib/ai.ts` so backup providers no longer enter rotation implicitly. The runtime now exposes an explicit fallback policy contract with `cold` as the default posture plus `guarded` and `always` overrides for deliberate activation.
- Moved environment loading ahead of runtime policy constant initialization, so `.env.local` values such as Workers AI free-tier limits and routing policy actually take effect at module load time instead of silently falling back to defaults.
- Added durable Workers AI free-only audit evidence: `callsThisRun` now survives checkpoint restore, daily counters are restored conservatively, and telemetry exposes `workersAi.status` plus `workersAi.blockedReason`.
- Added explicit fallback-routing telemetry: snapshots now expose `fallbackRouting.policy`, whether backups are currently allowed, the activation reason, the currently eligible backup providers, and recent fallback activations.
- Recorded backup activations as first-class telemetry events via `fallback_activated`, so later health reports can explain which non-NVIDIA provider was used and why.
- Updated provider-health and telemetry reports so operators can see fallback policy, backup eligibility, recent fallback activations, and Workers budget state in both Markdown and JSON outputs.
- Re-serialized `reports/seo/latest-ai-runtime-summary.json` through the new restore path so the latest canonical artifacts reflect Phase 32 policy instead of legacy implicit routing semantics.
- Follow-up architecture hardening aligned the remaining major non-canonical callers:
  - `scripts/build-docs-cache.ts` now routes through the shared `AIService`
  - `scripts/build-ssr-translations.ts` now routes through the shared `AIService`
  - `src/pages/api/skills/try.ts` now shares the same fallback-policy semantics through a pure helper module
- GitHub Actions and local unattended pipeline defaults now set `AI_FALLBACK_POLICY=guarded`, keeping NVIDIA primary while allowing `siliconflow` / `openrouter` to act as explicit backups when NVIDIA is unavailable.
- Added regression coverage for:
  - cold-backup default behavior when NVIDIA is healthy
  - guarded fallback activation when NVIDIA becomes unavailable
  - `src/pages/api/skills/try.ts` route-level fallback semantics across `cold`, `guarded`, and `always`, including the no-NVIDIA-configured guarded path and the "healthy NVIDIA stays primary" rule
  - Workers AI budget blocking and restore durability
  - provider-health and telemetry summary rendering of the new policy evidence

## Requirement Coverage

- `AIOPS-03`
  - Satisfied by restoring Workers AI run-level counters across checkpoint resume, exposing explicit budget status/block reason in telemetry, and surfacing the same evidence in health outputs.
- `AIOPS-04`
  - Satisfied by introducing explicit fallback-policy gating, keeping backups cold by default, and recording each backup activation with provider, reason, policy, and attempt metadata.

## Verification

- `npx vitest run scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-report.test.ts scripts/lib/ai-telemetry-trend.test.ts`
  - Passed (`22` tests).
- `npx vitest run src/pages/api/skills/try.test.ts src/lib/ai-fallback-policy.test.ts`
  - Passed (`7` tests).
- `npx tsc --noEmit --pretty false`
  - Passed.
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
  - Passed.
  - Refreshed `reports/seo/latest-ai-provider-health.{md,json}`, `reports/seo/latest-ai-telemetry-summary.md`, `reports/seo/latest-ai-telemetry-trend.{md,json}`.
  - Current real status remains `soft warning`, but it is non-blocking at the `critical` threshold.
- `npm run report:ai:health -- --limit=20 --fail-on=warning`
  - Failed intentionally with exit code `1`.
  - Confirmed the shared gate still blocks when the historical NVIDIA volatility window is evaluated at `warning`.
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
  - Passed.
  - Reflected Phase `32` as complete on disk and advanced the roadmap analyzer's `next_phase` output to `33`.

## Files Changed

- `scripts/lib/ai.ts`
- `scripts/lib/ai-provider-health.ts`
- `scripts/lib/ai-telemetry-report.ts`
- `scripts/lib/ai-telemetry-trend.ts`
- `scripts/lib/ai.test.ts`
- `scripts/lib/ai-provider-health.test.ts`
- `scripts/lib/ai-telemetry-report.test.ts`
- `scripts/lib/ai-telemetry-trend.test.ts`
- `reports/seo/latest-ai-runtime-summary.json`
- `reports/seo/latest-ai-provider-health.md`
- `reports/seo/latest-ai-provider-health.json`
- `reports/seo/latest-ai-telemetry-summary.md`
- `reports/seo/latest-ai-telemetry-trend.md`
- `reports/seo/latest-ai-telemetry-trend.json`

## Residual Risks

- The latest 20-sample telemetry window still shows historical NVIDIA volatility. The newest snapshot is healthy, but the warning debt remains real.
- `src/pages/api/skills/try.ts` now shares fallback-policy semantics, but it still cannot import the Node-side `AIService` directly because its runtime constraints differ from the script environment. Policy drift risk is much lower, but complete single-runtime convergence is still not total.
