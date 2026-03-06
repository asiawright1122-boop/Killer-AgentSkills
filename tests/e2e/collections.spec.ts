import { test, expect } from '@playwright/test';

const devUrl = 'http://localhost:4321';

test.describe('Collections E2E', () => {
    test('should load the collections index page', async ({ page }) => {
        // English locale collections index
        await page.goto(`${devUrl}/en/collections`);

        // Verify title is Editor's Picks
        await expect(page.locator('h1')).toHaveText(/Editor's Picks/i);

        // Verify at least one collection card exists
        const collectionLinks = page.locator('a[href^="/en/collections/"]');
        expect(await collectionLinks.count()).toBeGreaterThan(0);
    });

    test('should load a collection detail page and verify schema and elements', async ({ page }) => {
        // Navigate to known collection that we generated earlier
        await page.goto(`${devUrl}/en/collections/top-mcp-server-mcp-servers`);

        // Check main H1 title
        await expect(page.locator('h1')).toBeVisible();

        // Check if the SkillCards grid exists OR the "No active skills found" message is shown
        // (Local dev environments might not have D1 data fully synced)
        const skillCardsCount = await page.locator('article.brut-card').count();
        if (skillCardsCount === 0) {
            await expect(page.locator('text=No active skills found')).toBeVisible();
        } else {
            // Verify the sticky bottom Install All banner is visible
            const bottomBanner = page.locator('text=Install All');
            await expect(bottomBanner.first()).toBeVisible();
        }

        // Check if the script injected the JSON-LD ItemList schema
        const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
        const hasItemList = jsonLd.some(script => script.includes('"@type":"ItemList"'));
        expect(hasItemList).toBeTruthy();
    });
});
