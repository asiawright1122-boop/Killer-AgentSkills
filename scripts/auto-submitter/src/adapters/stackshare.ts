import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class StackShareAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [StackShare] Filling tool URL and name`);

        // StackShare submission often starts with a URL
        await this.safeType(page, 'input[placeholder*="URL"]', meta.url);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        // Name
        await this.safeType(page, 'input[name*="name"]', meta.name);

        // Tagline / Description
        await this.safeType(page, 'input[name*="tagline"]', meta.tagline);
        await this.safeType(page, 'textarea[name*="description"]', meta.descriptions.short);

        // Categories / Labels
        this.log(`  🏷️ [StackShare] Adding function/category`);
        const categoryInput = page.locator('input[placeholder*="Function"]');
        if (await categoryInput.isVisible().catch(() => false)) {
            await categoryInput.fill('Marketplace');
            await page.keyboard.press('Enter');
        }

        this.log(`  📸 Screenshot of progress captured`);
        await this.takeScreenshot('filling_progress');

        this.log(`  ⚠️ Note: StackShare may require manual verification of the "Official" status or more fields.`);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'pending_review';
    }
}
