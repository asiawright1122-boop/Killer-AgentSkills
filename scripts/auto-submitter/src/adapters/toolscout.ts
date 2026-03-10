import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';


export class ToolScoutAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [ToolScout] Filling submission form`);

        // Typical generic fields for AI/Tool directories
        await this.safeType(page, 'input[name*="name"], input[placeholder*="Name"]', this.ctx.meta.name);
        await this.safeType(page, 'input[name*="url"], input[type="url"]', this.ctx.meta.url);
        await this.safeType(page, 'textarea[name*="description"]', this.ctx.meta.descriptions.short);

        if (this.ctx.meta.founder.email) {
            await this.safeType(page, 'input[type="email"]', this.ctx.meta.founder.email);
        }

        this.log(`✅ [ToolScout] Form filled. Please check and click submit manually.`);
    }
}
