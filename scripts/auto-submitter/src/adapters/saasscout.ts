import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class SaaSScoutAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [SaaS Scout] Filling submission form`);

        // URL
        await this.safeType(page, 'input[name*="url"]', meta.url);

        // Name
        await this.safeType(page, 'input[name*="name"]', meta.name);

        // Tagline / Short Desc
        await this.safeType(page, 'input[name*="tagline"], input[name*="headline"]', meta.tagline);

        // Description
        await this.safeType(page, 'textarea[name*="description"]', meta.descriptions.short);

        // Category
        const categorySelect = page.locator('select[name*="category"]');
        if (await categorySelect.isVisible().catch(() => false)) {
            await categorySelect.selectOption({ label: 'Developer Tools' });
        }

        // Email
        await this.safeType(page, 'input[type="email"]', meta.founder.email);

        await this.takeScreenshot('filling_progress');
        this.log(`  ✓ Form fields filled. Review and submit!`);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'pending_review';
    }
}
