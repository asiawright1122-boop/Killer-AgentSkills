import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class BetalistAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [Betalist] Filling primary startup info`);

        // Step 1: URL
        await this.safeType(page, 'input[placeholder*="URL"]', meta.url);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        // Name and Tagline
        await this.safeType(page, 'input[name*="name"]', meta.name);
        await this.safeType(page, 'input[name*="tagline"]', meta.tagline);

        // Description
        await this.safeType(page, 'textarea[name*="description"]', meta.descriptions.long);

        this.log(`  📂 [Betalist] Selecting categories/topics`);
        // Topics selection is usually a search-and-click or multi-select
        const topicsInput = page.locator('input[placeholder*="topic"]');
        if (await topicsInput.isVisible().catch(() => false)) {
            await topicsInput.fill('AI');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
            await topicsInput.fill('Marketplace');
            await page.keyboard.press('Enter');
        }

        await this.takeScreenshot('filling_progress');
        this.log(`  ⚠️ Note: Betalist submission involves strict review. Ensure screenshots look correct.`);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'pending_review';
    }
}
