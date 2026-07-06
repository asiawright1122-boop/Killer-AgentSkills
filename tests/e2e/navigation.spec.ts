import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const waitForHeaderActions = async (page: Page) => {
  await expect(page.getByTestId('header-actions')).toHaveAttribute('data-initialized', 'true');
};

test.describe('Navigation & i18n E2E', () => {
  test('root / should redirect to a locale-prefixed path', async ({ page }) => {
    const response = await page.goto('/');
    await expect(page).toHaveURL(/\/[a-z]{2}\/?$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('desktop navigation should click through the marketplace primary routes', async ({ page }) => {
    await page.goto('/en');
    const nav = page.getByTestId('desktop-primary-nav');
    await expect(nav).toBeVisible();

    await Promise.all([page.waitForURL(/\/en\/skills$/), nav.locator('a[href="/en/skills"]').click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Skills Directory' })).toBeVisible();

    await Promise.all([page.waitForURL(/\/en\/popular$/), nav.locator('a[href="/en/popular"]').click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Popular Skills' })).toBeVisible();

    await Promise.all([page.waitForURL(/\/en\/occupations$/), nav.locator('a[href="/en/occupations"]').click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Occupations' })).toBeVisible();

    await Promise.all([page.waitForURL(/\/en\/categories$/), nav.locator('a[href="/en/categories"]').click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  });

  test('collections bridge page should route into the new marketplace structure', async ({ page }) => {
    await page.goto('/en/collections');
    const categoriesLink = page.locator('a[href="/en/categories"]').first();
    await expect(categoriesLink).toBeVisible();
    await Promise.all([page.waitForURL(/\/en\/categories$/), categoriesLink.click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  });

  test('desktop locale switch should update the route and document language', async ({ page }) => {
    await page.goto('/en/collections');
    await waitForHeaderActions(page);
    await page.locator('.header-lang-toggle').click();
    await page.locator('.header-lang-option[data-locale-code="zh"]').click();

    await expect(page).toHaveURL(/\/zh\/collections$/);
    await expect(page.locator('html')).toHaveAttribute('lang', /zh/);
  });

  test('mobile menu should close cleanly and stop blocking page clicks', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    await waitForHeaderActions(page);

    const menuToggle = page.getByTestId('mobile-menu-toggle');
    const overlay = page.getByTestId('mobile-menu-overlay');

    await menuToggle.click();
    await expect(overlay).toHaveAttribute('data-state', 'open');

    await page.getByTestId('mobile-menu-panel').locator('a[href="/en/categories"]').click();
    await expect(page).toHaveURL(/\/en\/categories$/);
    await expect(overlay).toHaveAttribute('data-state', 'closed');
    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();

    await menuToggle.click();
    await expect(overlay).toHaveAttribute('data-state', 'open');
    await page.locator('.header-mobile-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(overlay).toHaveAttribute('data-state', 'closed');
  });

  test('skill cards should navigate when local listing data is available', async ({ page }) => {
    await page.goto('/en/skills');

    const skillCards = page.getByTestId('skill-card');
    const count = await skillCards.count();
    test.skip(count === 0, 'Local skill listing data is unavailable in this environment.');

    const skillCard = skillCards.first();
    const href = await skillCard.locator('a[href*="/en/skills/"]').first().getAttribute('href');
    expect(href).toBeTruthy();

    await Promise.all([page.waitForURL(new RegExp(escapeRegExp(href!))), skillCard.locator('a[href*="/en/skills/"]').first().click()]);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('mobile locale switch should close the overlay and navigate to the selected locale', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/collections');
    await waitForHeaderActions(page);

    const menuToggle = page.getByTestId('mobile-menu-toggle');
    const overlay = page.getByTestId('mobile-menu-overlay');

    await menuToggle.click();
    await expect(overlay).toHaveAttribute('data-state', 'open');

    await page.locator('.header-mobile-lang[data-locale-code="zh"]').click();
    await expect(page).toHaveURL(/\/zh\/collections$/);
    await expect(overlay).toHaveAttribute('data-state', 'closed');
    await expect(page.locator('html')).toHaveAttribute('lang', /zh/);
  });
});
