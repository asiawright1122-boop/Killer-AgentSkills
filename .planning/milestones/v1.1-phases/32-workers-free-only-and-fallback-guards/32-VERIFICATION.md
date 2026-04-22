---
status: passed
phase: 32-workers-free-only-and-fallback-guards
started: 2026-04-06
updated: 2026-04-06
requirements_completed:
  - AIOPS-03
  - AIOPS-04
---

## Phase Goal
Convert Workers AI free-only policy and backup-provider posture into enforced, auditable runtime guardrails.

## Verification Run

- ✓ Confirmed the shared AI runtime now exposes explicit fallback-policy state (`cold`, `guarded`, `always`) instead of silently appending backup providers into the live rotation.
- ✓ Confirmed `.env.local`-backed Workers AI limits are applied before runtime constants are derived, so configured free-tier ceilings are enforced instead of ignored.
- ✓ Confirmed default `cold` posture keeps `siliconflow`, `openrouter`, and `cloudflare` out of the active provider order while healthy NVIDIA capacity exists.
- ✓ Confirmed guarded fallback activates only when NVIDIA becomes unavailable and records a `fallback_activated` event with provider, reason, policy, and attempt metadata.
- ✓ Confirmed `src/pages/api/skills/try.ts` honors the same routing contract at the API layer: `cold` blocks backups, `guarded` enables them on NVIDIA absence/failure, and `always` still preserves NVIDIA as the primary path when it is healthy.
- ✓ Confirmed Workers AI free-only counters restore across checkpoint resume and surface explicit `status` / `blockedReason` evidence in telemetry snapshots.
- ✓ Confirmed provider-health and telemetry summary outputs render fallback policy, current backup eligibility, recent fallback activations, and Workers budget evidence.
- ✓ `npx vitest run scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-report.test.ts scripts/lib/ai-telemetry-trend.test.ts` passed (`22` tests).
- ✓ `npx vitest run src/pages/api/skills/try.test.ts src/lib/ai-fallback-policy.test.ts` passed (`7` tests).
- ✓ `npx tsc --noEmit --pretty false` passed.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=critical` passed and wrote refreshed Phase 32-compatible artifacts.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=warning` failed intentionally with exit code `1`, confirming the gate remains sensitive to the still-noisy historical NVIDIA window.
- ✓ `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze` passed.

## Residual Risks

- Historical NVIDIA instability is still present in the trend window, even though the latest snapshot is healthy and backup routing is now cold by default.
- Some secondary AI entry points still bypass the canonical runtime and should be consolidated before the overall AI calling architecture is considered fully uniform.

## Conclusion
Phase 32 objective is complete: Workers AI free-only evidence is now durable and auditable, backup-provider routing is explicit and conservative by default, and the shared operator reports explain both decisions clearly.
