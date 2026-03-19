import { test, expect } from '@playwright/test';

const devUrl = 'http://localhost:4321';

test.describe('Collections E2E', () => {
    test('should load the collections index page', async ({ page }) => {
        // English locale collections index
        await page.goto(`${devUrl}/en/collections`);

        // Verify primary heading matches the current collections page copy
        await expect(page.getByRole('heading', { level: 1, name: /Workflow Skill Bundles/i })).toBeVisible();

        // Verify at least one collection card exists
        const collectionLinks = page.locator('a[href^="/en/collections/"]');
        expect(await collectionLinks.count()).toBeGreaterThan(0);
    });

    test('should redirect a legacy collection slug to the canonical slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-mcp-server-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-ai-agent-integration-frameworks-bridges-infra-tooling`);
    });

    test('should redirect a localized legacy agentic collection slug and keep canonical metadata aligned', async ({ page }) => {
        await page.goto(`${devUrl}/es/collections/top-agentic-ai-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/es/collections/top-agentic-ai-platforms-orchestration-tools`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools'
        );
    });

    test('should redirect a legacy cursor collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-cursor-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-cursor-compatible-skills-workflow-integrations`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-cursor-compatible-skills-workflow-integrations'
        );
    });

    test('should redirect a legacy developer-tools collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-developer-tools-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-developer-tooling-ai-agent-work`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-developer-tooling-ai-agent-work'
        );
    });

    test('should redirect a legacy openai collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-openai-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-openai-powered-ai-agent-tools`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-openai-powered-ai-agent-tools'
        );
    });

    test('should redirect a legacy python collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-python-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-python-ai-agent-tools-developer-workflows`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-python-ai-agent-tools-developer-workflows'
        );
    });

    test('should redirect a legacy typescript collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-typescript-mcp-servers`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-typescript-ai-tools-developer-workflows`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-typescript-ai-tools-developer-workflows'
        );
    });

    test('should redirect a legacy vscode collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-mcp-for-vscode`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/vscode-compatible-skills`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/vscode-compatible-skills'
        );
    });

    test('should redirect a legacy 2026 mcp collection slug to the canonical workflow slug', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-mcp-servers-2026`);

        await expect(page).toHaveURL(`${devUrl}/en/collections/top-ai-agent-workflow-skills-integrations-2026`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://killer-skills.com/en/collections/top-ai-agent-workflow-skills-integrations-2026'
        );
    });

    test('should load a canonical collection detail page and verify schema and elements', async ({ page }) => {
        await page.goto(`${devUrl}/en/collections/top-ai-agent-integration-frameworks-bridges-infra-tooling`);

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
