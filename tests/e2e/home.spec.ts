import { test, expect } from '@playwright/test';

// Use localhost for local e2e testing, or production url defined in playwright.config.ts
const devUrl = 'http://localhost:4321';

test.describe('Home Page E2E', () => {
  test('should load the home page and verify SEO metadata', async ({ page }) => {
    // English locale home page
    await page.goto(`${devUrl}/en/`);

    // Verify title and description
    await expect(page).toHaveTitle(/Killer-Skills/);
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute('content', /.*AI.*Agent.*/i);
  });

  test('should display Featured Collections section with valid links', async ({ page }) => {
    await page.goto(`${devUrl}/en/`);

    // Verify Featured Collections header exists
    await expect(page.locator('text=Featured Collections').first()).toBeVisible();

    // Verify at least one collection card exists in this section
    const collectionCards = page.locator('a[href^="/en/collections/"]');
    expect(await collectionCards.count()).toBeGreaterThan(0);

    // Verify Official Skills section exists
    await expect(page.locator('text=Official Skills').first()).toBeVisible();
  });

  test('should toggle 1-Click Install CTA if SkillCards exist', async ({ page }) => {
    await page.goto(`${devUrl}/en/`);

    const firstCard = page.locator('article.brut-card').first();
    const count = await firstCard.count();

    // Only test the CTA if the local dev server actually loaded skills from D1
    if (count > 0) {
      await expect(firstCard).toBeVisible();

      const installBtn = firstCard.locator('.install-copy-btn');

      // Check if the install command contains npx killer-skills
      const installCommand = await installBtn.getAttribute('data-command');
      expect(installCommand).toContain('npx killer-skills add');
    } else {
      console.log('Skipping CTA test: No SkillCards rendered (likely missing local DB sync).');
    }
  });
});
