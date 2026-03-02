import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class LaunchingNextAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        this.log(`  📝 [LaunchingNext] Filling submission form`);

        // Remove potential overlays/backdrops
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('#silktide-backdrop, #silktide-wrapper, .cookie-consent');
            overlays.forEach(el => (el as HTMLElement).style.display = 'none');
        }).catch(() => { });

        await this.safeType(page, 'input[name="startupname"]', meta.name);
        await this.safeType(page, 'input[name="startupurl"]', meta.url);
        await this.safeType(page, 'input[name="description"]', meta.tagline);
        await this.safeType(page, 'textarea[id="fulldescription"]', meta.descriptions.long);
        await this.safeType(page, 'textarea[name="tags"]', 'AI Agent, Coding Assistant, Automation');
        await this.safeType(page, 'input[name="user"]', meta.founder.name);
        await this.safeType(page, 'input[name="email"]', meta.founder.email);

        // Handle Math Quiz (e.g., "What is 2+3?")
        const mathLabel = await page.textContent('label:has-text("What is")');
        if (mathLabel) {
            const match = mathLabel.match(/(\d+)\s*\+\s*(\d+)/);
            if (match) {
                const result = parseInt(match[1], 10) + parseInt(match[2], 10);
                this.log(`  🧮 Solving math quiz: ${match[1]} + ${match[2]} = ${result}`);
                await page.fill('input[name="math"]', result.toString());
            }
        }

        await this.takeScreenshot('filling_progress');
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        const url = page.url();
        if (url.includes('thank-you') || url.includes('success')) {
            return 'pending_review';
        }
        await page.waitForTimeout(3000);
        return 'pending_review'; // Optimistic
    }
}
