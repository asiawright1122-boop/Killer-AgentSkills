---
status: passed
phase: 40-rate-pressure-evidence-and-operator-controls
started: 2026-04-07
updated: 2026-04-07
requirements_completed:
  - AIOPS-09
---

## Phase Goal
Turn 429-heavy provider pressure into shared routing evidence and operator-visible controls instead of leaving it as a passive warning-only artifact.

## Verification Run

- ✓ Confirmed `src/lib/ai-provider-routing.ts` now carries recent pressure memory and emits richer `pressureLabels`, pressure scores, and routing reasons.
- ✓ Confirmed `scripts/lib/ai.ts` now persists recent pressure memory per label, rebuilds that memory from legacy `recentEvents` when needed, and surfaces the richer routing evidence in telemetry snapshots.
- ✓ Confirmed `src/pages/api/skills/try.ts` now mirrors the same pressure-memory model and returns routing metadata with live AI responses.
- ✓ Confirmed `scripts/lib/ai-provider-health.ts` now renders routing decision, routing reason, active rate-pressure labels, operator controls, and historical watch labels, while safely normalizing legacy snapshots that predate Phase 40 fields.
- ✓ Confirmed `scripts/ai-runtime-probe.ts` can issue a real AI probe and refresh the canonical runtime summary with native Phase 40 routing fields.
- ✓ Confirmed Workers AI remains explicitly constrained to the existing `free-only` guardrail throughout the new operator-control guidance and routing evidence.
- ✓ `npx vitest run src/lib/ai-provider-routing.test.ts src/pages/api/skills/try.test.ts scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts` passed (`27` tests).
- ✓ `npx tsc --noEmit --pretty false` passed.
- ✓ `npm run probe:ai:runtime` passed and refreshed `reports/seo/latest-ai-runtime-summary.{json,md}` plus `reports/seo/phase-40-runtime-probe.json` from a live NVIDIA-backed probe call.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=critical` passed and wrote refreshed provider-health + trend artifacts with the new operator sections.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=warning` failed intentionally with exit code `1`, confirming the tighter threshold still blocks on the same historical NVIDIA warning window.
- ✓ `npm run report:planning:traceability` passed.
- ✓ `npm run report:planning:milestones` passed.
- ✓ `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze` passed.

## Residual Risks

- The trailing repository telemetry window still reflects historical NVIDIA volatility even though the most recent snapshot is healthy.
- The latest runtime artifact on disk is now native Phase 40 format, but the trailing warning window still needs future remediation automation rather than more backfill work.
- Remediation handoff automation and phase archive lifecycle automation remain future milestone work.

## Conclusion

Phase 40 is verified complete: noisy provider pressure now influences shared routing evidence, runtime surfaces remain aligned on guarded recovery behavior, operators can see label/provider-level reasons before changing provider posture, and the canonical runtime snapshot path now records the native Phase 40 telemetry contract.
