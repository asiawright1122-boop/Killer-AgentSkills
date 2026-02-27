import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, SiteConfig, SubmitStatus } from '../types.js';

export class ProductHuntAdapter extends BaseAdapter {
    constructor(config: SiteConfig, ctx: AdapterContext) {
        super(config, ctx);
    }

    protected async fillForm(page: Page): Promise<void> {
        // 等待重定向到最终发布表单
        try {
            await page.waitForTimeout(3000);

            // 如果还停留在拦截页，直接抛错
            if (page.url().includes('how-can-i-get-access-to-post')) {
                throw new Error('权限不足: 账号注册未满7天或为公司账号，无法提交。');
            }

            // 填写基本信息
            // 假设页面上可能存在对应的 placeholder 或 label 可以定位
            const spintax = (this.ctx as any).spintax;
            await this.safeType(page, 'input[placeholder="Simply the name of the launch"], input[name="name"]', spintax.name);
            await this.safeType(page, 'input[placeholder="Concise and descriptive tagline for the launch"], input[name="tagline"]', spintax.tagline);
            await this.safeType(page, 'input[placeholder="https://"], input[name="url"], input[type="url"]', spintax.url);

            // X account (Twitter)
            await this.safeType(page, 'input[placeholder="@launch"], input[name="twitter"]', spintax.twitter || '');

        } catch (e: any) {
            this.log(`⚠️ ProductHunt 表单提取异常: ${e.message}`);
            throw e;
        }
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        // 由于是 Tier 3 高优平台，且提交流程极其复杂（需验证、截图、定价等），
        // 脚本的终点设定为“帮用户填完第一屏，交给用户自行把控最后提交”。
        return 'pending_review';
    }
}
