# Plan: INP & LCP Core Web Vitals Auditing & Search Health Monitoring

This phase introduces automated Core Web Vitals auditing for LCP/INP/CLS using Playwright E2E tests, and implements an automated Search Console health monitor script that blocks pipeline execution when metrics trigger critical alerts (e.g. clicks collapse, crawl errors surge, or stale data).

- **Wave:** 1
- **Depends on:** Phase 149
- **Files modified:**
  - `tests/e2e/core-web-vitals.spec.ts` [NEW]
  - `scripts/gsc-search-health-monitor.ts` [NEW]
  - `scripts/lib/gsc-search-health-monitor.test.ts` [NEW]
- **Requirements:** CWV-01, MON-01
- **Autonomous:** true

## Tasks

### Task 1: Implement Core Web Vitals Playwright E2E Audit Spec

<read_first>
- [playwright.config.ts](file:///Users/kaka/Dev/Killer-Skills/playwright.config.ts)
- [tests/e2e/home.spec.ts](file:///Users/kaka/Dev/Killer-Skills/tests/e2e/home.spec.ts)
- [.planning/phases/150-core-web-vitals-search-health-monitoring/150-RESEARCH.md](file:///Users/kaka/Dev/Killer-Skills/.planning/phases/150-core-web-vitals-search-health-monitoring/150-RESEARCH.md)
</read_first>

<acceptance_criteria>
- File `tests/e2e/core-web-vitals.spec.ts` is created.
- Test audits `baseURL` (Home page) and at least one skill detail route (e.g. `/zh/skills/freeCodeCamp/freeCodeCamp`).
- Injects a `PerformanceObserver` to track LCP, CLS, and INP metrics.
- Simulates a user interaction (like clicking a collapsible card or link) during page load to ensure INP observer logs interaction delays.
- Asserts that all page audits yield LCP <= 2500ms, CLS <= 0.1, and INP <= 200ms.
- Running `npx playwright test tests/e2e/core-web-vitals.spec.ts` passes cleanly.
</acceptance_criteria>

<action>
Create `tests/e2e/core-web-vitals.spec.ts`:
1. Use `@playwright/test` `test` and `expect`.
2. Evaluate JS script inside the browser context to set up the observer before page loads.
3. Simulate clicks (e.g., detail panels).
4. Pull collected metrics after 1500ms.
5. Perform assertions.
</action>

---

### Task 2: Implement GSC Search Health Monitoring Script

<read_first>
- [scripts/ai-provider-health.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/ai-provider-health.ts)
- [scripts/seo-coverage-drilldown.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/seo-coverage-drilldown.ts)
</read_first>

<acceptance_criteria>
- File `scripts/gsc-search-health-monitor.ts` is created.
- Command line flags `--mock-ctr-json` and `--mock-coverage-json` are supported.
- Checks week-over-week click changes from CTR report.
- Checks freshness age (SLA), total affected pages, and `other` cluster count from coverage drilldown report.
- Generates a report in `reports/gsc/search-health-alerts.md`.
- Exits with exit code 1 if critical alerts trigger; otherwise exits with exit code 0.
</acceptance_criteria>

<action>
Write `scripts/gsc-search-health-monitor.ts`:
1. Load and parse CTR and coverage report data.
2. Formulate alert definitions:
   - `gsc_freshness_sla_breach` (critical: age > 30 days)
   - `gsc_clicks_collapse` (critical: YoY drop > 30%)
   - `gsc_crawl_error_spike` (critical: affected pages > 150)
   - `gsc_unexpected_cluster_spike` (critical: other cluster > 200)
3. Evaluate metrics and push triggered warnings and critical alarms.
4. Output MD report to `reports/gsc/search-health-alerts.md`.
5. Exit based on severity of triggered alerts.
</action>

---

### Task 3: Implement Unit Tests for Search Health Monitor

<read_first>
- [scripts/gsc-search-health-monitor.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/gsc-search-health-monitor.ts)
</read_first>

<acceptance_criteria>
- File `scripts/lib/gsc-search-health-monitor.test.ts` is created.
- Validates clear state (zero alerts) under healthy GSC and coverage metrics.
- Validates warning state when thresholds are slightly breached (e.g., clicks drop > 15%, coverage age > 15 days).
- Validates blocking critical state (alert thrown, exit code 1 simulated) when thresholds are severely breached.
- Test runs and passes under `npx vitest run scripts/lib/gsc-search-health-monitor.test.ts`.
</acceptance_criteria>

<action>
Create `scripts/lib/gsc-search-health-monitor.test.ts` using `vitest`:
1. Export a core analyzer function from the monitor script (such as `analyzeSearchHealth(ctrData, coverageData)`).
2. Write unit tests passing mock data variations.
3. Assert that returned alerts contain the expected alert codes, severities, and overall status.
</action>

---

### Task 4: Complete System Verification

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
- `tests/e2e/core-web-vitals.spec.ts` [NEW]
- `scripts/gsc-search-health-monitor.ts` [NEW]
</read_first>

<acceptance_criteria>
- Typecheck checks pass: `npm run typecheck` succeeds.
- E2E tests pass: `npx playwright test tests/e2e/core-web-vitals.spec.ts` succeeds.
- Unit test suite passes: `npx vitest run scripts/lib/gsc-search-health-monitor.test.ts` succeeds.
- Full test suite passes: `npm test` runs cleanly.
</acceptance_criteria>

<action>
Execute type check and test runners in sequence to guarantee regression-free completion of Phase 150.
</action>

## Verification Plan

### Automated Tests
- Type checking: `npm run typecheck`
- Monitor unit tests: `npx vitest run scripts/lib/gsc-search-health-monitor.test.ts`
- Web vitals E2E: `npx playwright test tests/e2e/core-web-vitals.spec.ts`
- Full test suite: `npm test`

### Manual Verification
- Dry-run the search health monitor locally to verify the Markdown alert generated in `reports/gsc/search-health-alerts.md`.
