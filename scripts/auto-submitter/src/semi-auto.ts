#!/usr/bin/env npx tsx
/**
 * Semi-Auto Submitter 主入口 (半自动化辅助办公模式)
 *
 * 用法:
 *   npm run submit:manual [siteId]
 * 示例:
 *   npm run submit:manual futurepedia
 */

import * as path from 'node:path';

import * as fs from 'node:fs';
import { SubmitEngine } from './engine.js';
import { SITES } from './sites.js';

// 获取目标站点ID
const targetId = process.argv[2];

if (!targetId || targetId.startsWith('-')) {
    console.log(`
🤖 半自动化外骨骼启动指南 (Semi-Auto Copilot)
-----------------------------------------------
专为了需要严格登录和人机验证的高权重节点研发。
使用您真实的 Chrome 配置文件，脚本将全自动帮您代工 90% 的填表活。

⚠️ 注意：由于我们要劫持真实的 Chrome 配置，运行本脚本前，必须先关闭所有已打开的 Chrome 窗口！

使用方法:
  npm run submit:manual <site_id>

目前可用的高权重平台 (Tier 2/3):
${SITES.filter(s => s.tier > 1).map(s => `  - ${s.id.padEnd(20)} (${s.name})`).join('\n')}
`);
    process.exit(1);
}

const targetSite = SITES.find(s => s.id === targetId);
if (!targetSite) {
    console.error(`❌ 找不到站点: ${targetId}`);
    process.exit(1);
}

// 统一使用项目本地专属的 Chrome Profile
// 这样用户就不需要关闭他们日常使用的 Chrome 浏览器了！
// 也能彻底避免 MacOS 下由于 SingletonLock 导致的 about:blank 卡死和 CDP 端口冲突。
const userDataDir = path.resolve(process.cwd(), 'data', 'chrome-profile');

// 确保该目录存在
if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}

console.log(`\n🧩 准备使用专属机器人浏览器上下文: ${userDataDir}`);
console.log(`⚠️ 提示：这是专门为您开辟的 Bot 专属 Chrome 环境。初次打开某平台时可能需要您手工登录一次！\n`);
console.log(`⏳ 即将为您调起 ${targetSite.name}，脚本会帮您神速填完表单... 等待 5 秒钟...`);

// 等待 5 秒给用户关闭 Chrome 的时间
await new Promise(resolve => setTimeout(resolve, 5000));

async function main() {
    const engine = new SubmitEngine({
        only: [targetId],
        headless: false,  // 强制展示界面给用户介入
        timeout: 120000,  // 半自动化模式下，超时放宽到 2 分钟，留给人填验证码的时间
        userDataDir: fs.existsSync(userDataDir) ? userDataDir : undefined,
    });

    try {
        const results = await engine.run();
        const failed = results.filter(r => r.status === 'failed');
        if (failed.length > 0) {
            console.log("\n⚠️ 有可能碰到机器人验证或复杂的弹窗，请根据界面提示操作完成后，手动点击 Submit。");
            process.exit(1);
        }
        process.exit(0);
    } catch (err: any) {
        console.error(`\n💥 半自动引擎错误: ${err.message}`);
        console.log("提示: 如果显示 EBUSY 或 locked 错误，说明您的 Chrome 浏览器还没关干净。请彻底退出 Chrome 再试。");
        process.exit(1);
    }
}

main();
