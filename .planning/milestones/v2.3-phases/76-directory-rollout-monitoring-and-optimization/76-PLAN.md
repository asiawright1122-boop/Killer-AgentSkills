# Phase 76: directory-rollout-monitoring-and-optimization - Plan

phase: 76-directory-rollout-monitoring-and-optimization
milestone: v2.3
version: 1.0

## Tasks

- [ ] **Extend Indexability Monitoring (SEO-19)**:
  - Update `scripts/seo-skill-indexability-report.ts` or add a new script `scripts/seo-directory-indexability-report.ts` to scan and assessment indexability status for known multi-skill repository directory roots.
  - Verify that under `OVERRIDE_EXPANSION_BOUNDARY=open`, these pages do not emit `noindex` blockers.
- [ ] **Implement Edge Performance Verification (REC-37)**:
  - Create a new utility script `scripts/seo-directory-perf-test.ts` that runs a concurrency-controlled simulator for search crawlers against multi-skill directory routes.
  - Verify edge SSR latency is under 200ms average and status codes return 100% 200 OK.
  - Add unit tests for `seo-directory-perf-test.ts` logic in `scripts/seo-directory-perf-test.test.ts` using Vitest.
- [ ] **Run Quality Gates**:
  - Run all Vitest unit tests (`npm test`).
  - Run linting and formatting checks (`npm run lint` and `npm run format:check`).
- [ ] **Generate Phase Closeout Deliverables**:
  - Create `76-01-SUMMARY.md` and `76-VERIFICATION.md` in the phase directory.
- [ ] **Closeout Milestone v2.3**:
  - Update `ROADMAP.md` and `STATE.md` to flag Phase 76 complete and Milestone v2.3 ready for archive.
  - Run `npm run report:planning:milestones` to ensure clean lifecycle indicators.

## Deliverables

- `scripts/seo-directory-perf-test.ts`
- `scripts/seo-directory-perf-test.test.ts`
- `.planning/milestones/v2.3-phases/76-directory-rollout-monitoring-and-optimization/76-01-SUMMARY.md`
- `.planning/milestones/v2.3-phases/76-directory-rollout-monitoring-and-optimization/76-VERIFICATION.md`

## Verification Steps

1. Run the new performance simulation unit tests:
   ```bash
   npx vitest run scripts/seo-directory-perf-test.test.ts
   ```
2. Run the crawler simulation against local dev/preview node:
   ```bash
   npx tsx scripts/seo-directory-perf-test.ts --url=http://localhost:4321
   ```
3. Run codebase quality checks:
   ```bash
   npm run lint && npm run format:check
   ```
