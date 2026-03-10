import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';


export class AIGemsAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [AI Gems] Filling submission form`);

        await this.safeType(page, 'input#name', this.ctx.meta.name);
        await this.safeType(page, 'input#websiteUrl', this.ctx.meta.url);
        await this.safeType(page, 'textarea#submitterNote', this.ctx.meta.descriptions.short);

        this.log(`✅ [AI Gems] Form filled. Please check and click submit.`);
    }
}
