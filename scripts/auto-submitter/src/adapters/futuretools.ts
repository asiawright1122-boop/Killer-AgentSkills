import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';

export class FutureToolsAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [FutureTools] Filling submission form`);

        // 基础信息
        await this.safeType(page, 'input#Tool-Name', this.ctx.meta.name);
        await this.safeType(page, 'input#Tool-URL', this.ctx.meta.url);
        await this.safeType(page, 'input#name', this.ctx.meta.founder.name);
        await this.safeType(page, 'input#email', this.ctx.meta.founder.email);

        // 分类/标签
        if (this.ctx.meta.tags && this.ctx.meta.tags.length > 0) {
            await this.safeType(page, 'input#Tags', this.ctx.meta.tags.join(', '));
        }

        // 价格模型
        await this.safeSelect(page, 'select#Pricing-Model', 'Freemium');

        // 描述
        await this.safeType(page, 'textarea#Tool-Description', this.ctx.meta.descriptions.long);

        this.log(`✅ [FutureTools] Form filled. Please click submit manually in the browser.`);
    }
}
