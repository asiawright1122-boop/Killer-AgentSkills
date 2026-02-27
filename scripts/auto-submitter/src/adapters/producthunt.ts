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
            // 如果还停留在拦截页，直接抛错
            if (page.url().includes('how-can-i-get-access-to-post')) {
                throw new Error('权限不足: 账号注册未满7天或为公司账号，无法提交。');
            }
            // 等待 React 表单组件完全渲染
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
            await page.waitForTimeout(2000);

            // 填写基本信息
            // 应对 Product Hunt 复杂的动态 React Component 嵌套，使用最泛化的匹配或 Label 匹配
            const spintax = (this.ctx as any).spintax;

            // 由于 ProductHunt 结构极其复杂，嵌套很深且可能经过混淆，普通的 Locator 容易失败
            // 这里我们采用最强力的页面注入法，直接在浏览器环境用原生 JS 找周围的 Input 并触发 React 绑定事件
            await page.evaluate((data) => {
                // React 的原生 input setter，用来绕过受控组件不能直接赋 value 的限制
                const setNativeValue = (element: HTMLInputElement, value: string) => {
                    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
                    const prototype = Object.getPrototypeOf(element);
                    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

                    if (valueSetter && valueSetter !== prototypeValueSetter) {
                        prototypeValueSetter?.call(element, value);
                    } else {
                        valueSetter?.call(element, value);
                    }
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                };

                // 寻找包含特定文本的容器，然后拿到它后面的第一个 input
                const fillByLabelText = (labelText: string, val: string) => {
                    if (!val) return;
                    const allElements = Array.from(document.querySelectorAll('*'));
                    const labelSpan = allElements.find(el => el.textContent === labelText && el.children.length === 0);
                    if (labelSpan) {
                        // 往上找几个层级，然后再往下找 input
                        let container = labelSpan.parentElement;
                        for (let i = 0; i < 3; i++) {
                            if (!container) break;
                            const input = container.querySelector('input');
                            if (input) {
                                setNativeValue(input, val);
                                return true;
                            }
                            container = container.parentElement;
                        }
                    }
                    return false;
                };

                fillByLabelText('Name of the launch', data.name);
                fillByLabelText('Tagline', data.tagline);
                fillByLabelText('Links to the launch', data.url);
                fillByLabelText('X account of the launch', data.twitter);

            }, {
                name: spintax.name,
                tagline: spintax.tagline,
                url: spintax.url,
                twitter: spintax.twitter || ''
            });

            this.log(`  ✓ 已尝试通过底层 DOM 注入强行填充所有字段`);

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
