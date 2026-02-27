/**
 * BaseAdapter — 所有站点适配器的抽象基类
 *
 * 每个导航站实现一个子类，只需要覆写 fillForm() 和可选的 afterSubmit()。
 * 基类负责：浏览器启动、截图、超时、错误处理、重试、日志。
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { AdapterContext, SiteConfig, SubmitResult, SubmitStatus } from './types.js';

export abstract class BaseAdapter {
    protected config: SiteConfig;
    protected ctx: AdapterContext;
    protected browser: Browser | null = null;
    protected context: BrowserContext | null = null;
    protected page: Page | null = null;

    protected chromeProcess: ChildProcess | null = null;

    constructor(config: SiteConfig, ctx: AdapterContext) {
        this.config = config;
        this.ctx = ctx;
    }

    /** 子类实现：填写表单并点击提交 */
    protected abstract fillForm(page: Page): Promise<void>;

    /** 子类可选覆写：提交后的验证（检查是否成功） */
    protected async afterSubmit(page: Page): Promise<SubmitStatus> {
        // 默认：等待 3 秒看看有没有成功提示
        await page.waitForTimeout(3000);
        return 'pending_review';
    }

    /** 主执行方法 */
    async execute(): Promise<SubmitResult> {
        const start = Date.now();
        const result: SubmitResult = {
            site: this.config.name,
            url: this.config.submitUrl,
            status: 'failed',
            message: '',
            duration: 0,
            timestamp: new Date().toISOString(),
        };

        try {
            this.log(`🚀 开始提交到 ${this.config.name} (${this.config.submitUrl})`);

            // 启动浏览器
            await this.launchBrowser();

            // 如果是 dry run，截图后退出
            if (this.ctx.dryRun) {
                await this.page!.goto(this.config.submitUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: this.ctx.timeout,
                });
                await this.takeScreenshot('dryrun');
                result.status = 'skipped';
                result.message = 'Dry run — 仅截图，未实际提交';
                this.log(`⏭️  Dry run 完成`);
                return result;
            }

            // 打开提交页
            await this.page!.goto(this.config.submitUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.ctx.timeout,
            });
            await this.page!.waitForTimeout(2000); // 等待页面稳定

            // 截图：填写前
            await this.takeScreenshot('before');

            // 填写表单
            await this.fillForm(this.page!);
            this.log(`📝 表单填写完成`);

            // 截图：填写后
            await this.takeScreenshot('after');

            // 验证提交结果
            const status = await this.afterSubmit(this.page!);
            result.status = status;

            // 截图：提交后
            await this.takeScreenshot('result');

            result.message = status === 'success'
                ? '✅ 提交成功'
                : status === 'pending_review'
                    ? '⏳ 已提交，等待审核'
                    : '❌ 提交失败';

            this.log(`${result.message}`);

        } catch (err: any) {
            result.status = 'failed';
            result.message = `❌ 错误: ${err.message}`;
            this.log(`❌ 提交失败: ${err.message}`);

            // 失败时也截个图方便调试
            try {
                await this.takeScreenshot('error');
            } catch { /* ignore */ }
        } finally {
            if (this.ctx.userDataDir && !this.ctx.dryRun) {
                this.log(`🛑 半自动模式: 表单已尽力填写（或在等待您验证）。请您进行最终检查，并手动点击 Submit 按钮。`);
                this.log(`💡 浏览器将保持开启最长 5 分钟，完成后您可以直接关闭它。`);
                try {
                    // 最长保活 5 分钟，或者等页面被手动关掉
                    let waited = 0;
                    while (waited < 300000) {
                        if (this.page?.isClosed()) break;
                        await this.page?.waitForTimeout(5000);
                        waited += 5000;
                    }
                } catch { /* ignore */ }
            }

            result.duration = Date.now() - start;
            result.screenshot = this.getScreenshotPath('result');
            await this.closeBrowser();
        }

        return result;
    }

    // ─── 辅助方法 ───────────────────────────────

    /** 启动浏览器 */
    private async launchBrowser() {
        if (this.ctx.userDataDir) {
            // 半自动模式：原生启动 Chrome 并通过 CDP 连接
            const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            if (!fs.existsSync(chromePath)) {
                throw new Error(`找不到原生的 Google Chrome 浏览器，期望路径: ${chromePath}`);
            }

            const port = 9222;
            this.log(`🔌 正在通过原生端口 ${port} 启动并接管真实的 Google Chrome...`);

            this.chromeProcess = spawn(chromePath, [
                `--remote-debugging-port=${port}`,
                `--user-data-dir=${this.ctx.userDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-features=AutomationControlled'
            ], {
                detached: true,
                stdio: 'ignore'
            });
            this.chromeProcess.unref();

            // 循环尝试连接 CDP (最多 10 遍)
            let connected = false;
            for (let i = 0; i < 10; i++) {
                try {
                    await new Promise(r => setTimeout(r, 1000));
                    this.browser = await chromium.connectOverCDP(`http://localhost:${port}`);
                    this.context = this.browser.contexts()[0];
                    connected = true;
                    this.log(`✅ 成功连接到浏览器 CDP 端口`);
                    break;
                } catch {
                    this.log(`⏳ 正在等待浏览器启动并开放端口 (尝试 ${i + 1}/10)...`);
                }
            }

            if (!connected || !this.context) {
                throw new Error('无法连接到原生的 Google Chrome 浏览器调试端口');
            }

            // 永远生成一个新的前台 Tab，避免原有空页面失控
            this.page = await this.context.newPage();

            // 关掉启动时默认出来的附带空页面
            const allPages = this.context.pages();
            for (const p of allPages) {
                if (p !== this.page && p.url() === 'about:blank') {
                    await p.close().catch(() => { });
                }
            }

            // 确保页面被带到最前面
            await this.page.bringToFront();
        } else {
            // 全自动模式：无痕/普通的隔离上下文
            this.browser = await chromium.launch({
                headless: this.ctx.headless,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                ],
            });

            const authPath = path.join(this.ctx.assetsDir, '..', 'auth.json');
            if (fs.existsSync(authPath)) {
                this.context = await this.browser.newContext({
                    storageState: authPath,
                    userAgent: this.getRandomUA(),
                    viewport: { width: 1280, height: 800 },
                });
            } else {
                this.context = await this.browser.newContext({
                    userAgent: this.getRandomUA(),
                    viewport: { width: 1280, height: 800 },
                });
            }

            this.page = await this.context.newPage();
        }
    }

    /** 关闭浏览器 */
    private async closeBrowser() {
        try {
            await this.page?.close();
            if (this.browser) {
                await this.browser.close();
            } else {
                await this.context?.close();
            }
            if (this.chromeProcess) {
                this.chromeProcess.kill();
            }
        } catch { /* ignore */ }
    }

    /** 截图 */
    protected async takeScreenshot(phase: string): Promise<string> {
        const dir = this.ctx.screenshotDir;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filename = `${this.config.id}_${phase}_${Date.now()}.png`;
        const filepath = path.join(dir, filename);

        await this.page?.screenshot({ path: filepath, fullPage: true });
        return filepath;
    }

    private getScreenshotPath(phase: string): string {
        return path.join(this.ctx.screenshotDir, `${this.config.id}_${phase}_*.png`);
    }

    /** 日志 */
    protected log(msg: string) {
        const ts = new Date().toLocaleTimeString('zh-CN');
        console.log(`[${ts}] [${this.config.id}] ${msg}`);
    }

    /** 安全填充 input */
    protected async safeType(page: Page, selector: string, text: string) {
        try {
            const el = page.locator(selector).first();
            const timeout = this.ctx.userDataDir ? 30000 : 5000;
            await el.waitFor({ state: 'visible', timeout });
            await el.click();
            await el.fill(text);
        } catch (e: any) {
            this.log(`⚠️  填充 ${selector} 失败: ${e.message}`);
        }
    }

    /** 安全点击 */
    protected async safeClick(page: Page, selector: string) {
        try {
            const el = page.locator(selector).first();
            const timeout = this.ctx.userDataDir ? 30000 : 5000;
            await el.waitFor({ state: 'visible', timeout });
            await el.click();
        } catch (e: any) {
            this.log(`⚠️  点击 ${selector} 失败: ${e.message}`);
        }
    }

    /** 安全选择下拉 */
    protected async safeSelect(page: Page, selector: string, value: string) {
        try {
            const el = page.locator(selector).first();
            const timeout = this.ctx.userDataDir ? 30000 : 5000;
            await el.waitFor({ state: 'visible', timeout });
            await page.selectOption(selector, { label: value });
        } catch {
            // 如果 select 不行，尝试用 click 方式
            try {
                await this.safeClick(page, selector);
                await page.waitForTimeout(500);
                await page.getByText(value, { exact: false }).first().click();
            } catch (e: any) {
                this.log(`⚠️  选择 ${selector} = ${value} 失败: ${e.message}`);
            }
        }
    }

    /** 安全上传文件 */
    protected async safeUpload(page: Page, selector: string, filePath: string) {
        const resolvedPath = path.resolve(this.ctx.assetsDir, filePath);
        if (!fs.existsSync(resolvedPath)) {
            this.log(`⚠️  文件不存在: ${resolvedPath}`);
            return;
        }
        try {
            const input = page.locator(selector).first();
            await input.setInputFiles(resolvedPath);
        } catch (e: any) {
            this.log(`⚠️  上传 ${selector} 失败: ${e.message}`);
        }
    }

    /** 随机 User Agent */
    private getRandomUA(): string {
        const uas = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ];
        return uas[Math.floor(Math.random() * uas.length)];
    }
}
