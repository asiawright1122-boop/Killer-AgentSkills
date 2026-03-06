import { test, expect } from '@playwright/test';

test.describe('Killer-Skills Core Pages', () => {

  test('Homepage renders correctly', async ({ page }) => {
    await page.goto('/en');
    const h1 = page.locator('h1');
    await expect(h1).toContainText('Directory');
  });

  test('Skills Directory loads skills', async ({ page }) => {
    await page.goto('/en/skills');
    const cards = page.locator('article.brut-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
  });

});
