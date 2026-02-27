import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class DofollowToolsAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [Dofollow.Tools] Filling submission form`);

        await this.safeType(page, 'input[name="url"]', this.ctx.meta.url);
        await this.safeClick(page, 'button:has-text("Submit"), button:has-text("Add")');

        // 通常第一步输入 URL 后会出现详细表单
        await page.waitForTimeout(2000);

        await this.safeType(page, 'input[name*="name"], input[name*="title"]', this.ctx.meta.name);
        await this.safeType(page, 'textarea[name*="description"]', this.ctx.meta.descriptions.short);

        this.log(`✅ [Dofollow.Tools] Form partially filled. Please complete the remaining fields manually.`);
    }
}
