import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const waitForHeaderActions = async (page: Page) => {
  await expect(page.getByTestId('header-actions')).toHaveAttribute('data-mounted', 'true');
};

test.describe('Navigation & i18n E2E', () => {
  test('root / should redirect to a locale-prefixed path', async ({ page }) => {
    const response = await page.goto('/');
    await expect(page).toHaveURL(/\/[a-z]{2}\/?$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('desktop navigation should click through to the collections page', async ({ page }) => {
    await page.goto('/en');
    await page.locator('nav[aria-label="Main navigation"] a[href="/en/collections"]').click();
    await expect(page).toHaveURL(/\/en\/collections$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('collection cards should navigate when clicking the card body', async ({ page }) => {
    await page.goto('/en/collections');

    const collectionCard = page.getByTestId('collection-card').first();
    await expect(collectionCard).toBeVisible();

    const href = await collectionCard.locator('a[href^="/en/collections/"]').first().getAttribute('href');
    expect(href).toBeTruthy();

    await collectionCard.click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp(href!)));
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
  });

  test('desktop locale switch should update the route and document language', async ({ page }) => {
    await page.goto('/en/collections');
    await waitForHeaderActions(page);
    await page.getByTestId('desktop-locale-toggle').click();
    await page.getByTestId('desktop-locale-option-zh').click();

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

    await page.getByTestId('mobile-menu-panel').locator('a[href="/en/collections"]').click();
    await expect(page).toHaveURL(/\/en\/collections$/);
    await expect(overlay).toHaveAttribute('data-state', 'closed');

    const collectionCard = page.getByTestId('collection-card').first();
    await expect(collectionCard).toBeVisible();

    const href = await collectionCard.locator('a[href^="/en/collections/"]').first().getAttribute('href');
    expect(href).toBeTruthy();

    await collectionCard.click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp(href!)));
  });

  test('skill cards should navigate when local listing data is available', async ({ page }) => {
    await page.goto('/en/skills');

    const skillCards = page.getByTestId('skill-card');
    const count = await skillCards.count();
    test.skip(count === 0, 'Local skill listing data is unavailable in this environment.');

    const skillCard = skillCards.first();
    const href = await skillCard.locator('a[href*="/en/skills/"]').first().getAttribute('href');
    expect(href).toBeTruthy();

    await skillCard.click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp(href!)));
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

    await page.getByTestId('mobile-locale-option-zh').click();
    await expect(page).toHaveURL(/\/zh\/collections$/);
    await expect(overlay).toHaveAttribute('data-state', 'closed');
    await expect(page.locator('html')).toHaveAttribute('lang', /zh/);
  });
});
