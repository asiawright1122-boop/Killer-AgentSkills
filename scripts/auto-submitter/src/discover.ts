/**
 * Auto-Discovery 发掘模块
 *
 * 放弃易被拦截的传统搜索引擎抓取，改用提取 GitHub 上知名的 "AI 导航站聚合列表"
 * (Awesome AI Directories) 的 Markdown 原材料，从而获得几百个无验证码拦截的高质量导航站 URL。
 * 随后过滤掉已知站点，尝试自动通过 GenericFormAdapter “盲打” (Blind Submit)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SITES } from './sites.js';
import { GenericFormAdapter } from './adapters/generic-form.js';
import type { SiteConfig, AdapterContext, ProductMeta, SpintaxProductMeta } from './types.js';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 获取所有已注册的域名（去重）
const KNOWN_DOMAINS = SITES.map(s => {
    try {
        return new URL(s.submitUrl).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}).filter(Boolean);

// 提取URL的公用正则
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// 知名的 AI 导航站聚合仓
const GITHUB_SOURCES = [
    'https://raw.githubusercontent.com/iAmCorey/awesome-ai-directory/main/README.md',
    'https://raw.githubusercontent.com/best-of-ai/ai-directories/main/README.md',
    'https://raw.gitmirror.com/iAmCorey/awesome-ai-directory/main/README.md',
    'https://raw.gitmirror.com/best-of-ai/ai-directories/main/README.md'
];

async function runDiscovery() {
    console.log('🔍 启动 Auto-Discovery 聚合爬虫 (基于 Github 知名开源名录)...');

    const discoveredUrls = new Set<string>();

    // 如果有本地代理，使用代理防止 Github raw 被墙
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7890';
    let agent: HttpsProxyAgent<string> | undefined;
    try {
        agent = new HttpsProxyAgent(proxyUrl);
    } catch (e) { }

    for (const source of GITHUB_SOURCES) {
        console.log(`\n🔎 正在解析数据源: ${source}`);
        try {
            let res;
            try {
                res = await fetch(source, { signal: AbortSignal.timeout(10000) });
            } catch (err) {
                if (agent) {
                    console.log(`⚠️ 直连失败，尝试使用本地 HTTP 代理 ${proxyUrl}...`);
                    res = await fetch(source, { agent, signal: AbortSignal.timeout(15000) } as any);
                } else {
                    throw err;
                }
            }

            if (!res.ok) continue;

            const md = await res.text();
            let match;
            let count = 0;

            while ((match = urlRegex.exec(md)) !== null) {
                let urlStr = match[0].trim();
                // 移除 Markdown 括号尾巴
                if (urlStr.endsWith(')')) urlStr = urlStr.slice(0, -1);

                try {
                    const hostname = new URL(urlStr).hostname.replace(/^www\./, '');

                    // 过滤无关链接、已知链接等
                    if (!KNOWN_DOMAINS.includes(hostname) &&
                        !hostname.includes('github.com') &&
                        !hostname.includes('twitter.com') &&
                        !hostname.includes('linkedin.com') &&
                        !hostname.includes('google.com') &&
                        !hostname.includes('reddit.com')) {
                        discoveredUrls.add(urlStr);
                        count++;
                    }
                } catch {
                    // ignore parse error
                }
            }
            console.log(`✅ 从该数据源提取出 ${count} 个全新的潜在提交页！`);
        } catch (e: any) {
            console.error(`⚠️ 数据源解析错误: ${e.message}`);
        }
    }

    const urls = Array.from(discoveredUrls);
    console.log(`\n🎉 Web 聚合爬虫执行完毕，总计发现 ${urls.length} 个全新的潜在导航站！`);

    if (urls.length === 0) {
        return;
    }

    console.log('\n🚀 开始对新站尝试全自动“盲打”提交 (Blind Submit)...');

    const baseDir = path.dirname(new URL(import.meta.url).pathname);
    const metaPath = path.resolve(baseDir, '..', 'product-meta.json');
    const spintaxMeta: SpintaxProductMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    // Fix typings / ensure deterministic build
    const pick = (arr: any[]): any => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '';

    const rootDir = path.resolve(baseDir, '..');
    const ctx: AdapterContext = {
        meta: null as any,
        assetsDir: path.join(rootDir, 'assets'),
        logsDir: path.join(rootDir, 'logs'),
        screenshotDir: path.join(rootDir, 'logs', 'screenshots'),
        headless: true, // 后台盲打
        timeout: 30000,
        dryRun: false,
    };

    let successCount = 0;
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

    // 过滤掉已经在历史记录里尝试过的站
    const freshUrls = urls.filter(url => {
        try {
            const h = new URL(url).hostname.replace(/^www\./, '');
            return !submissionHistory.includes(h);
        } catch { return false; }
    });

    console.log(`\n==============================================`);
    console.log(`去重后，本次池子中还有 ${freshUrls.length} 个全新的站点等待被发掘`);
    console.log(`==============================================\n`);

    if (freshUrls.length === 0) {
        console.log(`🍺 所有抓取到的链接都已经尝试过，今日无新活！`);
        return;
    }

    // 执行剩下的全部站点
    const totalToProcess = freshUrls.length;
    for (let i = 0; i < totalToProcess; i++) {
        // 随机取一个且不再放回
        const randomIndex = Math.floor(Math.random() * freshUrls.length);
        const url = freshUrls.splice(randomIndex, 1)[0];
        console.log(`\n[${i + 1}/${totalToProcess}] 盲打测试: ${url}`);

        // 动态 Spintax 生成，保持多样性
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

        let hostname = 'unknown';
        try { hostname = new URL(url).hostname; } catch { }

        // 记录历史
        if (hostname !== 'unknown' && !submissionHistory.includes(hostname.replace(/^www\./, ''))) {
            submissionHistory.push(hostname.replace(/^www\./, ''));
            fs.writeFileSync(historyPath, JSON.stringify(submissionHistory, null, 2));
        }

        // Mock SiteConfig
        const site: SiteConfig = {
            id: `dyn_${Date.now()}_${i}`,
            name: hostname,
            submitUrl: url,
            homepage: `https://${hostname}`,
            estimatedDR: 10,
            tier: 1,
            requiresLogin: false,
            hasCaptcha: false,
            enabled: true
        };

        const adapter = new GenericFormAdapter(site, ctx);
        const res = await adapter.execute();

        if (res.status === 'success' || res.status === 'pending_review') {
            console.log(`✅ [盲打成功] ${url} !! (请之后考虑将其收录到 sites.ts 中作为固定桩)`);
            successCount++;
        } else {
            console.log(`❌ [盲打失败] ${res.message}`);
        }
    }

    console.log(`\n==============================================`);
    console.log(`📊 盲打汇总`);
    console.log(`在新发掘的站点中成功盲打了:  ${successCount} 个站`);
    console.log(`==============================================\n`);
}

runDiscovery().catch(console.error);
