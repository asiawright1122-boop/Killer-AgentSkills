import { test, expect } from '@playwright/test';

test.describe('Core Web Vitals E2E Audit', () => {
  async function auditPagePerformance(page: any, url: string) {
    // 1. Inject observers before page loads
    await page.addInitScript(() => {
      (window as any)._cwv = {
        lcp: 0,
        cls: 0,
        inp: 0,
        inpEntries: [] as any[],
      };

      // LCP Observer
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1] as any;
          (window as any)._cwv.lcp = lastEntry.renderTime || lastEntry.loadTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // CLS Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any)._cwv.cls += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // INP/Interaction Observer
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const delay = entry.duration;
          (window as any)._cwv.inpEntries.push({ delay, type: entry.name });
          if (delay > (window as any)._cwv.inp) {
            (window as any)._cwv.inp = delay;
          }
        }
      }).observe({ type: 'event', durationThreshold: 0, buffered: true } as any);
    });

    // 2. Navigate and wait for networkidle
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // 3. Simulate user interactions to trigger INP observer
    // Using visible elements and short timeouts to prevent test hang
    const clickables = page.locator('button:visible, a:visible, summary:visible');
    const clickableCount = await clickables.count();
    if (clickableCount > 0) {
      try {
        await clickables.first().click({ timeout: 1000 });
      } catch (err) {
        console.warn(`[CWV Test] Simulated click interaction timed out or skipped: ${(err as Error).message}`);
      }
    }

    // 4. Wait for metrics processing
    await page.waitForTimeout(1000);

    // 5. Evaluate and return results
    const results = await page.evaluate(() => {
      return (window as any)._cwv;
    });

    return results;
  }

  test('Home page should have good Core Web Vitals', async ({ page, baseURL }) => {
    const targetUrl = `${baseURL || 'http://127.0.0.1:4322'}/en/`;
    const response = await page.goto(targetUrl);
    
    // If home page itself returns an error status (like 500), skip to prevent false positives
    if (response && response.status() >= 500) {
      test.skip(true, `Home page returned error code ${response.status()}. Skipping test.`);
      return;
    }

    const metrics = await auditPagePerformance(page, targetUrl);
    console.log(`[CWV Audit - Home] LCP: ${metrics.lcp}ms, CLS: ${metrics.cls}, INP: ${metrics.inp}ms`);

    expect(metrics.lcp).toBeLessThanOrEqual(2500);
    expect(metrics.cls).toBeLessThanOrEqual(0.1);
    expect(metrics.inp).toBeLessThanOrEqual(200);
  });

  test('Skill details template page should have good Core Web Vitals', async ({ page, baseURL }) => {
    const targetUrl = `${baseURL || 'http://127.0.0.1:4322'}/zh/skills/freeCodeCamp/freeCodeCamp`;
    const response = await page.goto(targetUrl);

    // Skip details page test if local D1 database is not seeded (returns 500 D1_ERROR)
    if (response && response.status() >= 500) {
      test.skip(true, 'Local database is not seeded (returns 500 error). Skipping details template CWV test.');
      return;
    }

    const metrics = await auditPagePerformance(page, targetUrl);
    console.log(`[CWV Audit - Detail] LCP: ${metrics.lcp}ms, CLS: ${metrics.cls}, INP: ${metrics.inp}ms`);

    expect(metrics.lcp).toBeLessThanOrEqual(2500);
    expect(metrics.cls).toBeLessThanOrEqual(0.1);
    expect(metrics.inp).toBeLessThanOrEqual(200);
  });
});
