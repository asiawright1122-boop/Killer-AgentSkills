---
status: passed
phase: 31-provider-telemetry-and-alerting
started: 2026-04-06
updated: 2026-04-06
requirements_completed:
  - AIOPS-01
  - AIOPS-02
---

## Phase Goal
Turn provider telemetry into one operator-visible health contract with explicit warning/blocking gate behavior for unattended runs.

## Verification Run

- ✓ Confirmed the new canonical command `npm run report:ai:health` produces one provider-health summary and one machine-readable JSON artifact.
- ✓ Confirmed the command refreshes companion telemetry-summary and telemetry-trend artifacts from the same invocation.
- ✓ Confirmed GitHub Actions now uses the shared provider-health command instead of inline alert summarization logic.
- ✓ Confirmed local unattended execution now evaluates provider health before KV sync in `scripts/run-pipeline.sh`.
- ✓ `npx vitest run scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-report.test.ts scripts/lib/ai-telemetry-trend.test.ts scripts/lib/ai.test.ts` passed (`19` tests).
- ✓ `npx tsc --noEmit --pretty false` passed.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=critical` passed on current repository telemetry and returned a non-blocking `soft warning` result.
- ✓ `npm run report:ai:health -- --limit=20 --fail-on=warning` failed intentionally with exit code `1`, confirming the shared gate blocks on the same real telemetry window when the threshold is tightened.

## Residual Risks

- Historical NVIDIA volatility is still present in the latest 20-sample window, but the newest snapshot is currently recovered and non-blocking at the `critical` threshold.
- Explicit fallback-activation reasons and Workers AI free-only audit evidence still belong to Phase `32`.

## Conclusion
Phase 31 objective is complete: provider health is now exposed through one reusable operator contract, and unattended batch/report flows consume the same explicit threshold gate.
