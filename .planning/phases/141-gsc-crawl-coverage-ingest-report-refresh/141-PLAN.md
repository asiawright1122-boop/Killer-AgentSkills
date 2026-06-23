# Phase 141: GSC Crawl Coverage Ingest & Report Refresh

- **Wave**: 1
- **Depends On**: Phase 140
- **Files Modified**: 
  - `.env.local`
- **Autonomous**: true

## Tasks

### Task 1: Update Local Environment Configuration
<read_first>
- [.env.local](file:///Users/kaka/Dev/Killer-Skills/.env.local)
</read_first>
<acceptance_criteria>
- `.env.local` contains `SEO_COVERAGE_SOURCE_WARNING_DAYS=30`
</acceptance_criteria>
<action>
- Modify or append the setting `SEO_COVERAGE_SOURCE_WARNING_DAYS=30` in [.env.local](file:///Users/kaka/Dev/Killer-Skills/.env.local).
</action>

### Task 2: Ingest Coverage Data and Rerun Analysis Reports
<read_first>
- [scripts/seo-coverage-drilldown.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/seo-coverage-drilldown.ts)
- [scripts/lib/recovery-scorecard.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/recovery-scorecard.ts)
</read_first>
<acceptance_criteria>
- `reports/seo/latest-coverage-drilldown.json` is updated.
- `reports/seo/latest-recovery-scorecard.json` is updated.
- Scorecard report output shows `Coverage Freshness` gate status as `CLEAR`.
</acceptance_criteria>
<action>
- Run `npm run report:seo:coverage-drilldown` to refresh the coverage analysis report.
- Run `npm run report:seo:recovery-scorecard` to update the recovery scorecard.
- Verify that `Coverage Freshness` gate is `CLEAR` and the overall status is updated.
</action>

### Task 3: System Integrity & Build Check
<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>
<acceptance_criteria>
- `npm run typecheck` passes with exit code 0.
- `npm test` passes with exit code 0.
- `npm run build` passes with exit code 0.
</acceptance_criteria>
<action>
- Run typechecking: `npm run typecheck`
- Run Vitest tests: `npm test`
- Run production build: `npm run build`
</action>
