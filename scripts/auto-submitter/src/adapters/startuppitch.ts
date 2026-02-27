import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class StartupPitchAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [The Startup Pitch] Filling submission form`);

        await this.safeType(page, 'input[name*="startup-name"]', meta.name);
        await this.safeType(page, 'input[name*="url"]', meta.url);
        await this.safeType(page, 'textarea[name*="elevator-pitch"]', meta.tagline);
        await this.safeType(page, 'textarea[name*="description"]', meta.descriptions.long);

        // Founder details
        await this.safeType(page, 'input[name*="founder-name"]', meta.founder.name);
        await this.safeType(page, 'input[name*="founder-email"]', meta.founder.email);

        await this.takeScreenshot('filling_progress');
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);
        return 'pending_review';
    }
}
