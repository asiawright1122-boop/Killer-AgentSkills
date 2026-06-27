# Phase 158: Coverage Freshness Automation & Demand Measurement (FRESH-01)

**Requirement:** FRESH-01 — automate GSC data freshness so coverage source age stays ≤7 days without manual CSV export, close REC-24 (unresolved since April v1.7).

## Deliverables

### Task 1: Extend URL Inspection Coverage Sweep for P0 URLs ✅

**File:** `scripts/seo-url-inspection-coverage-sweep.ts`

- Added `--tier1` flag: P0_SURFACE_PATHS × 10 locales (80 URLs)
- Added `--p0-only` flag: 8 English P0 surface URLs (fast ~4s sweep, ideal for daily CI)
- Added `--urls <json-path>` flag for arbitrary URL input
- Added `P0_SURFACE_PATHS` and `SUPPORTED_LOCALES` constants (aligned with IndexNow script)
- Added `sourceMode` and `sourceDescription` fields to `CoverageSweepReport`
- Exported `buildTier1Urls()`, `buildP0OnlyUrls()`, `sampleByCluster()` for testability

### Task 2: Refactor Compliance Matrix to Accept Inspection Sweep Evidence ✅

**File:** `scripts/lib/search-compliance-matrix.ts`

- Added `DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH` constant
- Added `UrlInspectionSweepJson` type
- Added `urlInspectionSweep` to `SearchComplianceInputs` and `urlInspectionSweepJsonPath` to `SearchComplianceFileOptions`
- Added `computeSweepFreshness()` helper (checks `ageDays ≤ 7 AND sampled ≥ 10`)
- Updated `coverage-freshness-before-claims` lane:
  - Verdict `pass` if drilldown fresh **or** sweep fresh (was previously `watch` even for fresh drilldown)
  - Verdict `block` if both sources are stale/missing
  - Evidence now includes both drilldown and sweep sources
  - Rationale indicates which source confirmed freshness
  - NextAction points to `npm run report:seo:coverage-sweep:p0`

### Task 3: Update Search Health Monitor with Sweep-Aware Freshness Alerts ✅

**File:** `scripts/gsc-search-health-monitor.ts`

- Added `gsc_freshness_sla_inspection_sweep_stale` alert code
- When sweep ≤7 days old → suppress drilldown staleness alerts
- When sweep >7 days old → emit sweep stale warning
- When neither source fresh → escalate drilldown to critical breach
- Added `sweepData` parameter to `analyzeSearchHealth()`
- Updated `SearchHealthAnalysisResult.metrics` with `sweepAgeDays` and `sweepFresh`
- CLI main now loads URL Inspection sweep JSON alongside CTR and coverage data
- Updated markdown render to show sweep age and freshness

**File:** `scripts/lib/gsc-search-health-monitor.test.ts`
- 7 new tests for sweep-aware freshness logic

### Task 4: Build Traffic Proof Dashboard ✅

**File:** `scripts/seo-traffic-proof-dashboard.ts` (new)

Combines GSC CTR data + URL inspection sweep + compliance matrix into a single weekly view:
- Freshness SLA Status (drilldown vs sweep → combined)
- P0 Surface Health (verdict, coverage state, last crawled per URL)
- GSC Traffic Summary (queries, pages, opportunities)
- Compliance Status (verdict, headline, counts)
- Trend Snapshot (coverage affected pages, sweep pass rate)

Output: `reports/seo/latest-traffic-proof.{json,md}`

### Task 5: Extend D1 Schema + Ingest Script ✅

**File:** `db/schema.sql`
- Added `gsc_url_inspection` table (url, verdict, coverage_state, indexing_state, last_crawl_time, page_fetch_state, google_canonical, robots_txt_state, cluster, inspected_at, ingested_at)
- Added indexes on `verdict` and `cluster`

**File:** `scripts/ingest-url-inspection-results.ts` (new)
- Reads sweep JSON, upserts records into D1
- Supports `--remote` and `--input <path>` flags
- Validates 7-day freshness SLA

### Task 6: Wire Sweep into CI Workflow ✅

**File:** `.github/workflows/seo-monitoring.yml`
- Added "Run URL Inspection Coverage Sweep" step (after GSC fetch, conditional on GSC credentials)
- Added "Build Traffic Proof Dashboard" step (after sitemap blocklist, always runs)

### Task 7: npm Scripts ✅

**File:** `package.json`
- `report:seo:coverage-sweep:p0` → `--p0-only`
- `report:seo:coverage-sweep:tier1` → `--tier1`
- `report:seo:traffic-proof` → traffic proof dashboard
- `ingest:url-inspection` → D1 ingest with `--remote`

## Success Criteria

1. ✅ Coverage source age ≤7 days automatically via CI URL Inspection sweep (no manual CSV needed)
2. ✅ `coverage-freshness-before-claims` compliance lane reads both drilldown export AND inspection sweep, moves to `pass` when sweep is fresh
3. ✅ Freshness alert suppresses drilldown staleness when sweep confirms coverage
4. ✅ Traffic proof dashboard generated from combined data sources
5. ✅ 0 regressions (1144 tests pass, 6 pre-existing failures unchanged)
