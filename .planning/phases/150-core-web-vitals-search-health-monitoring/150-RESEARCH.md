# Phase 150 Research: Core Web Vitals Auditing & Search Health Monitoring

## 1. Core Web Vitals Diagnostics & Auditing (CWV-01)

### 1.1 Objective
Audit the key page templates (Home page, listing page, and detail template) for Core Web Vitals parameters:
- **LCP (Largest Contentful Paint)**: Target <= 2500ms (Good)
- **INP (Interaction to Next Paint)**: Target <= 200ms (Good)
- **CLS (Cumulative Layout Shift)**: Target <= 0.1 (Good)

### 1.2 Playwright Web Vitals Auditing Strategy
Because we are in a headless CLI environment, we can run Playwright and inject a `PerformanceObserver` to track metrics:

1. **LCP Collection**:
   Observe `largest-contentful-paint` entries using a `PerformanceObserver` inside the page.
2. **CLS Collection**:
   Observe `layout-shift` entries and accumulate `value` on non-recent-input events.
3. **INP Collection**:
   Observe `event` entries. INP is defined as the maximum interaction latency (clicks, keydowns, pointerdowns). To measure INP:
   - Use Playwright to simulate a sequence of key interactions (e.g. clicking on details collapsible elements, clicking recommendations, tabs).
   - Compute `processingEnd - processingStart` or use the `event` entry's `duration`.

#### Playwright Injectable Observer Snippet:
```typescript
const metrics = await page.evaluate(() => {
  return new Promise((resolve) => {
    let lcp = 0;
    let cls = 0;
    let maxInteractionDelay = 0;

    // LCP Observer
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      lcp = lastEntry.renderTime || lastEntry.loadTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS Observer
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          cls += (entry as any).value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // INP/Interaction Observer
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const delay = entry.duration; // duration includes delay + processing + paint
        if (delay > maxInteractionDelay) {
          maxInteractionDelay = delay;
        }
      }
    }).observe({ type: 'event', durationThreshold: 0, buffered: true });

    // Wait and resolve after a simulated duration/interaction
    setTimeout(() => {
      resolve({ lcp, cls, inp: maxInteractionDelay });
    }, 1500);
  });
});
```

---

## 2. Search Console Health Monitoring & Alerts (MON-01)

### 2.1 Objective
Establish an automated diagnostics monitor that triggers alerts (blocking CLI failures or warning logs) under GSC telemetry anomalies or crawl spike events.

### 2.2 Target Telemetry Data Sources
Our system consumes two primary GSC artifacts generated on automated pipelines:
1. `reports/gsc/latest-ctr-report.json`: Contains performance indices like clicks, impressions, CTR, position, and priority opportunities.
2. `reports/seo/latest-coverage-drilldown.json`: Contains coverage status, freshness dates, age, total affected pages, and individual issue clusters (5xx errors, sandbox leaks, legacy HTML, trailing slash drift, etc.).

### 2.3 Proposed Alert Rules (Thresholds)
We will implement `scripts/gsc-search-health-monitor.ts` to enforce the following checks:

| Alert Code | Parameter | Severity | Alert Condition |
| --- | --- | --- | --- |
| `gsc_freshness_sla_breach` | Coverage Freshness Age | Critical | Age of drilldown data > 30 days |
| `gsc_freshness_sla_warning` | Coverage Freshness Age | Warning | Age of drilldown data > 15 days |
| `gsc_clicks_collapse` | Click Drop | Critical | Week-over-week clicks drop > 30% |
| `gsc_clicks_drop_warning` | Click Drop | Warning | Week-over-week clicks drop > 15% |
| `gsc_crawl_error_spike` | Crawl Errors | Critical | Affected pages in drilldown > 150 |
| `gsc_crawl_error_warning` | Crawl Errors | Warning | Affected pages in drilldown > 50 |
| `gsc_unexpected_cluster_spike` | Unclassified Coverage | Critical | Affected pages under `other` cluster > 200 |

### 2.4 Alert Triggering Behavior
- If any `Critical` level alarm triggers, the script writes a Markdown summary to `reports/gsc/search-health-alerts.md` and exits with **code 1** to halt CI/CD.
- If only `Warning` alarms trigger, it logs them and exits with **code 0**.
- Supported flags:
  - `--mock-ctr-json=<file>` / `--mock-coverage-json=<file>`: Override inputs for unit and integration testing.
  - `--allow-warnings`: Prevent warnings from failing the process.

---

## 3. Plan for Implementation & Verification

- **CWV Test Spec**: Create `tests/e2e/core-web-vitals.spec.ts` which runs locally during Playwright E2E runs.
- **Monitoring Script**: Create `scripts/gsc-search-health-monitor.ts`.
- **Unit Tests**: Create `scripts/lib/gsc-search-health-monitor.test.ts` to assert alert triggers under mocked inputs.
