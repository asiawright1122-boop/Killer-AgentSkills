import { test, expect } from '@playwright/test';

const SITE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321';

test.describe('Index Tier System', () => {
  test('skills sitemap contains URLs and stays within Tier 1 bounds', async ({ request }) => {
    const response = await request.get(`${SITE_URL}/sitemap-skills.xml`);
    expect(response.status()).toBe(200);
    const body = await response.text();

    // Sitemap should contain URLs but only Tier 1 (~300-500)
    const urlCount = (body.match(/<url>/g) || []).length;
    expect(urlCount).toBeGreaterThan(0);
    // Tier 1 filter should keep sitemap well under 600 URLs
    expect(urlCount).toBeLessThan(600);

    // Should not contain test/dummy/example repos (Tier 2/3 territory)
    expect(body).not.toContain('/hello-world');
  });

  test('non-existent skill page returns noindex or 404/410', async ({ request }) => {
    const response = await request.get(`${SITE_URL}/en/skills/test-dummy/nonexistent-skill`, {
      failOnStatusCode: false,
    });
    const xRobotsTag = response.headers()['x-robots-tag'] || '';
    const isNoindex = xRobotsTag.includes('noindex');
    const isError = response.status() === 404 || response.status() === 410;
    expect(isNoindex || isError).toBe(true);
  });

  test('skill listing page is indexable', async ({ request }) => {
    const response = await request.get(`${SITE_URL}/en/skills`);
    const xRobotsTag = response.headers()['x-robots-tag'] || '';
    expect(xRobotsTag).not.toContain('noindex');
  });
});
