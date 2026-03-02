/**
 * Auto-Discovery 发掘模块 v2
 *
 * 策略升级：不再盲目从 GitHub Awesome 列表抓链接。
 *
 * 新策略：
 * 1. 使用搜索引擎搜索 "submit your AI tool" 等精准关键词
 * 2. 对搜索结果进行表单探测（是否有 <form> + 提交按钮）
 * 3. 只有确认存在提交表单的页面才会被纳入候选池
 * 4. 历史记录只在真正成功后才写入
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { SITES } from './sites.js';
import { GenericFormAdapter } from './adapters/generic-form.js';
import type { SiteConfig, AdapterContext, ProductMeta, SpintaxProductMeta } from './types.js';

// 获取所有已注册的域名（去重）
const KNOWN_DOMAINS = SITES.map(s => {
    try {
        return new URL(s.submitUrl).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}).filter(Boolean);

// ─── 搜索关键词组合 ───────────────────────────────
// 这些关键词专门用来找有提交入口的 AI 导航站
const SEARCH_QUERIES = [
    'submit your AI tool directory',
    'submit AI tool free listing',
    '"submit your tool" AI directory',
    '"add your tool" AI directory',
    '"submit AI" free directory listing',
    'AI tools directory submit free',
    'list your AI tool free directory',
    '"submit tool" site:*.ai OR site:*.tools OR site:*.io',
    'AI directory "submit your product"',
    'free AI tool submission directory 2025 2026',
];

// ─── 已知非目录站黑名单 ───────────────────────────
// 避免再爬到这些明显不是导航站的域名
const DOMAIN_BLACKLIST = new Set([
    // 大型平台
    'youtube.com', 'google.com', 'facebook.com', 'twitter.com', 'x.com',
    'linkedin.com', 'reddit.com', 'instagram.com', 'tiktok.com',
    // 教育/学术
    'arxiv.org', 'coursera.org', 'edx.org', 'khanacademy.org', 'udemy.com',
    'ocw.mit.edu', 'stanford.edu', 'berkeley.edu', 'mit.edu',
    // 新闻媒体
    'nytimes.com', 'wired.com', 'wsj.com', 'techcrunch.com', 'theverge.com',
    'bbc.com', 'cnn.com', 'forbes.com',
    // AI 公司官网
    'openai.com', 'anthropic.com', 'deepmind.com', 'deepmind.google',
    'stability.ai', 'midjourney.com', 'mistral.ai',
    // VC / 投资
    'a16z.com', 'sequoiacap.com', 'ycombinator.com',
    // 开发工具 / 非导航站
    'github.com', 'gitlab.com', 'npmjs.com', 'pypi.org',
    'stackoverflow.com', 'hackernews.com',
    'cursor.so', 'cursor.sh', 'v0.dev', 'replit.com',
    'notion.so', 'airtable.com',
    // CDN / 工具
    'cdn.jsdelivr.net', 'unpkg.com', 'img.shields.io', 'media.giphy.com',
]);

// ─── 搜索引擎 API（DuckDuckGo HTML 版本，无需 API Key）───
async function searchDuckDuckGo(query: string): Promise<string[]> {
    const urls: string[] = [];
    try {
        const encoded = encodeURIComponent(query);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // 提取搜索结果链接
        const links = await page.locator('a.result__a').all();
        for (const link of links) {
            const href = await link.getAttribute('href');
            if (href) {
                // DuckDuckGo 的链接通常是 redirect URL，需要提取真实 URL
                try {
                    const urlObj = new URL(href, 'https://duckduckgo.com');
                    const realUrl = urlObj.searchParams.get('uddg') || href;
                    if (realUrl.startsWith('http')) {
                        urls.push(realUrl);
                    }
                } catch {
                    if (href.startsWith('http')) urls.push(href);
                }
            }
        }

        await browser.close();
    } catch (e: any) {
        console.error(`⚠️ 搜索 "${query}" 失败: ${e.message}`);
    }
    return urls;
}

// ─── 表单探测：确认页面是否有真正的提交表单 ───
async function probeForSubmitForm(url: string): Promise<{ hasForm: boolean; submitUrl: string }> {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // 检查是否有表单
        const formCount = await page.locator('form').count();
        if (formCount === 0) {
            return { hasForm: false, submitUrl: '' };
        }

        // 检查表单内是否有 name/url/description 等典型字段
        const hasNameField = await page.locator('input[name*="name" i], input[placeholder*="name" i]').count() > 0;
        const hasUrlField = await page.locator('input[name*="url" i], input[name*="website" i], input[placeholder*="url" i], input[placeholder*="http" i]').count() > 0;
        const hasDescField = await page.locator('textarea, input[name*="desc" i], input[placeholder*="desc" i]').count() > 0;
        const hasSubmitBtn = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Add")').count() > 0;

        // 至少需要：(name 或 url 字段) + (描述字段 或 提交按钮)
        const isLikelySubmitForm = (hasNameField || hasUrlField) && (hasDescField || hasSubmitBtn);

        return { hasForm: isLikelySubmitForm, submitUrl: url };
    } catch {
        return { hasForm: false, submitUrl: '' };
    } finally {
        await browser?.close();
    }
}

// ─── 主流程 ───────────────────────────────────────
async function runDiscovery() {
    console.log('🔍 启动 Auto-Discovery v2 (基于搜索引擎精准发现)...\n');

    const discoveredUrls = new Set<string>();

    // 阶段 1：搜索引擎收集候选 URL
    console.log('═══ 阶段 1: 搜索引擎收集候选 ═══\n');
    for (const query of SEARCH_QUERIES) {
        console.log(`🔎 搜索: "${query}"`);
        const results = await searchDuckDuckGo(query);
        let added = 0;

        for (const url of results) {
            try {
                const hostname = new URL(url).hostname.replace(/^www\./, '');

                // 过滤黑名单和已知站点
                if (DOMAIN_BLACKLIST.has(hostname)) continue;
                if (KNOWN_DOMAINS.includes(hostname)) continue;
                if (hostname.includes('github.com')) continue;

                discoveredUrls.add(url);
                added++;
            } catch { /* ignore */ }
        }
        console.log(`   → 新增 ${added} 个候选 URL\n`);

        // 搜索间隔，避免被限流
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n🎉 搜索阶段完成，共发现 ${discoveredUrls.size} 个候选 URL\n`);

    if (discoveredUrls.size === 0) {
        console.log('❌ 未发现任何新的候选站点');
        return;
    }

    // 阶段 2：表单探测
    console.log('═══ 阶段 2: 表单探测（确认有提交入口） ═══\n');
    const validSites: Array<{ hostname: string; submitUrl: string }> = [];

    const baseDir = path.dirname(new URL(import.meta.url).pathname);
    const historyPath = path.resolve(baseDir, '..', 'data', 'submitted-history.json');
    let submissionHistory: string[] = [];
    try {
        if (fs.existsSync(historyPath)) {
            submissionHistory = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        } else {
            fs.mkdirSync(path.dirname(historyPath), { recursive: true });
            fs.writeFileSync(historyPath, JSON.stringify([], null, 2));
        }
    } catch (e) {
        console.warn(`⚠️ 无法读取提交历史: ${e}`);
    }

    const urls = Array.from(discoveredUrls);
    // 过滤掉已经在历史记录里的
    const freshUrls = urls.filter(url => {
        try {
            const h = new URL(url).hostname.replace(/^www\./, '');
            return !submissionHistory.includes(h);
        } catch { return false; }
    });

    console.log(`去重后还有 ${freshUrls.length} 个全新站点需要探测\n`);

    for (let i = 0; i < freshUrls.length; i++) {
        const url = freshUrls[i];
        let hostname = 'unknown';
        try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { }

        process.stdout.write(`  [${i + 1}/${freshUrls.length}] 探测 ${hostname}... `);
        const result = await probeForSubmitForm(url);

        if (result.hasForm) {
            console.log('✅ 发现提交表单！');
            validSites.push({ hostname, submitUrl: url });
        } else {
            console.log('❌ 无表单');
        }
    }

    console.log(`\n📊 探测结果: ${validSites.length} / ${freshUrls.length} 个站点有提交表单\n`);

    if (validSites.length === 0) {
        console.log('🍺 没有发现新的有效提交站点');
        return;
    }

    // 阶段 3：对确认有表单的站点执行盲打
    console.log('═══ 阶段 3: 自动提交 ═══\n');

    const metaPath = path.resolve(baseDir, '..', 'product-meta.json');
    const spintaxMeta: SpintaxProductMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const pick = <T>(arr: T[]): T => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ('' as any);

    const rootDir = path.resolve(baseDir, '..');
    const ctx: AdapterContext = {
        meta: null as any,
        assetsDir: path.join(rootDir, 'assets'),
        logsDir: path.join(rootDir, 'logs'),
        screenshotDir: path.join(rootDir, 'logs', 'screenshots'),
        headless: true,
        timeout: 30000,
        dryRun: false,
    };

    let successCount = 0;

    for (let i = 0; i < validSites.length; i++) {
        const { hostname, submitUrl } = validSites[i];
        console.log(`\n[${i + 1}/${validSites.length}] 提交: ${hostname}`);

        // 动态 Spintax 生成
        ctx.meta = {
            ...spintaxMeta,
            name: pick(spintaxMeta.name),
            tagline: pick(spintaxMeta.tagline),
            descriptions: {
                micro: pick(spintaxMeta.descriptions.micro),
                short: pick(spintaxMeta.descriptions.short),
                long: pick(spintaxMeta.descriptions.long),
            }
        } as ProductMeta;

        const site: SiteConfig = {
            id: `dyn_${Date.now()}_${i}`,
            name: hostname,
            submitUrl,
            homepage: `https://${hostname}`,
            estimatedDR: 10,
            tier: 1,
            requiresLogin: false,
            hasCaptcha: false,
            enabled: true,
        };

        const adapter = new GenericFormAdapter(site, ctx);
        const res = await adapter.execute();

        // ★ 关键修复：只有真正成功才记录历史
        if (res.status === 'success' || res.status === 'pending_review') {
            console.log(`✅ [提交成功] ${submitUrl}`);
            successCount++;

            // 记录到历史
            if (!submissionHistory.includes(hostname)) {
                submissionHistory.push(hostname);
                fs.writeFileSync(historyPath, JSON.stringify(submissionHistory, null, 2));
                console.log(`  📝 历史记录已更新: ${hostname}`);
            }
        } else {
            console.log(`❌ [提交失败] ${res.message}`);
            // 失败的不记录历史，下次还会重试
        }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📊 提交汇总`);
    console.log(`  探测站点: ${freshUrls.length}`);
    console.log(`  有效表单: ${validSites.length}`);
    console.log(`  成功提交: ${successCount}`);
    console.log(`${'═'.repeat(50)}\n`);
}

runDiscovery().catch(console.error);
