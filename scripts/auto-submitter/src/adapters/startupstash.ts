import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class StartupStashAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [StartupStash] Filling submission form`);

        // URL
        await this.safeType(page, 'input[name*="url"]', meta.url);

        // Name
        await this.safeType(page, 'input[name*="title"], input[name*="name"]', meta.name);

        // Tagline
        await this.safeType(page, 'input[name*="tagline"]', meta.tagline);

        // Description
        await this.safeType(page, 'textarea[name*="description"]', meta.descriptions.long);

        // Category search/select
        const categoryInput = page.locator('input[placeholder*="Category"]');
        if (await categoryInput.isVisible().catch(() => false)) {
            await categoryInput.fill('AI Tools');
            await page.keyboard.press('Enter');
        }

        await this.takeScreenshot('filling_progress');
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'pending_review';
    }
}
