import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class AIDirectoryAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        this.log(`📝 [AI Directory] Filling submission form`);

        await this.safeType(page, 'input#name', this.ctx.meta.name);
        await this.safeType(page, 'input#websiteUrl', this.ctx.meta.url);
        await this.safeType(page, 'textarea#submitterNote', this.ctx.meta.descriptions.long);
        await this.safeType(page, 'input#contactEmail', this.ctx.meta.founder.email);

        this.log(`✅ [AI Directory] Form filled. Please check and click submit.`);
    }
}
