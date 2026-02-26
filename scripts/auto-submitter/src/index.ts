#!/usr/bin/env npx tsx
/**
 * Auto-Submitter 主入口
 *
 * 用法:
 *   npx tsx scripts/auto-submitter/src/index.ts              # 提交所有启用的站点
 *   npx tsx scripts/auto-submitter/src/index.ts --dry-run    # 仅截图不提交
 *   npx tsx scripts/auto-submitter/src/index.ts --show       # 显示浏览器窗口
 *   npx tsx scripts/auto-submitter/src/index.ts --tier 1     # 只提交第一梯队
 *   npx tsx scripts/auto-submitter/src/index.ts --only tooldirs,aijumble   # 只提交指定站点
 *   npx tsx scripts/auto-submitter/src/index.ts --delay 10000              # 站间间隔 10s
 *   npx tsx scripts/auto-submitter/src/index.ts --list       # 列出所有站点
 */

import { SubmitEngine } from './engine.js';
import { SITES } from './sites.js';

// ─── CLI 参数解析 ────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts: Record<string, any> = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--dry-run':
                opts.dryRun = true;
                break;
            case '--show':
                opts.headless = false;
                break;
            case '--tier':
                opts.tier = parseInt(args[++i], 10);
                break;
            case '--only':
                opts.only = args[++i].split(',').map(s => s.trim());
                break;
            case '--exclude':
                opts.exclude = args[++i].split(',').map(s => s.trim());
                break;
            case '--delay':
                opts.delay = parseInt(args[++i], 10);
                break;
            case '--timeout':
                opts.timeout = parseInt(args[++i], 10);
                break;
            case '--list':
                opts.list = true;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    return opts;
}

function printHelp() {
    console.log(`
🚀 Auto-Submitter — AI 导航站自动提交引擎

用法:
  npx tsx scripts/auto-submitter/src/index.ts [options]

选项:
  --dry-run           仅截图，不实际提交
  --show              显示浏览器窗口（非无头模式）
  --tier <n>          只提交第 n 梯队的站点（1 或 2）
  --only <ids>        只提交指定站点（逗号分隔）
  --exclude <ids>     排除指定站点（逗号分隔）
  --delay <ms>        站间间隔毫秒数（默认 5000）
  --timeout <ms>      页面超时毫秒数（默认 30000）
  --list              列出所有注册的站点
  -h, --help          显示帮助

示例:
  # Dry run 测试第一梯队
  npx tsx scripts/auto-submitter/src/index.ts --dry-run --tier 1

  # 有头模式调试单个站点
  npx tsx scripts/auto-submitter/src/index.ts --show --only tooldirs --dry-run

  # 正式提交所有启用的站点
  npx tsx scripts/auto-submitter/src/index.ts
`);
}

function listSites() {
    console.log(`\n📋 注册站点列表（共 ${SITES.length} 个）\n`);
    console.log(`${'ID'.padEnd(20)} ${'名称'.padEnd(25)} ${'梯队'.padEnd(6)} ${'登录'.padEnd(6)} ${'验证码'.padEnd(6)} 启用`);
    console.log('─'.repeat(80));

    for (const s of SITES) {
        const tier = `T${s.tier}`;
        const login = s.requiresLogin ? '✓' : '-';
        const captcha = s.hasCaptcha ? '✓' : '-';
        const enabled = s.enabled ? '✅' : '⬜';
        console.log(
            `${s.id.padEnd(20)} ${s.name.padEnd(25)} ${tier.padEnd(6)} ${login.padEnd(6)} ${captcha.padEnd(6)} ${enabled}`
        );
    }

    const enabledCount = SITES.filter(s => s.enabled).length;
    console.log(`\n启用: ${enabledCount} / ${SITES.length}\n`);
}

// ─── 主流程 ──────────────────────────────────

async function main() {
    const opts = parseArgs();

    if (opts.list) {
        listSites();
        return;
    }

    const engine = new SubmitEngine({
        only: opts.only,
        exclude: opts.exclude,
        tier: opts.tier,
        headless: opts.headless ?? true,
        timeout: opts.timeout ?? 30000,
        dryRun: opts.dryRun ?? false,
        delay: opts.delay ?? 5000,
    });

    try {
        const results = await engine.run();
        const failed = results.filter(r => r.status === 'failed');
        process.exit(failed.length > 0 ? 1 : 0);
    } catch (err: any) {
        console.error(`\n💥 引擎错误: ${err.message}`);
        process.exit(1);
    }
}

main();
