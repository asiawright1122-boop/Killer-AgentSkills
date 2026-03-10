import type { Page } from 'playwright';
import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, SiteConfig, SubmitStatus } from '../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class ProductHuntAdapter extends BaseAdapter {
    constructor(config: SiteConfig, ctx: AdapterContext) {
        super(config, ctx);
    }

    protected async fillForm(page: Page): Promise<void> {
        // 等待重定向到最终发布表单
        try {
            // 如果还停留在拦截页，直接抛错
            if (page.url().includes('how-can-i-get-access-to-post')) {
                throw new Error('权限不足: 账号注册未满7天或为公司账号，无法提交。');
            }
            // ====== 第一步：填写 URL 并点击 Get started ======
            const meta = this.ctx.meta;
            const urlInput = page.locator('input[name="url"]');
            if (await urlInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                this.log(`  📝 [第一步] 填写 URL: ${meta.url}`);

                // 使用底层注入，确保不会跟 PH 原生的 https:// 前缀打架
                await page.evaluate((data) => {
                    const el = document.querySelector('input[name="url"]') as HTMLInputElement;
                    if (el) {
                        const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
                        const prototype = Object.getPrototypeOf(el);
                        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                        if (valueSetter && valueSetter !== prototypeValueSetter) {
                            prototypeValueSetter?.call(el, data.url);
                        } else {
                            valueSetter?.call(el, data.url);
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, { url: meta.url });

                await page.screenshot({ path: 'ph_step1_filled.png' }).catch(() => { });

                // 等待按钮亮起并检查是否真的可用
                const nextBtn = page.locator('button[data-test="next-step"]');
                await nextBtn.waitFor({ state: 'visible', timeout: 5000 });

                // 强制触发点击
                await nextBtn.evaluate((btn: HTMLButtonElement) => {
                    btn.disabled = false;
                    btn.click();
                }).catch(() => { });

                this.log(`  ✓ 已填写 URL 并尝试进入下一步`);
            } else {
                this.log(`  ⚠️ 未找到第一步的 URL 输入框，可能已经跳过了这一步... 尝试继续。`);
            }

            // ====== 第二步：等待核心表单渲染然后填写详情 ======
            this.log(`  ⏳ 正在等待下一步表单渲染...`);
            // 等待页面跳转或 DOM 刷新找到 Name 标签
            await page.waitForFunction(() => {
                const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === 'Name of the launch' && e.children.length === 0);
                return !!el;
            }, { timeout: 15000 }).catch(async () => {
                this.log(`  ⚠️ 等待 "Name of the launch" 超时。正在保存截图诊断...`);
                await page.screenshot({ path: 'ph_step2_error.png', fullPage: true }).catch(() => { });
            });

            this.log(`  📝 [第二步] 注入 Name, Tagline, Description, Twitter 等详情 (使用 Native 模拟模式)`);
            await page.waitForTimeout(2000); // 确保 React 动画完成

            const fillNative = async (selector: string, value: string) => {
                await page.evaluate(({ sel, val }) => {
                    const el = document.querySelector(sel) as HTMLInputElement;
                    if (el) {
                        const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
                        const prototype = Object.getPrototypeOf(el);
                        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                        if (valueSetter && valueSetter !== prototypeValueSetter) {
                            prototypeValueSetter?.call(el, val);
                        } else {
                            valueSetter?.call(el, val);
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, { sel: selector, val: value });
            };

            // 修正产品名：优先使用用户指定的 Killer-Skills
            const targetName = 'Killer-Skills';
            this.log(`  📝 [第二步] 填充产品名称: ${targetName}`);
            await fillNative('input[name="name"]', targetName);
            await fillNative('input[name="tagline"]', meta.tagline);

            // 填写 Launch Tags (极其重要，否则 Next 按钮不亮)
            this.log(`  🏷️ [第二步] 尝试正式选择 Launch Tags...`);
            const tagInput = page.locator('input[placeholder*="Select a launch tag"], input[placeholder*="search for a tag"]');
            if (await tagInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await tagInput.click({ force: true });
                await tagInput.fill('');
                await tagInput.fill('Artificial Intelligence');
                await page.waitForTimeout(2000);

                // 尝试点击下拉联想项 (提高优先级)
                const dropdownItem = page.locator('ul[role="listbox"] li, li[role="option"], [data-test="tag-result"]').first();
                if (await dropdownItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                    this.log(`  🏷️ [第二步] 找到下拉项，进行点击提交...`);
                    await dropdownItem.click();
                } else {
                    this.log(`  🏷️ [第二步] 未见下拉项，尝试 ArrowDown + Enter 强行提交...`);
                    await page.keyboard.press('ArrowDown');
                    await page.waitForTimeout(500);
                    await page.keyboard.press('Enter');
                }

                await page.waitForTimeout(1000);
            }

            const desc = page.locator('textarea[name="description"]');
            if (await desc.isVisible().catch(() => false)) {
                await desc.fill(meta.descriptions.short);
            }
            await fillNative('input[name="productTwitterHandle"]', (meta.founder as any).twitter?.replace('@', '') || '');
            const comment = page.locator('textarea[name="commentBody"]');
            if (await comment.isVisible().catch(() => false)) {
                await comment.fill(meta.descriptions.long);
            }

            // 再次触发一下输入，确保 React 感知
            await page.keyboard.press('Tab');
            await page.waitForTimeout(1500);

            await page.screenshot({ path: 'ph_step2_filled.png', fullPage: true }).catch(() => { });
            this.log(`  ✓ 已填入 Step 2 核心字段 (产品名已修正为 Killer-Skills)`);

            // ====== 导航到第三步 ======
            const nextStepBtn = page.locator('button[data-test="next-step"]');
            if (await nextStepBtn.isVisible()) {
                this.log(`  📝 [第二步] 导航到第三步: Images and media`);
                await nextStepBtn.click();
            }

            // ====== 第三步：上传图片 ======
            this.log(`  ⏳ 正在等待第三步渲染 (Images and media)...`);
            await page.waitForTimeout(3000);

            // 上传 Thumbnail
            const logoPath = path.resolve(this.ctx.assetsDir, 'logo.png');
            if (fs.existsSync(logoPath)) {
                this.log(`  📸 [第三步] 上传缩略图 (Thumbnail)...`);
                const selectImgTrigger = page.locator('button:has-text("Select an image"), [role="button"]:has-text("Select an image"), button:has-text("Change image")').first();
                if (await selectImgTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
                    const [fileChooser] = await Promise.all([
                        page.waitForEvent('filechooser'),
                        selectImgTrigger.click(),
                    ]);
                    await fileChooser.setFiles(logoPath);
                    this.log(`  ✓ Thumbnail 已通过 FileChooser 提交`);
                    await page.waitForTimeout(4000);
                } else {
                    this.log(`  ⚠️ 未找到 Thumbnail 上传按钮，尝试直接使用隐藏 input (虽然可能无效)`);
                    await page.locator('#file-input-thumbnailImageUuid').setInputFiles(logoPath).catch(() => { });
                }
            }

            // 上传 Gallery
            const coverPath = path.resolve(this.ctx.assetsDir, 'cover.png');
            if (fs.existsSync(coverPath)) {
                this.log(`  📸 [第三步] 上传宣传图 (Gallery)...`);
                // 精确定位 "Browse for files" 的文本触发器
                const browseTrigger = page.locator('span:has-text("Browse for files"), button:has-text("Upload more"), [role="button"]:has-text("Browse")').first();
                if (await browseTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
                    const [fileChooser] = await Promise.all([
                        page.waitForEvent('filechooser'),
                        browseTrigger.click(),
                    ]);
                    await fileChooser.setFiles(coverPath);
                    this.log(`  ✓ Gallery 已通过 FileChooser 提交`);
                    await page.waitForTimeout(5000);
                } else {
                    this.log(`  ⚠️ 未找到 Gallery 上传触发器，尝试直接使用隐藏 input (虽然可能无效)`);
                    await page.locator('#file-input-media').setInputFiles(coverPath).catch(() => { });
                }
            }

            await page.screenshot({ path: 'ph_step3_images_uploaded.png', fullPage: true }).catch(() => { });

            // ====== 导航到第四步: Makers ======
            const makersBtn = page.locator('button[data-test="next-step"]');
            if (await makersBtn.isVisible()) {
                this.log(`  📝 [第三步] 导航到第四步: Makers`);
                await makersBtn.click();
                await page.waitForTimeout(3000); // 等待迁移到 Makers 页面

                // ====== 第四步: Makers 选择 ======
                this.log(`  👥 [第四步] 自动选择 "I worked on this product"`);
                const workedOnRadio = page.locator('text="I worked on this product"').first();
                if (await workedOnRadio.isVisible()) {
                    await workedOnRadio.click();
                }

                await page.screenshot({ path: 'ph_step4_makers_filled.png', fullPage: true }).catch(() => { });

                // 导航到下一步: Shoutouts
                const shoutoutsBtn = page.locator('button[data-test="next-step"]');
                if (await shoutoutsBtn.isVisible()) {
                    this.log(`  📝 [第四步] 导航到 Shoutouts 阶段`);
                    await shoutoutsBtn.click();
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: 'ph_step5_shoutouts.png', fullPage: true }).catch(() => { });
                }
            }

            this.log(`  ✓ 已完成图片上传与第三步导航`);

        } catch (e: any) {
            this.log(`⚠️ ProductHunt 表单提取异常: ${e.message}`);
            throw e;
        }
    }

    protected async afterSubmit(_page: Page): Promise<SubmitStatus> {
        // 由于是 Tier 3 高优平台，且提交流程极其复杂（需验证、截图、定价等），
        // 脚本的终点设定为“帮用户填完第一屏，交给用户自行把控最后提交”。
        return 'pending_review';
    }
}
