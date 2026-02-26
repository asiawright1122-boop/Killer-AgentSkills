/**
 * GenericFormAdapter — 通用表单适配器
 *
 * 适用于大多数第一梯队导航站：
 * 这些站的提交页都是简单的 HTML 表单，字段名称虽各有不同，
 * 但基本都包含：名称、URL、描述、分类、定价。
 *
 * 策略：先通过常见的 selector 模式（name/id/placeholder/label）
 * 自动匹配字段并填充，再点击提交按钮。
 */

import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { SubmitStatus } from '../types.js';

export class GenericFormAdapter extends BaseAdapter {
    protected async fillForm(page: Page): Promise<void> {
        const meta = this.ctx.meta;

        // ── 1. 产品名称 ──
        await this.tryFillField(page, {
            names: ['name', 'tool_name', 'toolName', 'product_name', 'productName', 'title', 'tool-name'],
            placeholders: ['name', 'tool name', 'product name', 'title', 'enter name', 'your tool name'],
            labels: ['name', 'tool name', 'product name', 'title'],
            value: meta.name,
        });

        // ── 2. URL ──
        await this.tryFillField(page, {
            names: ['url', 'website', 'link', 'tool_url', 'toolUrl', 'website_url', 'product_url', 'site_url', 'homepage'],
            placeholders: ['url', 'website', 'https://', 'enter url', 'website url', 'tool url', 'your website'],
            labels: ['url', 'website', 'link', 'homepage'],
            value: meta.url,
        });

        // ── 3. 描述（短） ──
        await this.tryFillField(page, {
            names: ['description', 'desc', 'short_description', 'shortDescription', 'summary', 'tagline', 'about'],
            placeholders: ['description', 'describe', 'summary', 'tagline', 'about', 'tell us about', 'short description'],
            labels: ['description', 'summary', 'about', 'tagline'],
            value: meta.descriptions.short,
            isTextarea: true,
        });

        // ── 4. 长描述（如果有第二个 textarea） ──
        await this.tryFillField(page, {
            names: ['long_description', 'longDescription', 'full_description', 'details', 'content', 'body'],
            placeholders: ['detailed', 'full description', 'long description', 'more details'],
            labels: ['long description', 'full description', 'details'],
            value: meta.descriptions.long,
            isTextarea: true,
        });

        // ── 5. 邮箱 ──
        await this.tryFillField(page, {
            names: ['email', 'contact_email', 'contactEmail', 'contact'],
            placeholders: ['email', 'your email', 'contact email'],
            labels: ['email', 'contact'],
            value: meta.founder.email,
        });

        // ── 6. 定价 ──
        await this.trySelectField(page, {
            names: ['pricing', 'price', 'pricing_model', 'pricingModel', 'cost'],
            labels: ['pricing', 'price', 'cost'],
            options: ['Free', 'free', 'FREE', 'Freemium'],
        });

        // ── 7. 分类 ──
        await this.trySelectField(page, {
            names: ['category', 'categories', 'type', 'tool_type'],
            labels: ['category', 'type'],
            options: ['AI', 'Developer Tools', 'Productivity', 'ai', 'developer', 'tools', 'AI Tools'],
        });

        // ── 8. Logo 上传 ──
        await this.tryUploadFile(page, meta.assets.logo);

        // ── 9. 标签 ──
        await this.tryFillField(page, {
            names: ['tags', 'keywords'],
            placeholders: ['tags', 'keywords'],
            labels: ['tags', 'keywords'],
            value: meta.tags.join(', '),
        });

        // ── 10. GitHub / 社交链接 ──
        await this.tryFillField(page, {
            names: ['github', 'github_url', 'repo', 'repository'],
            placeholders: ['github', 'repository'],
            labels: ['github'],
            value: meta.links.github,
        });

        await this.tryFillField(page, {
            names: ['twitter', 'twitter_url', 'x_url'],
            placeholders: ['twitter', '@handle'],
            labels: ['twitter', 'x'],
            value: meta.founder.twitter,
        });

        // ── 11. 勾选 ToS / 协议 ──
        await this.tryCheckAgreement(page);

        // ── 12. 点击提交按钮 ──
        await this.clickSubmitButton(page);
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        await page.waitForTimeout(3000);

        const bodyText = await page.textContent('body') || '';
        const lower = bodyText.toLowerCase();

        // 检测成功信号
        const successSignals = [
            'thank', 'success', 'submitted', 'received',
            'review', 'approved', 'listed', 'pending',
            '感谢', '成功', '已提交', '审核',
        ];

        if (successSignals.some(s => lower.includes(s))) {
            return 'pending_review';
        }

        // 检测失败信号
        const failSignals = ['error', 'failed', 'invalid', 'required', '错误', '失败'];
        if (failSignals.some(s => lower.includes(s))) {
            return 'failed';
        }

        return 'pending_review';
    }

    // ─── 私有辅助 ─────────────────────────────────────

    private async tryFillField(page: Page, opts: {
        names: string[];
        placeholders: string[];
        labels: string[];
        value: string;
        isTextarea?: boolean;
    }) {
        if (!opts.value) return;

        const tag = opts.isTextarea ? 'textarea' : 'input';

        // 策略 1：通过 name / id 属性匹配
        for (const name of opts.names) {
            const selectors = [
                `${tag}[name="${name}"]`,
                `${tag}[id="${name}"]`,
                `${tag}[name*="${name}"]`,
                `${tag}[id*="${name}"]`,
            ];
            for (const sel of selectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                    const el = page.locator(sel).first();
                    if (await el.isVisible()) {
                        await el.click();
                        await el.fill(opts.value);
                        this.log(`  ✓ 填充 ${sel}`);
                        return;
                    }
                }
            }
        }

        // 策略 2：通过 placeholder 匹配
        for (const ph of opts.placeholders) {
            const sel = `${tag}[placeholder*="${ph}" i]`;
            const count = await page.locator(sel).count();
            if (count > 0) {
                const el = page.locator(sel).first();
                if (await el.isVisible()) {
                    await el.click();
                    await el.fill(opts.value);
                    this.log(`  ✓ 填充 placeholder~${ph}`);
                    return;
                }
            }
        }

        // 策略 3：通过 label 文本匹配
        for (const lbl of opts.labels) {
            try {
                const label = page.locator(`label`, { hasText: new RegExp(lbl, 'i') }).first();
                if (await label.count() > 0) {
                    const forAttr = await label.getAttribute('for');
                    if (forAttr) {
                        const target = page.locator(`#${forAttr}`);
                        if (await target.count() > 0 && await target.isVisible()) {
                            await target.click();
                            await target.fill(opts.value);
                            this.log(`  ✓ 填充 label[for=${forAttr}]`);
                            return;
                        }
                    }
                }
            } catch { /* continue */ }
        }

        // 如果是 textarea 且上面没匹配到，尝试第一个可见的 textarea
        if (opts.isTextarea) {
            const textareas = page.locator('textarea:visible');
            const count = await textareas.count();
            if (count > 0) {
                const el = textareas.first();
                const currentValue = await el.inputValue();
                if (!currentValue) {
                    await el.click();
                    await el.fill(opts.value);
                    this.log(`  ✓ 填充 fallback textarea`);
                    return;
                }
            }
        }
    }

    private async trySelectField(page: Page, opts: {
        names: string[];
        labels: string[];
        options: string[];
    }) {
        // 尝试 <select> 元素
        for (const name of opts.names) {
            const selectors = [
                `select[name="${name}"]`,
                `select[id="${name}"]`,
                `select[name*="${name}"]`,
            ];
            for (const sel of selectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                    // 尝试每个选项值
                    for (const opt of opts.options) {
                        try {
                            await page.selectOption(sel, { label: opt });
                            this.log(`  ✓ 选择 ${sel} = ${opt}`);
                            return;
                        } catch { /* try next option */ }
                        try {
                            await page.selectOption(sel, { value: opt.toLowerCase() });
                            this.log(`  ✓ 选择 ${sel} = ${opt}`);
                            return;
                        } catch { /* try next option */ }
                    }
                }
            }
        }
    }

    private async tryUploadFile(page: Page, assetPath: string) {
        if (!assetPath) return;

        const uploadSelectors = [
            'input[type="file"]',
            'input[accept*="image"]',
            'input[name*="logo"]',
            'input[name*="image"]',
            'input[name*="icon"]',
            'input[name*="avatar"]',
            'input[id*="logo"]',
            'input[id*="image"]',
        ];

        for (const sel of uploadSelectors) {
            const count = await page.locator(sel).count();
            if (count > 0) {
                await this.safeUpload(page, sel, assetPath);
                this.log(`  ✓ 上传文件 ${sel}`);
                return;
            }
        }
    }

    private async tryCheckAgreement(page: Page) {
        const checkboxSelectors = [
            'input[type="checkbox"][name*="agree"]',
            'input[type="checkbox"][name*="terms"]',
            'input[type="checkbox"][name*="tos"]',
            'input[type="checkbox"][name*="accept"]',
            'input[type="checkbox"][name*="consent"]',
            'input[type="checkbox"][id*="agree"]',
            'input[type="checkbox"][id*="terms"]',
        ];

        for (const sel of checkboxSelectors) {
            const count = await page.locator(sel).count();
            if (count > 0) {
                const checkbox = page.locator(sel).first();
                if (!(await checkbox.isChecked())) {
                    await checkbox.check();
                    this.log(`  ✓ 勾选协议 ${sel}`);
                }
                return;
            }
        }

        // Fallback: 查找包含 "agree" 或 "terms" 文字的 checkbox
        const allCheckboxes = page.locator('input[type="checkbox"]');
        const count = await allCheckboxes.count();
        for (let i = 0; i < count; i++) {
            const cb = allCheckboxes.nth(i);
            const parent = cb.locator('xpath=..');
            const parentText = (await parent.textContent() || '').toLowerCase();
            if (parentText.includes('agree') || parentText.includes('terms') || parentText.includes('accept')) {
                if (!(await cb.isChecked())) {
                    await cb.check();
                    this.log(`  ✓ 勾选协议 (fallback)`);
                }
                return;
            }
        }
    }

    private async clickSubmitButton(page: Page) {
        // 策略 1：type="submit" 按钮
        const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
        if (await submitBtn.count() > 0) {
            const btn = submitBtn.first();
            if (await btn.isVisible()) {
                await btn.click();
                this.log(`  ✓ 点击 submit 按钮`);
                return;
            }
        }

        // 策略 2：按文本匹配
        const submitTexts = ['Submit', 'submit', 'Send', 'Add', 'Post', 'List', 'Submit Tool', 'Submit Your Tool', 'Add Tool', 'Add Your Tool'];
        for (const text of submitTexts) {
            const btn = page.locator(`button`, { hasText: text });
            if (await btn.count() > 0) {
                const el = btn.first();
                if (await el.isVisible()) {
                    await el.click();
                    this.log(`  ✓ 点击按钮 "${text}"`);
                    return;
                }
            }
        }

        // 策略 3：表单内最后一个按钮
        const formBtns = page.locator('form button');
        const count = await formBtns.count();
        if (count > 0) {
            await formBtns.last().click();
            this.log(`  ✓ 点击表单末尾按钮`);
            return;
        }

        this.log(`  ⚠️ 未找到提交按钮`);
    }
}
