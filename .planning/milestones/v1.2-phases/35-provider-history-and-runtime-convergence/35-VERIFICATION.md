---
status: passed
phase: 35-provider-history-and-runtime-convergence
started: 2026-04-07
updated: 2026-04-07
requirements_completed:
  - AIOPS-05
  - AIOPS-07
---

## Phase Goal
Turn short-window provider telemetry into longer-window routing intelligence and eliminate remaining fallback-policy drift between script and API runtime surfaces.

## Verification Run

- ✓ Confirmed both `scripts/lib/ai.ts` and `src/pages/api/skills/try.ts` now depend on one shared routing helper in `src/lib/ai-provider-routing.ts`.
- ✓ Confirmed the shared helper preserves NVIDIA-primary behavior and explicit `cold` / `guarded` / `always` fallback semantics instead of silently widening the active rotation.
- ✓ Confirmed `src/pages/api/skills/try.ts` now keeps label-level runtime state, so a single 429-heavy NVIDIA key cools independently and the next request prefers the healthier sibling key.
- ✓ Confirmed guarded failover still works on the route path after primary failures by re-evaluating fallback eligibility under the shared contract.
- ✓ Confirmed provider-health Markdown + JSON outputs now expose operator guidance from longer-window trend history, not just the latest snapshot order.
- ✓ Confirmed Workers AI free-only reporting now explicitly states that local caps are conservative guardrails while Cloudflare pricing is neuron-based.
- ✓ `npx vitest run src/lib/ai-provider-routing.test.ts src/lib/ai-fallback-policy.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-trend.test.ts` passed (`30` tests).
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=critical` passed and refreshed the current provider-health artifacts.
- ✓ `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze` passed.

## Residual Risks

- Historical NVIDIA instability is still visible in the analyzed telemetry window, even though the latest routing snapshot is healthy.
- Workers AI free-tier protection remains conservative rather than billing-precise because the runtime does not currently track Cloudflare neuron consumption directly.
- The new operator guidance remains local/operator-facing until Phase 36 wires it into CI and scheduled monitoring.

## Conclusion
Phase 35 is verified complete: longer-window routing intelligence is now shared across runtime surfaces without weakening fallback governance or Workers AI free-only posture.
