import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';

export class SaaSHubAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [SaaSHub] Filling submission form`);

        // 第一步：输入 URL 并点击下一步
        await this.safeType(page, 'input[type="url"], input[name="url"]', this.ctx.meta.url);
        await this.safeClick(page, 'button[type="submit"]:has-text("Submit"), button:has-text("Add Product")');

        await page.waitForTimeout(3000);

        // 第二步：填写名称和描述 (如果还没填)
        await this.safeType(page, 'input#product_name', this.ctx.meta.name);
        await this.safeType(page, 'textarea#product_description', this.ctx.meta.descriptions.short);

        this.log(`✅ [SaaSHub] Form partially filled. Please select categories and competitors manually.`);
    }
}
