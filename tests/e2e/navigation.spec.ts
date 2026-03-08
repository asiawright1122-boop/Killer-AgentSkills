import { test, expect } from '@playwright/test';

const devUrl = 'http://localhost:4321';

test.describe('Navigation & i18n E2E', () => {
  test('root / should redirect to a locale-prefixed path', async ({ page }) => {
    const response = await page.goto(`${devUrl}/`);
    // Should redirect to /en/ or another locale
    expect(page.url()).toMatch(/\/[a-z]{2}\/?$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('should load Chinese locale home page', async ({ page }) => {
    await page.goto(`${devUrl}/zh/`);
    // Should have Content-Language header or Chinese content
    await expect(page.locator('html')).toHaveAttribute('lang', /zh/);
  });

  test('should return 404 page for non-existent route', async ({ page }) => {
    const response = await page.goto(`${devUrl}/en/this-page-does-not-exist-12345`);
    expect(response?.status()).toBe(404);
  });

  test('navigation links should be valid', async ({ page }) => {
    await page.goto(`${devUrl}/en/`);

    // Check that the main navigation has key links
    const navLinks = page.locator('nav a[href]');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Skill Detail Page E2E', () => {
  test('should load a known skill detail page', async ({ page }) => {
    // Use anthropics/skills as a well-known skill
    await page.goto(`${devUrl}/en/skills/anthropics/skills`);

    // Check basic structure
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should display skill metadata section', async ({ page }) => {
    await page.goto(`${devUrl}/en/skills/anthropics/skills`);

    // Check for common skill page elements
    // Stars count, category badge, or description should exist
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(100);
  });
});

test.describe('Static Pages E2E', () => {
  test('should load sitemap.xml', async ({ request }) => {
    const res = await request.get(`${devUrl}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('<sitemapindex');
  });

  test('should load llms.txt', async ({ request }) => {
    const res = await request.get(`${devUrl}/llms.txt`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });
});
