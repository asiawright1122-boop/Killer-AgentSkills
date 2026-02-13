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

interface CacheData {
    version: number;
    lastUpdated: string;
    totalCount: number;
    skills: any[];
}


/**
 * 批量写入 KV 键值 (Cloudflare Bulk API)
 * 限制：每次请求最多 100MB 数据
 */
async function writeToKVBulk(items: Array<{ key: string, value: string }>): Promise<boolean> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(items),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ 批量写入失败 (${items.length} items): ${error}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`❌ 网络错误 (Bulk Write):`, error);
        return false;
    }
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
    console.log('🚀 开始同步 Skills 到 Cloudflare KV (Bulk Mode)...\n');

    // 读取缓存文件
    const cachePath = path.join(process.cwd(), 'data/skills-cache.json');

    if (!fs.existsSync(cachePath)) {
        console.error(`❌ 缓存文件不存在: ${cachePath}`);
        process.exit(1);
    }

    const cacheData: CacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const skills = cacheData.skills || [];

    console.log(`📦 发现 ${skills.length} 个技能`);

    const bulkItems: Array<{ key: string, value: string }> = [];

    // 1. 分片存储 all-skills (每片 < 20 MB，避免超 CF KV 25 MB 单值限制)
    const skillSummaries = skills.map(getSkillSummarySlim);
    const slimSize = JSON.stringify(skillSummaries).length;
    const origSize = JSON.stringify(skills).length;
    console.log(`📉 列表页瘦身: 原大小 ~${(origSize / 1024 / 1024).toFixed(2)}MB -> 现大小 ~${(slimSize / 1024 / 1024).toFixed(2)}MB`);

    const SHARD_MAX_BYTES = 20 * 1024 * 1024; // 20 MB per shard (CF KV limit is 25 MB)
    const shards = createShards(skillSummaries, SHARD_MAX_BYTES);
    console.log(`📦 all-skills 分片: ${shards.length} 个分片`);

    // 写入分片索引
    bulkItems.push({
        key: 'all-skills-index',
        value: JSON.stringify({ shardCount: shards.length, totalCount: skills.length, lastSynced: new Date().toISOString() })
    });

    // 写入每个分片
    for (let i = 0; i < shards.length; i++) {
        const shardValue = JSON.stringify(shards[i]);
        console.log(`  分片 ${i}: ${shards[i].length} 个技能, ${(shardValue.length / 1024 / 1024).toFixed(2)} MB`);
        bulkItems.push({ key: `all-skills:${i}`, value: shardValue });
    }

    // 2. 添加元数据
    bulkItems.push({
        key: 'skills-metadata',
        value: JSON.stringify({
            totalCount: skills.length,
            lastSynced: new Date().toISOString(),
            cacheVersion: cacheData.version,
            cacheLastUpdated: cacheData.lastUpdated,
        })
    });

    // 3. 添加独立技能 (individual skill keys)
    console.log('\n📤 准备批量写入数据...');
    for (const skill of skills) {
        // Use skill.id for precise lookups
        const key = `skill:${skill.id || `${skill.owner}/${skill.repo}`}`;
        bulkItems.push({
            key,
            value: JSON.stringify(skill)
        });
    }

    // 批量写入 (每批 ≤ 500 items，确保每批 payload < 100 MB)
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failedBatches = 0;

    for (let i = 0; i < bulkItems.length; i += BATCH_SIZE) {
        const batch = bulkItems.slice(i, i + BATCH_SIZE);
        const batchPayloadSize = batch.reduce((sum, item) => sum + item.key.length + item.value.length, 0);
        console.log(`📡 正在发送批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(bulkItems.length / BATCH_SIZE)} (${batch.length} items, ${(batchPayloadSize / 1024 / 1024).toFixed(1)} MB)...`);
        const success = await writeToKVBulk(batch);
        if (success) {
            successCount += batch.length;
        } else {
            failedBatches++;
            console.error(`❌ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 写入失败!`);
        }
    }

    console.log(`✅ 成功同步 ${successCount}/${bulkItems.length} 个键值对到 KV!`);
    if (failedBatches > 0) {
        console.error(`⚠️ ${failedBatches} 个批次写入失败，请检查!`);
    }

    // 收集所有本次写入的 active keys
    const activeKeys = new Set<string>();
    bulkItems.forEach(item => activeKeys.add(item.key));

    // 同步文档缓存 (并收集 keys)
    const docKeys = await syncDocs();
    docKeys.forEach(k => activeKeys.add(k));

    // Sitemap key
    activeKeys.add('sitemap-skills');

    // --- 清理过期数据 (Stale Keys) ---
    // 安全检查：如果同步失败率 > 50%，跳过清理以防误删
    if (failedBatches > 0 && successCount < bulkItems.length * 0.5) {
        console.warn('\n⚠️ 同步成功率低于 50%，跳过清理以防误删有效数据!');
    } else {
        console.log('\n🧹 开始清理过期数据...');
        const existingKeys = await fetchAllKeys();

        // 找出在 KV 中存在，但不在本次 activeKeys 中的 keys
        // 安全检查：只删除 'skill:' 和 'doc:' 开头的 keys，避免误删
        const staleKeys = existingKeys.filter(key => {
            if (activeKeys.has(key)) return false; // 依然活跃
            // 也保留旧 all-skills 分片 keys (all-skills: prefix)
            if (key.startsWith('all-skills')) return false;
            if (key.startsWith('skill:') || key.startsWith('doc:')) return true; // 是技能或文档，且未被更新 -> 删
            return false; // 其他未知 key (如 manually added configs)，保留
        });

        // 额外安全: 如果待删除超过已同步数量的 30%，发出警告但仍执行(日志可追溯)
        if (staleKeys.length > activeKeys.size * 0.3) {
            console.warn(`⚠️ 待删除 ${staleKeys.length} 个 Keys，超过活跃 Keys (${activeKeys.size}) 的 30%，请关注!`);
        }

        if (staleKeys.length > 0) {
            console.log(`🗑️  发现 ${staleKeys.length} 个过期 Keys (Stale), 准备删除...`);
            await deleteKeys(staleKeys);
        } else {
            console.log('✅ 没有发现过期数据，KV 很干净。');
        }
    }

    console.log('\n✅ 同步完成!');
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

/**
 * 极致瘦身：提取列表页展示的最小字段集
 * 详情数据通过 skill:{id} 独立 key 获取
 */
function getSkillSummarySlim(skill: any): any {
    return {
        id: skill.id,
        name: skill.name,
        owner: skill.owner,
        repo: skill.repo,
        description: skill.description,
        category: skill.category,
        stars: skill.stars,
        forks: skill.forks,
        topics: skill.topics,
        updatedAt: skill.updatedAt,
        qualityScore: skill.qualityScore,
        source: skill.source,
        // 保留精简的 skillMd 元信息 (不含 body)
        skillMd: skill.skillMd ? {
            name: skill.skillMd.name,
            description: skill.skillMd.description,
            version: skill.skillMd.version,
            tags: skill.skillMd.tags,
        } : undefined,
        // 保留精简的 SEO features (仅英文，用于列表页标签展示)
        seo: skill.seo ? {
            features: { en: skill.seo.features?.en },
            keywords: { en: skill.seo.keywords?.en },
        } : undefined,
    };
}

/**
 * 将数组按 JSON 序列化后的大小切分为多个分片
 * 每个分片 JSON 大小 < maxBytes
 */
function createShards(items: any[], maxBytes: number): any[][] {
    const shards: any[][] = [];
    let currentShard: any[] = [];
    let currentSize = 2; // account for []

    for (const item of items) {
        const itemSize = JSON.stringify(item).length + 1; // +1 for comma
        if (currentSize + itemSize > maxBytes && currentShard.length > 0) {
            shards.push(currentShard);
            currentShard = [];
            currentSize = 2;
        }
        currentShard.push(item);
        currentSize += itemSize;
    }

    if (currentShard.length > 0) {
        shards.push(currentShard);
    }

    return shards;
}
