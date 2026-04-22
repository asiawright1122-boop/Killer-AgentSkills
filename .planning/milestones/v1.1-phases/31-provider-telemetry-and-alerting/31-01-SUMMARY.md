---
phase: 31-provider-telemetry-and-alerting
plan: 01
status: completed
updated: 2026-04-06
requirements_completed:
  - AIOPS-01
  - AIOPS-02
---

# Plan 31-01 Summary: Canonical Provider Health Contract

## Outcome

- Added a canonical operator command: `npm run report:ai:health`.
- Introduced the reusable provider-health contract in `scripts/lib/ai-provider-health.ts` plus the CLI wrapper `scripts/ai-provider-health.ts`.
- The new provider-health report now writes:
  - `reports/seo/latest-ai-provider-health.md`
  - `reports/seo/latest-ai-provider-health.json`
  - refreshed companion telemetry summary/trend artifacts for the same run
- GitHub Actions now consumes the shared provider-health command instead of duplicating alert summary logic inline in YAML.
- Local unattended execution in `scripts/run-pipeline.sh` now evaluates provider health before KV sync, so degraded provider state is surfaced explicitly instead of silently drifting through the pipeline.
- Added dedicated regression coverage for `clear`, `soft warning`, and `blocking` provider-health scenarios.

## Requirement Coverage

- `AIOPS-01`
  - Satisfied by the new canonical provider-health summary that shows provider availability order, quarantines, cooldowns, hard-disables, strongest NVIDIA labels, Workers AI free-tier state, and current alert severity in one place.
- `AIOPS-02`
  - Satisfied by the shared threshold-based gate contract (`--fail-on`) and its wiring into both GitHub Actions and local unattended pipeline flow.

## Verification

- `npx vitest run scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-report.test.ts scripts/lib/ai-telemetry-trend.test.ts scripts/lib/ai.test.ts`
  - Passed (`19` tests).
- `npx tsc --noEmit --pretty false`
  - Passed.
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
  - Passed.
  - Wrote provider-health, telemetry-summary, and trend artifacts.
  - Current real data evaluated as `soft warning`, not blocking at the `critical` threshold.
- `npm run report:ai:health -- --limit=20 --fail-on=warning`
  - Failed intentionally with exit code `1`.
  - Confirmed the same real telemetry window becomes blocking when the threshold is tightened to `warning`.

## Files Changed

- `package.json`
- `.github/workflows/data-pipeline.yml`
- `scripts/run-pipeline.sh`
- `scripts/ai-provider-health.ts`
- `scripts/lib/ai-provider-health.ts`
- `scripts/lib/ai-provider-health.test.ts`

## Residual Risks

- Current telemetry still shows historical NVIDIA volatility as a warning-only signal; this remains operational watchlist debt rather than a current blocking outage.
- Workers AI free-only policy enforcement and explicit backup-provider activation reasons still need Phase `32` hardening.
