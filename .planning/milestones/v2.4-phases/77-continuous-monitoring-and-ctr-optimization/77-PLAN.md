# Phase 77: continuous-monitoring-and-ctr-optimization - Plan

phase: 77-continuous-monitoring-and-ctr-optimization
milestone: v2.4
version: 1.0

## Tasks

- [ ] **Repository Directory GSC CTR Monitoring (SEO-20)**:
  - Modify `src/lib/gsc-report.ts` to add a helper function `isRepositoryDirectoryPath` to identify `/skills/[owner]/[repo]` urls.
  - Implement `aggregateRepositoryDirectoryMetrics` to aggregate CTR metrics for directory roots.
  - Update `scripts/gsc-ctr-report.ts` and `scripts/gsc-fetch-report.ts` to render the `## Repository Directory CTR Performance` section in reports.
- [ ] **Implement Database Synchronization Verification (REC-38)**:
  - Create a new utility script `scripts/verify-kv-d1-sync.ts` that runs two-way sync checks against D1 and KV databases.
  - Generate a verification report `reports/seo/sync-health.json` and exit with code 1 if differences are found.
  - Add unit tests for `verify-kv-d1-sync.ts` logic in `scripts/verify-kv-d1-sync.test.ts`.
- [ ] **Run Quality Gates**:
  - Run all Vitest tests (`npm test`).
  - Run linting and formatting checks (`npm run lint` and `npm run format:check`).
- [ ] **Generate Phase Closeout Deliverables**:
  - Create `77-01-SUMMARY.md` and `77-VERIFICATION.md` in the phase directory.
- [ ] **Closeout Milestone v2.4**:
  - Update `ROADMAP.md` and `STATE.md` to flag Phase 77 complete and Milestone v2.4 ready for archive.
  - Run `npm run report:planning:milestones` to ensure clean lifecycle indicators.

## Deliverables

- `scripts/verify-kv-d1-sync.ts`
- `scripts/verify-kv-d1-sync.test.ts`
- `.planning/milestones/v2.4-phases/77-continuous-monitoring-and-ctr-optimization/77-01-SUMMARY.md`
- `.planning/milestones/v2.4-phases/77-continuous-monitoring-and-ctr-optimization/77-VERIFICATION.md`

## Verification Steps

1. Run the database sync check unit tests:
   ```bash
   npx vitest run scripts/verify-kv-d1-sync.test.ts
   ```
2. Run the actual database sync check:
   ```bash
   npx tsx scripts/verify-kv-d1-sync.ts
   ```
3. Run the GSC report generation test:
   ```bash
   npx tsx scripts/gsc-ctr-report.ts --pages=reports/gsc/snapshots/sample-pages.csv --queries=reports/gsc/snapshots/sample-queries.csv
   ```
4. Run codebase quality checks:
   ```bash
   npm run lint && npm run format:check
   ```
