import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class DangAiAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [Dang.ai] Starting Modal submission flow`);

        // 1. Click "+" button on top right to open "Suggest a tool" Modal
        // The selector found by subagent: a.nav-link.primary.w-button
        const plusBtn = page.locator('a.nav-link.primary.w-button').first();
        await plusBtn.click();
        await page.waitForTimeout(2000);

        // 2. Fill Modal Fields
        await this.safeType(page, 'input#Name', meta.founder.name);
        await this.safeType(page, 'input#Email', meta.founder.email);
        await this.safeType(page, 'input#URL', meta.url);

        // 3. Select "Yes" for representative status
        // Use a more robust selector to avoid interception by the custom radio div
        await page.click('label:has-text("Yes")');

        this.log(`  ⚠️  Detection: reCAPTCHA is present. Manual resolution recommended.`);
        await this.takeScreenshot('filling_progress');
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        const text = await page.textContent('body');
        if (text?.toLowerCase().includes('thank you') || text?.toLowerCase().includes('success')) {
            return 'success';
        }
        await page.waitForTimeout(5000);
        return 'pending_review';
    }
}
