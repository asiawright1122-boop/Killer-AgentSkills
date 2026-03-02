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
import type { SubmitStatus, ProductMeta } from '../types.js';

export class GenericFormAdapter extends BaseAdapter {
    private filledCount = 0;
    private submitClicked = false;
    private urlBeforeSubmit = '';

    protected async fillForm(page: Page): Promise<void> {
        this.filledCount = 0;
        this.submitClicked = false;
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

        // ── 11. 智能回退：如果标准匹配未填写任何字段，扫描表单进行启发式填写 ──
        if (this.filledCount === 0) {
            await this.fallbackSmartFill(page, meta);
        }

        // ── 12. 勾选 ToS / 协议 ──
        await this.tryCheckAgreement(page);

        // ── 13. 点击提交按钮 ──
        await this.clickSubmitButton(page);
    }

    /**
     * 智能回退填写：当标准选择器都无法匹配时，
     * 扫描表单中所有可见的空 input/textarea，根据上下文推测字段用途并填入数据。
     */
    private async fallbackSmartFill(page: Page, meta: ProductMeta) {
        this.log(`  🔄 启动智能回退填写...`);

        // 找到主表单
        const forms = page.locator('form');
        const formCount = await forms.count();
        if (formCount === 0) return;

        // 取第一个有 input 的表单
        let targetForm = forms.first();
        for (let i = 0; i < formCount; i++) {
            const f = forms.nth(i);
            const inputs = await f.locator('input:visible, textarea:visible').count();
            if (inputs >= 2) { targetForm = f; break; }
        }

        // 扫描表单内所有可见空字段
        const inputs = targetForm.locator('input:visible:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"])');
        const textareas = targetForm.locator('textarea:visible');

        const inputCount = await inputs.count();
        const taCount = await textareas.count();

        if (inputCount === 0 && taCount === 0) return;

        // 准备一个值队列：按优先级匹配
        const valueMap: Array<{ keywords: string[]; value: string; used: boolean }> = [
            { keywords: ['name', 'tool', 'product', 'title', 'app'], value: meta.name, used: false },
            { keywords: ['url', 'website', 'link', 'http', 'site', 'domain'], value: meta.url, used: false },
            { keywords: ['email', 'mail', 'contact'], value: meta.founder.email, used: false },
            { keywords: ['tagline', 'slogan', 'short', 'one-liner'], value: meta.tagline, used: false },
            { keywords: ['github', 'repo', 'source', 'code'], value: meta.links.github, used: false },
            { keywords: ['twitter', 'x.com', 'social'], value: meta.founder.twitter, used: false },
        ];

        // 处理 input 字段
        for (let i = 0; i < inputCount; i++) {
            const input = inputs.nth(i);
            const currentVal = await input.inputValue().catch(() => '');
            if (currentVal) continue; // 已有值，跳过

            // 收集字段线索
            const attrs = await Promise.all([
                input.getAttribute('name'),
                input.getAttribute('id'),
                input.getAttribute('placeholder'),
                input.getAttribute('type'),
                input.getAttribute('aria-label'),
            ]);
            const clue = (attrs.filter(Boolean).join(' ') || '').toLowerCase();

            // 尝试用相邻 label 获取更多线索
            let labelClue = '';
            try {
                const id = await input.getAttribute('id');
                if (id) {
                    labelClue = (await page.locator(`label[for="${id}"]`).first().textContent() || '').toLowerCase();
                }
            } catch { }
            const allClues = clue + ' ' + labelClue;

            // 匹配值
            let filled = false;
            for (const vm of valueMap) {
                if (vm.used || !vm.value) continue;
                if (vm.keywords.some(k => allClues.includes(k))) {
                    await input.click();
                    await input.fill(vm.value);
                    vm.used = true;
                    this.filledCount++;
                    this.log(`  ✓ [回退] 填充 ${attrs[0] || attrs[1] || '?'} = ${vm.value.substring(0, 30)}...`);
                    filled = true;
                    break;
                }
            }

            // 如果是 email 类型，直接填邮箱
            if (!filled && attrs[3] === 'email') {
                await input.click();
                await input.fill(meta.founder.email);
                this.filledCount++;
                this.log(`  ✓ [回退] 填充 email type`);
            }
            // 如果是 url 类型，直接填 URL
            else if (!filled && attrs[3] === 'url') {
                await input.click();
                await input.fill(meta.url);
                this.filledCount++;
                this.log(`  ✓ [回退] 填充 url type`);
            }
        }

        // 处理 textarea 字段
        for (let i = 0; i < taCount; i++) {
            const ta = textareas.nth(i);
            const currentVal = await ta.inputValue().catch(() => '');
            if (currentVal) continue;

            const attrs = await Promise.all([
                ta.getAttribute('name'),
                ta.getAttribute('id'),
                ta.getAttribute('placeholder'),
            ]);
            const clue = (attrs.filter(Boolean).join(' ') || '').toLowerCase();

            // textarea 通常是描述字段
            const descValue = clue.includes('long') || clue.includes('detail') || clue.includes('content')
                ? meta.descriptions.long
                : meta.descriptions.short;

            await ta.click();
            await ta.fill(descValue);
            this.filledCount++;
            this.log(`  ✓ [回退] 填充 textarea ${attrs[0] || attrs[1] || '?'}`);
        }

        if (this.filledCount > 0) {
            this.log(`  🔄 智能回退完成，共填写 ${this.filledCount} 个字段`);
        }
    }

    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        // ── 预检：如果根本没填写任何字段，直接判定失败 ──
        if (this.filledCount === 0) {
            this.log(`  ❌ 未填写任何字段，判定为无效页面`);
            return 'failed';
        }

        // ── 预检：如果没有找到/点击提交按钮，也判定失败 ──
        if (!this.submitClicked) {
            this.log(`  ❌ 未找到提交按钮，判定为提交失败`);
            return 'failed';
        }

        await page.waitForTimeout(3000);

        // ── 检查 1: URL 是否发生了跳转（常见的成功信号） ──
        const currentUrl = page.url();
        const urlChanged = currentUrl !== this.urlBeforeSubmit;
        if (urlChanged) {
            this.log(`  🔀 URL 跳转: ${this.urlBeforeSubmit} → ${currentUrl}`);
        }

        // ── 检查 2: 页面内容分析 ──
        const bodyText = await page.textContent('body') || '';
        const lower = bodyText.toLowerCase();

        // 强失败信号 —— 只在页面标题/H1中检测，避免误判正常页面内容
        const titleText = (await page.title() || '').toLowerCase();
        let h1Text = '';
        try { h1Text = (await page.locator('h1').first().textContent() || '').toLowerCase(); } catch { }
        const headerText = titleText + ' ' + h1Text;

        const strongFailInHeader = ['captcha', 'recaptcha', 'access denied', 'forbidden', 'sign in', 'log in', 'login required'];
        if (strongFailInHeader.some(s => headerText.includes(s))) {
            this.log(`  ❌ 检测到强失败信号（标题/H1）`);
            return 'failed';
        }

        // 检测验证码元素（精确检测，不依赖文本）
        const hasCaptcha = await page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, .h-captcha, [data-sitekey]').count() > 0;
        if (hasCaptcha) {
            this.log(`  ❌ 检测到验证码元素`);
            return 'failed';
        }

        // 成功信号（扩展了更多常见的成功提示）
        const successSignals = [
            'thank you', 'thanks for', 'successfully submitted', 'submission received',
            'we will review', 'under review', 'has been submitted', 'listing pending',
            'successfully added', 'tool has been added', 'submission successful',
            'we have received', 'will be reviewed', 'added successfully',
            'your submission', 'tool submitted', 'submission complete',
            '感谢提交', '提交成功', '审核中', '已收到',
        ];

        if (successSignals.some(s => lower.includes(s))) {
            this.log(`  ✅ 检测到成功信号`);
            return 'pending_review';
        }

        // ── 检查 3: 表单是否仍然存在（成功提交后通常表单会消失） ──
        const formStillExists = await page.locator('form').count() > 0;
        if (urlChanged && !formStillExists) {
            this.log(`  ✅ URL已跳转且表单已消失，判定为成功`);
            return 'pending_review';
        }

        // 如果 URL 跳转了，大概率成功
        if (urlChanged) {
            this.log(`  ⏳ URL已跳转，标记为待审核`);
            return 'pending_review';
        }

        // 弱失败信号 —— 只在填写了足够字段时才检查
        const failSignals = ['is required', 'field is required', 'please fill', 'cannot be empty'];
        if (failSignals.some(s => lower.includes(s))) {
            this.log(`  ❌ 检测到表单验证失败信号`);
            return 'failed';
        }

        // ── 乐观回退：如果填了 ≥2 个字段且点了提交，乐观标记为成功 ──
        // 很多小型导航站提交后页面不变化，也不提示，但实际已经将数据存入后台
        if (this.filledCount >= 2) {
            this.log(`  ⏳ 已填写${this.filledCount}个字段并点击提交，乐观标记为待审核`);
            return 'pending_review';
        }

        // 默认失败
        this.log(`  ❌ 无法确认提交结果，标记为失败`);
        return 'failed';
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
                        this.filledCount++;
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
                    this.filledCount++;
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
                            this.filledCount++;
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
                    this.filledCount++;
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

    protected async clickSubmitButton(page: Page) {
        if (this.ctx.dryRun) {
            this.log(`  [Dry Run] 跳过点击提交按钮`);
            return;
        }

        // 记录提交前的 URL，供 afterSubmit 比对
        this.urlBeforeSubmit = page.url();

        // 策略 1：type="submit" 按钮
        const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
        if (await submitBtn.count() > 0) {
            const btn = submitBtn.first();
            if (await btn.isVisible()) {
                await btn.click();
                this.submitClicked = true;
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
                    this.submitClicked = true;
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
            this.submitClicked = true;
            this.log(`  ✓ 点击表单末尾按钮`);
            return;
        }

        this.submitClicked = false;
        this.log(`  ⚠️ 未找到提交按钮`);
    }
}
