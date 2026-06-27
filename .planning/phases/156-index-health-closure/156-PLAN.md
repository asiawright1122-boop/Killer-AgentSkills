# Plan: Index Health Closure

This phase closes IND-01 by verifying the REMOV-01 removal batch impact, building post-submission verification automation with before/after delta reporting, and generating a second-pass removal batch for the top 3 remaining high-priority clusters. Target: reduce coverage anomalies from 10,783 to <2,000.

- **Wave:** 1
- **Depends on:** Phase 155 (GSC Removal Batch Submission & Index Verification — automation delivered, operator submission pending)
- **Requirements:** IND-01
- **Autonomous:** full — operator action for REMOV-01 submission is tracked externally (GitHub issue #19); this phase is fully automatable once the batch is marked submitted

## Context

- Phase 155 delivered the GSC removal tracker automation (`scripts/seo-gsc-removal-tracker.ts`) and staged the 975-URL removal batch at `reports/seo/latest-gsc-removal-batch.{csv,json,md}`.
- The operator must manually submit these 975 URLs via the GSC URL Removal tool (no API available). Progress is tracked via `npm run report:seo:gsc-removal-tracker -- mark`.
- Coverage Drilldown (2026-06-03) shows **10,783 affected pages** in a single "未找到 (404)" issue bucket.
- Top clusters by weighted impact:
  1. **known_skill_404** — 5,499 estimated affected (510 samples) — *already blocklisted, expected 404s*
  2. **source_file_path** — 4,011 estimated affected (372 samples) — *partially covered by REMOV-01 source_file cluster (301 URLs)*
  3. **trailing_slash** — 971 estimated affected (90 samples) — *partially covered by REMOV-01 trailing_slash cluster (192 URLs)*
  3. **query_parameter** — 129 estimated affected (12 samples) — *partially covered by REMOV-01 query_param cluster (12 URLs)*
  4. **repeated_segment** — 86 estimated affected (8 samples)
  5. **deep_skill_path** — 43 estimated affected (4 samples)
  6. **other** — 43 estimated affected (4 samples)

## Phase Scope

1. **Post-submission verification automation** — after the operator marks all 975 URLs as submitted, run a URL Inspection coverage sweep against the batch URLs, emit a before/after delta report, and update the removal tracker dashboard.
2. **Cross-reference analysis** — map the REMOV-01 batch clusters against the coverage drilldown clusters to quantify how much of each cluster the first batch addresses.
3. **Second-pass removal batch builder** — analyze the residual coverage anomalies (after REMOV-01 impact), select the top 3 highest-impact remaining clusters, and generate a v2 removal batch (`latest-gsc-removal-batch-v2.{csv,json,md}`).
4. **Coverage anomaly reduction estimate** — document the projected anomaly count after batch 1 + batch 2, confirming the <2,000 target is credible.

## Automation Delivered (this phase)

1. **`scripts/seo-gsc-removal-verification.ts`** — post-submission verification:
   - `verify --batch <batch-file>` — runs URL Inspection on submitted URLs, emits `reports/seo/latest-gsc-removal-verification.json|md` with per-URL status (removed/pending/failed) and cluster-level summary.
   - `delta --before <before-sweep> --after <after-sweep>` — compares two coverage sweeps, emits `reports/seo/latest-coverage-delta-report.md` with anomaly count delta per cluster.

2. **`scripts/seo-gsc-removal-batch-v2.ts`** — second-pass batch builder:
   - Reads latest coverage drilldown + 404 remediation plan.
   - Excludes URLs already in REMOV-01 batch.
   - Selects top 3 residual clusters by weighted impact.
   - Outputs `reports/seo/latest-gsc-removal-batch-v2.{csv,json,md}` with cluster breakdown, sample URLs, and operator runbook appendix.

3. **`npm run report:seo:gsc-removal-verification`** and **`npm run report:seo:gsc-removal-batch-v2`** scripts wired in `package.json`.

4. **Updated runbook appendix** — `docs/superpowers/runbooks/gsc-url-removal-runbook.md` extended with Phase 156 verification + second-pass steps.

## Tasks

### Task 1: Wait for REMOV-01 operator submission confirmation

<acceptance_criteria>
- Operator has marked all 975 URLs as submitted via `npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --count <N>` (tracked via GitHub issue #19).
- Tracker dashboard (`reports/seo/latest-gsc-removal-tracker.md`) shows 975/975 submitted (100%).
- 24–48 hours have elapsed since final submission to allow GSC processing.
</acceptance_criteria>

### Task 2: Build post-submission verification automation

<acceptance_criteria>
- `scripts/seo-gsc-removal-verification.ts` exists with `verify` and `delta` commands.
- `verify` command:
  - Reads batch URLs from `reports/seo/latest-gsc-removal-batch.json` (or v2 equivalent).
  - Calls URL Inspection API (via existing `scripts/seo-url-inspection-coverage-sweep.ts` patterns) for each URL.
  - Emits `reports/seo/latest-gsc-removal-verification.json` with per-URL status: `removed` | `pending` | `failed` | `not_found_in_index`.
  - Emits `reports/seo/latest-gsc-removal-verification.md` cluster-level summary table.
- `delta` command:
  - Accepts two coverage sweep JSON files (before/after).
  - Computes anomaly count delta per cluster.
  - Emits `reports/seo/latest-coverage-delta-report.md` with before/after table and net change.
- `npm run report:seo:gsc-removal-verification` and `npm run report:seo:coverage-delta` scripts wired.
- Unit tests for delta computation logic (vitest).
</acceptance_criteria>

### Task 3: Cross-reference REMOV-01 batch against coverage clusters

<acceptance_criteria>
- Analysis script (can be inline in Task 2 or a one-off) maps each REMOV-01 cluster to coverage drilldown clusters.
- Output: `reports/seo/latest-remov01-coverage-crossref.md` with table:
  | REMOV-01 Cluster | URLs in Batch | Coverage Cluster(s) Hit | Est. Anomalies Addressed |
  |---|---|---|---|
  | source_file | 301 | source_file_path | ~301 |
  | skill_blocklisted | 258 | known_skill_404 | ~258 |
  | trailing_slash | 192 | trailing_slash | ~192 |
  | ... | ... | ... | ... |
- Narrative: estimated coverage anomaly reduction from batch 1 alone.
</acceptance_criteria>

### Task 4: Build second-pass removal batch (v2) for top 3 residual clusters

<acceptance_criteria>
- `scripts/seo-gsc-removal-batch-v2.ts` exists and runs via `npm run report:seo:gsc-removal-batch-v2`.
- Reads: `latest-coverage-drilldown.json`, `latest-404-remediation-plan.json`, `latest-gsc-removal-batch.json` (v1).
- Excludes any URL already in v1 batch.
- Ranks residual clusters by weighted impact (from coverage drilldown).
- Selects top 3 clusters: expected **known_skill_404** (residual), **source_file_path** (residual), **trailing_slash** (residual) — but confirm via data.
- Outputs `reports/seo/latest-gsc-removal-batch-v2.{csv,json,md}` with:
  - Cluster breakdown table (cluster, count, sample URLs, priority rationale).
  - Operator runbook appendix: submission order, prefix candidates, expected anomaly reduction.
- CSV format matches GSC URL Removal tool bulk upload (one URL per line).
- JSON includes metadata: generatedAt, sourceReports, excludedV1Urls, targetClusters.
- MD includes runbook-ready submission checklist.
</acceptance_criteria>

### Task 5: Document coverage anomaly reduction estimate (batch 1 + batch 2)

<acceptance_criteria>
- `reports/seo/latest-coverage-anomaly-projection.md` created with:
  - Baseline: 10,783 anomalies (2026-06-03 drilldown).
  - Batch 1 (REMOV-01) estimated reduction: X anomalies (from cross-ref).
  - Batch 2 (v2) estimated reduction: Y anomalies (from v2 batch builder).
  - Projected residual: 10,783 − X − Y = Z.
  - Assertion: Z < 2,000 (target) or documented gap with next-steps.
- Updated ROADMAP.md, STATE.md, REQUIREMENTS.md with Phase 156 completion.
</acceptance_criteria>

### Task 6: Update planning docs

<acceptance_criteria>
- STATE.md reflects Phase 156 automation delivered + verification pending operator submission.
- ROADMAP.md marks Phase 156 plan as complete.
- REQUIREMENTS.md updates IND-01 traceability with verification artifacts.
</acceptance_criteria>

## Success Criteria (overall phase)

- [ ] Post-submission verification automation emits delta report after REMOV-01 batch.
- [ ] Cross-reference analysis documents REMOV-01 impact per coverage cluster.
- [ ] Second-pass removal batch (v2) generated for top 3 residual clusters.
- [ ] Coverage anomaly reduction projection shows path to <2,000 anomalies.
- [ ] 0 regressions (1088+ tests pass, crawl health CLEAR).

## Verification

```bash
# After operator confirms REMOV-01 batch submitted (100% in tracker)
# Wait 24-48h for GSC processing, then:

# 1. Run verification on batch 1
npm run report:seo:gsc-removal-verification -- verify --batch reports/seo/latest-gsc-removal-batch.json

# 2. Run fresh coverage sweep (URL Inspection)
npm run report:seo:url-inspection-coverage-sweep

# 3. Compute delta against pre-submission baseline
npm run report:seo:coverage-delta -- --before reports/seo/pre-remov01-coverage-sweep.json --after reports/seo/latest-url-inspection-coverage-sweep.json

# 4. Generate second-pass batch
npm run report:seo:gsc-removal-batch-v2

# 5. Verify no regressions
npx vitest run
npm run report:seo:recovery-scorecard
```