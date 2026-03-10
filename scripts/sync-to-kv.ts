#!/usr/bin/env npx tsx
/**
 * Cloudflare KV 同步脚本
 * 将 data/skills-cache.json 中的技能数据同步到 Cloudflare KV
 * 
 * 使用方法：
 * 1. 设置环境变量: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 * 2. 运行: npx tsx scripts/sync-to-kv.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load env vars
import * as dotenv from 'dotenv';

// Load .env.local if exists (override existing)
if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// KV 命名空间 ID (SKILLS_CACHE)
const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5';

// Cloudflare API 配置
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    console.error('❌ 请设置环境变量: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID');
    process.exit(1);
}





/**
 * 批量写入 KV 键值 (Cloudflare Bulk API)
 * 限制：每次请求最多 100MB 数据
 */
async function writeToKVBulk(items: Array<{ key: string, value: string }>): Promise<boolean> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(items),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();
                // 413 Payload Too Large -> No Retry
                if (response.status === 413) {
                    console.error(`❌ 批量写入失败 (Payload Too Large): ${error}`);
                    return false;
                }
                console.warn(`⚠️ 批量写入失败 (Attempt ${attempt}/${MAX_RETRIES}): ${error}`);
                if (attempt === MAX_RETRIES) return false;
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Backoff
                continue;
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ 网络错误 (Attempt ${attempt}/${MAX_RETRIES}):`, error);
            if (attempt === MAX_RETRIES) return false;
            await new Promise(r => setTimeout(r, 2000 * attempt));
        }
    }
    return false;
}

/**
 * 列出 KV 中所有键 (Pagination)
 */
async function fetchAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '';
    let hasMore = true;

    console.log('🔍 正在获取 KV 中现有的所有 Keys...');

    while (hasMore) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?limit=1000${cursor ? `&cursor=${cursor}` : ''}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`❌ 获取 Keys 失败: ${await response.text()}`);
                break;
            }

            const data = await response.json() as any;
            if (data.success) {
                const chunk = data.result.map((item: any) => item.name);
                keys.push(...chunk);
                const info = data.result_info || {};
                cursor = info.cursor || '';
                hasMore = !!cursor;
                process.stdout.write('.');
            } else {
                break;
            }
        } catch (e) {
            console.error('❌ 网络错误 (List Keys):', e);
            break;
        }
    }
    console.log(`\n📦 现有 Keys 总数: ${keys.length}`);
    return keys;
}

/**
 * 批量删除 Keys
 */
async function deleteKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;
    const BATCH_SIZE = 1000; // Cloudflare limit
    let deletedCount = 0;

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        const batch = keys.slice(i, i + BATCH_SIZE);
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batch),
            });

            if (response.ok) {
                deletedCount += batch.length;
                console.log(`🗑️  已删除 ${batch.length} 个过期 Keys...`);
            } else {
                console.error(`❌ 删除失败: ${await response.text()}`);
            }
        } catch (e) {
            console.error('❌ 网络错误 (Delete Keys):', e);
        }
    }
    return deletedCount;
}

async function main() {
    console.log('🚀 开始同步数据到 Cloudflare KV...\n');

    // ══════════════════════════════════════════════════════════
    // KV 职责划分 (2026-02 优化):
    //   SKILLS_CACHE KV 仅存储:
    //     - doc:{lang}:{slug}  → 文档页面内容
    //     - sitemap-skills     → 站点地图
    //     - submission:{id}    → 用户提交 (由 API 写入)
    //     - crawled-skills     → 爬取结果 (由 API 写入)
    //   技能数据 (skill:*) 不再写入 KV — 前端已全部从 D1 读取
    // ══════════════════════════════════════════════════════════

    const activeKeys = new Set<string>();

    // 1. 同步文档缓存
    const docKeys = await syncDocs();
    docKeys.forEach(k => activeKeys.add(k));

    // 2. Sitemap key (will be written in syncSitemapData)
    activeKeys.add('sitemap-skills');

    // 3. 清理遗留的 skill:* 和 all-skills:* 键 (一次性迁移清理)
    console.log('\n🧹 清理遗留的 skill:* KV 键 (已迁移到 D1)...');
    const existingKeys = await fetchAllKeys();

    const staleKeys = existingKeys.filter(key => {
        if (activeKeys.has(key)) return false;
        // 清理: 所有 skill:* 和 all-skills* 键 (前端已用 D1)
        if (key.startsWith('skill:')) return true;
        if (key.startsWith('all-skills')) return true;
        // 清理: 过期的 doc:* 键
        if (key.startsWith('doc:') && !activeKeys.has(key)) return true;
        return false;
    });

    if (staleKeys.length > 0) {
        const skillKeyCount = staleKeys.filter(k => k.startsWith('skill:')).length;
        const otherKeyCount = staleKeys.length - skillKeyCount;
        console.log(`🗑️  发现 ${staleKeys.length} 个过期 Keys (${skillKeyCount} skill:*, ${otherKeyCount} other)`);
        await deleteKeys(staleKeys);
    } else {
        console.log('✅ KV 已经很干净，无需清理。');
    }

    console.log('\n✅ KV 同步完成!');
}

/**
 * 同步文档缓存到 KV (Bulk)
 * 返回本次同步的所有 Keys
 */
async function syncDocs(): Promise<string[]> {
    const docsCachePath = path.join(process.cwd(), 'data/docs-cache.json');

    if (!fs.existsSync(docsCachePath)) {
        console.log('\n⚠️ 文档缓存不存在，跳过文档同步');
        return [];
    }

    console.log('\n📚 开始同步文档到 KV...');

    interface DocsCache {
        version: number;
        lastUpdated: string;
        pages: Array<{
            slug: string;
            title: Record<string, string>;
            section: string;
            content: Record<string, string>;
        }>;
        sidebar: Record<string, { title: Record<string, string>; items: string[] }>;
    }

    const docsCache: DocsCache = JSON.parse(fs.readFileSync(docsCachePath, 'utf-8'));
    const bulkItems: Array<{ key: string, value: string }> = [];

    // 支持的语言
    const locales = ['en', 'zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru', 'ar'];

    for (const page of docsCache.pages) {
        for (const lang of locales) {
            if (page.content[lang]) {
                const key = `doc:${lang}:${page.slug}`;
                const value = JSON.stringify({
                    title: page.title[lang] || page.title.en,
                    content: page.content[lang],
                    section: page.section
                });
                bulkItems.push({ key, value });
            }
        }
    }

    // 写入侧边栏结构
    bulkItems.push({
        key: 'docs:sidebar',
        value: JSON.stringify(docsCache.sidebar)
    });

    if (bulkItems.length > 0) {
        console.log(`📡 批量写入文档数据 (${bulkItems.length} items)...`);
        const success = await writeToKVBulk(bulkItems);
        if (success) {
            console.log(`✅ 成功同步 ${bulkItems.length} 个文档缓存项`);
        }
    }

    return bulkItems.map(i => i.key);
}

main().then(async () => {
    await syncSitemapData();
    console.log('\n✅ All sync tasks completed!');
}).catch(console.error);

async function syncSitemapData() {
    console.log('\n🗺️  Syncing sitemap data...');
    const sitemapPath = path.join(process.cwd(), 'data/sitemap-skills.json');
    if (fs.existsSync(sitemapPath)) {
        const sitemapData = fs.readFileSync(sitemapPath, 'utf-8');
        // sitemap 数据通常不大，单次写入即可
        const success = await writeToKVBulk([{ key: 'sitemap-skills', value: sitemapData }]);
        if (success) {
            console.log('✅ Sitemap data synced to KV');
        } else {
            console.error('❌ Failed to sync sitemap data');
        }
    } else {
        console.warn('⚠️  sitemap-skills.json not found');
    }
}


