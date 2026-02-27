import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class HackerNewsAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [Hacker News] Preparing Show HN post`);

        // HN submission is a single form after login
        await this.safeType(page, 'input[name="title"]', `Show HN: ${meta.name} - ${meta.tagline}`);
        await this.safeType(page, 'input[name="url"]', meta.url);
        await this.safeType(page, 'textarea[name="text"]', meta.descriptions.short);

        await this.takeScreenshot('filling_progress');
        this.log(`  ⚠️ Note: HN is community-reviewed. Ensure your Show HN post follows guidelines.`);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'success'; // HN doesn't have a "review" status in the same way
    }
}
