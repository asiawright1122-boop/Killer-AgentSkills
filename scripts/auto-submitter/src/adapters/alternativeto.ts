import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class AlternativeToAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [Step 1] Filling primary info: Name and URL`);

        // Step 1: Name and Primary URL
        await this.safeType(page, 'input[placeholder*="Name of the app"]', meta.name);
        await this.safeType(page, 'input[placeholder*="https://"]', meta.url);

        // Wait for potential validation
        await page.waitForTimeout(1000);

        this.log(`  🏷️ [Step 1] Selecting license and pricing`);
        // Pricing / License
        // AlternativeTo usually has radios or selects. Let's try to pick "Open Source" if possible, or "Free"
        const licenseSelect = page.locator('select[name="licenseId"]');
        if (await licenseSelect.isVisible().catch(() => false)) {
            await licenseSelect.selectOption({ label: 'Open Source' });
        }

        const pricingSelect = page.locator('select[name="pricingModelId"]');
        if (await pricingSelect.isVisible().catch(() => false)) {
            await pricingSelect.selectOption({ label: 'Free' });
        }

        // Description
        this.log(`  📝 [Step 1] Filling tagline and description`);
        await this.safeType(page, 'input[name="shortDescription"]', meta.tagline);
        await this.safeType(page, 'textarea[name="description"]', meta.descriptions.long);

        // Next Step
        const nextBtn = page.locator('button:has-text("Next"), button[type="submit"]').first();
        if (await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click();
            await page.waitForTimeout(2000);
        }

        // Step 2: Categories (if reachable)
        this.log(`  📂 [Step 2] Attempting to select tags/categories`);
        const tagInput = page.locator('input[placeholder*="Add a tag"]');
        if (await tagInput.isVisible().catch(() => false)) {
            for (const tag of meta.tags.slice(0, 3)) {
                await tagInput.fill(tag);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(500);
            }
        }

        // Screenshot to help user if it stops here
        await this.takeScreenshot('filling_progress');

        this.log(`  ⚠️ Note: AlternativeTo may require category confirmation or more detail. Final check needed.`);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        const content = await page.textContent('body') || '';
        if (content.toLowerCase().includes('success') || content.toLowerCase().includes('thank')) {
            return 'pending_review';
        }
        return 'pending_review'; // Usually AlternativeTo is always pending
    }
}
