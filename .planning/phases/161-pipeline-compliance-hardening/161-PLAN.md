# Phase 161: Pipeline & Compliance Hardening (PIPE-01)

**Status:** Complete
**Milestone:** v5.1 First Impression & Coverage Closure
**Requirement:** PIPE-01

## Goal

Wire structured-data-validate into daily SEO CI pipeline, add GSC API credential rotation alerting so credential failures surface as issues instead of being silently skipped, add automated detection for blocklisted URLs appearing in GSC crawl data, and upgrade 2+ compliance matrix lanes from `watch` → `pass`.

## Deliverables

### D1: Wire structured-data-validate into SEO monitoring CI

- Added "Validate P0 Structured Data" step to `.github/workflows/seo-monitoring.yml` after the URL Inspection sweep step
- Uses `if: always()` so it runs even when GSC credentials are missing (fetches production pages directly, no API needed)
- Added structured-data validation snapshot to Publish Job Summary (passed/failed counts, failed surface IDs)

### D2: Add GSC API credential rotation alerting

- Added `gsc_credential_missing` alert code (critical severity) to `scripts/gsc-search-health-monitor.ts`
- Added `credentialsPresent: boolean` parameter to `analyzeSearchHealth()`
- When `credentialsPresent === false`, emits critical alert: "GSC API Credentials Missing" with guidance to check GitHub Actions secrets
- CI workflow passes `CREDENTIALS_PRESENT: ${{ steps.gsc.outputs.configured }}` env var to downstream steps
- Traffic proof dashboard reads `CREDENTIALS_PRESENT` from environment

### D3: Add blocklisted-URL-in-GSC proactive detection

- Added `gsc_blocklisted_urls_in_index` (critical, >50) and `gsc_blocklisted_urls_warning` (warning, >10) alert codes
- Added `blocklistedInGscCount: number` parameter to `analyzeSearchHealth()`
- Health monitor CLI counts blocklisted URLs from GSC opportunity board JSON (canonicalization lane, "blocklisted" in actions)
- Traffic proof dashboard includes `blocklistedUrlSummary` section with count and status

### D4: Upgrade compliance matrix lanes

- **`structured-data-validity` lane**: Now reads `reports/seo/latest-structured-data-validation.json`. Verdict `pass` when report exists and `failed === 0`; `watch` when report exists but has failures; fallback to current logic when no report. Added validation report as primary evidence entry.
- **`ctr-search-appearance` lane**: Now reads `reports/seo/latest-gsc-opportunity-board.json`. Verdict `pass` when traffic is clear+live-api AND no P0/P1 opportunities exist; `watch` when traffic is clear but opportunities exist; `block` when no live data. Added opportunity board as secondary evidence entry.
- Two lanes can now reach `pass` — achieving the 2+ lane upgrade target.

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/seo-monitoring.yml` | Added structured-data-validate step + job summary snapshot + CREDENTIALS_PRESENT env |
| `scripts/gsc-search-health-monitor.ts` | Added 3 alert codes + 2 params + opportunity board reading in CLI |
| `scripts/lib/gsc-search-health-monitor.test.ts` | Added 5 new tests (credential + blocklisted) |
| `scripts/lib/search-compliance-matrix.ts` | Added 2 input types + enhanced 2 lanes (structured-data-validity, ctr-search-appearance) |
| `scripts/lib/search-compliance-matrix.test.ts` | Added 5 new tests (structured-data + CTR lanes) |
| `scripts/seo-traffic-proof-dashboard.ts` | Added credentialsPresent + blocklistedUrlSummary |

## Test Results

- 45 tests pass across modified test files (16 health monitor, 12 compliance matrix, 17 structured-data validate)
- 1154 tests pass globally (6 pre-existing failures unchanged)

## Success Criteria

- [x] Structured data validation runs daily in CI
- [x] GSC API credential rotation creates an alert (not silently skipped)
- [x] Blocklisted URLs detected proactively in GSC crawl data
- [x] 2+ compliance matrix lanes can reach `pass` (structured-data-validity + ctr-search-appearance)
