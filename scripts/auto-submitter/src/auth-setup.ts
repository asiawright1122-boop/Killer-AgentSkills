#!/usr/bin/env npx tsx
/**
 * Auth Setup — 一次性登录并保存浏览器状态
 *
 * 用法:
 *   npx tsx scripts/auto-submitter/src/auth-setup.ts
 *
 * 这会弹出一个浏览器窗口，你需要手动：
 * 1. 登录你的 Google / GitHub / Twitter 等账号
 * 2. 如需要，访问特定站点并登录
 * 3. 完成后在终端按 Enter 保存
 *
 * 保存的 auth.json 会被后续自动提交时使用。
 */

import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const AUTH_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'auth.json'
);

async function main() {
    console.log(`\n🔐 Auth Setup — 浏览器状态保存工具\n`);
    console.log(`打开浏览器后，请手动登录以下常见平台：`);
    console.log(`  - Google (accounts.google.com)`);
    console.log(`  - GitHub (github.com)`);
    console.log(`  - Twitter (x.com)`);
    console.log(`  - 以及你要提交的各导航站`);
    console.log(`\n完成后回到终端按 Enter 保存。\n`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.goto('https://accounts.google.com');

    // 等待用户手动登录
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise<void>(resolve => {
        rl.question('✅ 登录完成后按 Enter 保存状态...', () => {
            rl.close();
            resolve();
        });
    });

    // 保存状态
    await context.storageState({ path: AUTH_PATH });
    console.log(`\n💾 已保存浏览器状态到: ${AUTH_PATH}`);
    console.log(`⚠️  注意: auth.json 包含你的登录凭证，请勿提交到 Git！\n`);

    await browser.close();
}

main().catch(console.error);
