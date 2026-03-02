import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class StartupStashAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [StartupStash] Starting Typeform submission flow`);

        // 1. Initial Start
        const startBtn = page.locator('button:has-text("Get It Started"), button:has-text("Start")').first();
        if (await startBtn.isVisible()) {
            await startBtn.click();
            await page.waitForTimeout(2000);
        }

        // 2. Adaptive Step-by-Step Filling
        // Typeform usually shows one field at a time. We'll try to find the active field and map it.
        const fields = [
            { label: 'URL', value: meta.url },
            { label: 'Name', value: meta.name },
            { label: 'Tagline', value: meta.tagline },
            { label: 'Description', value: meta.descriptions.long },
            { label: 'Email', value: meta.founder.email }
        ];

        for (const field of fields) {
            this.log(`  🔍 [StartupStash] Trying to fill: ${field.label}`);

            // Look for visible input or textarea
            const input = page.locator('input:visible, textarea:visible').first();
            if (await input.isVisible()) {
                await input.fill(field.value);
                await page.waitForTimeout(500);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(2000); // Wait for transition
            } else {
                this.log(`  ⚠️  No visible input found for ${field.label}, skipping or manual check needed.`);
            }
        }

        await this.takeScreenshot('filling_progress');
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        // Typeform completion usually shows a "Thank you" screen
        const text = await page.textContent('body');
        if (text?.toLowerCase().includes('thank you') || text?.toLowerCase().includes('submitted')) {
            return 'success';
        }
        await page.waitForTimeout(5000);
        return 'pending_review'; // Optimistic fallback
    }
}
