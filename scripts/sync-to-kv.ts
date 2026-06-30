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
import { KV_NAMESPACE_ID } from './lib/constants';

// Load .env.local if exists (override existing)
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

// Cloudflare API 配置
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
let hadSyncError = false;
let kvNamespaceUnavailable = false;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
  console.error('❌ 请设置环境变量: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID');
  process.exit(1);
}

/**
 * 批量写入 KV 键值 (Cloudflare Bulk API)
 * 限制：每次请求最多 100MB 数据
 */
async function writeToKVBulk(items: Array<{ key: string; value: string }>): Promise<boolean> {
  if (kvNamespaceUnavailable) return false;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(items),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        if (
          response.status === 404 ||
          response.status === 400 ||
          error.includes('"code":10013') ||
          error.toLowerCase().includes('namespace not found')
        ) {
          console.warn('⚠️ SKILLS_CACHE namespace not found. Skipping KV sync for this run.');
          kvNamespaceUnavailable = true;
          return false;
        }
        // 413 Payload Too Large -> No Retry
        if (response.status === 413) {
          console.error(`❌ 批量写入失败 (Payload Too Large): ${error}`);
          hadSyncError = true;
          return false;
        }
        console.warn(`⚠️ 批量写入失败 (Attempt ${attempt}/${MAX_RETRIES}): ${error}`);
        if (attempt === MAX_RETRIES) {
          hadSyncError = true;
          return false;
        }
        await new Promise((r) => setTimeout(r, 2000 * attempt)); // Backoff
        continue;
      }
      return true;
    } catch (error) {
      console.warn(`⚠️ 网络错误 (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt === MAX_RETRIES) {
        hadSyncError = true;
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  hadSyncError = true;
  return false;
}

/**
 * 写入单个 KV 键值 (Cloudflare Single-Key API)
 * Uses separate PUT requests per key — works when bulk API quota is exhausted.
 */
async function writeToKVSingle(items: Array<{ key: string; value: string }>): Promise<boolean> {
  if (kvNamespaceUnavailable) return false;
  let anyFailed = false;
  for (const item of items) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(item.key)}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `value=${encodeURIComponent(item.value)}`,
      });
      if (!response.ok) {
        const error = await response.text();
        if (response.status === 429) {
          console.warn(`⚠️ KV 写入配额已满 (${item.key}) — 停止写入`);
          return false; // Quota exhausted — stop trying
        }
        console.warn(`⚠️ 写入 ${item.key} 失败: ${error.slice(0, 100)}`);
        anyFailed = true;
      } else {
        console.log(`  ✅ ${item.key} 已写入`);
      }
    } catch (error) {
      console.warn(`⚠️ 网络错误写入 ${item.key}:`, error);
      anyFailed = true;
    }
  }
  return !anyFailed;
}

/**
 * 批量写入 KV，如果 bulk API 失败则 fallback 到逐个写入
 */
async function writeToKV(items: Array<{ key: string; value: string }>): Promise<boolean> {
  // Try bulk first
  const bulkOk = await writeToKVBulk(items);
  if (bulkOk) return true;

  // If bulk failed with quota error (429), try single key writes
  console.log('🔄 Bulk API 失败，尝试逐个写入...');
  return writeToKVSingle(items);
}

/**
 * 列出 KV 中所有键 (Pagination)
 */
async function fetchAllKeys(): Promise<string[]> {
  if (kvNamespaceUnavailable) return [];
  const keys: string[] = [];
  let cursor = '';
  let hasMore = true;

  console.log('🔍 正在获取 KV 中现有的所有 Keys...');

  while (hasMore) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?limit=1000${cursor ? `&cursor=${cursor}` : ''}`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        if (body.includes('"code":10013') || body.toLowerCase().includes('namespace not found')) {
          console.warn('⚠️ SKILLS_CACHE namespace not found while listing keys. Skip cleanup this run.');
          kvNamespaceUnavailable = true;
          break;
        }
        console.error(`❌ 获取 Keys 失败: ${body}`);
        hadSyncError = true;
        break;
      }

      const data = (await response.json()) as any;
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
      hadSyncError = true;
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
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        deletedCount += batch.length;
        console.log(`🗑️  已删除 ${batch.length} 个过期 Keys...`);
      } else {
        console.error(`❌ 删除失败: ${await response.text()}`);
        hadSyncError = true;
      }
    } catch (e) {
      console.error('❌ 网络错误 (Delete Keys):', e);
      hadSyncError = true;
    }
  }
  return deletedCount;
}

async function main() {
  console.log('🚀 开始同步数据到 Cloudflare KV...\n');

  // ══════════════════════════════════════════════════════════
  // KV 职责划分 (2026-06 优化):
  //   SKILLS_CACHE KV 存储:
  //     - doc:{lang}:{slug}        → 文档页面内容
  //     - sitemap-skills           → 站点地图
  //     - skill-collection-lookup  → skill→collection 反查 (18K)
  //     - related-skills-lookup    → related skills 查询表 (3.4M)
  //     - seo-sitemap-blocklist    → 低质量 skill 屏蔽列表 (103K)
  //     - submission:{id}          → 用户提交 (由 API 写入)
  //     - crawled-skills           → 爬取结果 (由 API 写入)
  //   技能数据 (skill:*) 不再写入 KV — 前端已全部从 D1 读取
  // ══════════════════════════════════════════════════════════

  const activeKeys = new Set<string>();

  // 1. Sync critical small keys FIRST (sitemap, collection lookup, blocklist)
  //    These are small and essential — docs sync can consume the entire daily
  //    free-tier quota (1000 writes), so we must prioritize.
  await syncSitemapData();

  // 2. Then sync docs (180+ keys, heavy on quota)
  const docKeys = await syncDocs();
  docKeys.forEach((k) => activeKeys.add(k));

  if (kvNamespaceUnavailable) {
    console.warn('⚠️ SKILLS_CACHE namespace unavailable. KV sync tasks skipped without failing pipeline.');
    return;
  }

  // 2. Sitemap key and related runtime data keys (written in syncSitemapData)
  activeKeys.add('sitemap-skills');
  activeKeys.add('skill-collection-lookup');
  activeKeys.add('related-skills-lookup');
  activeKeys.add('seo-sitemap-blocklist');
  activeKeys.add('docs-cache');
  activeKeys.add('docs:sidebar');

  // 3. 清理遗留的 skill:* 和 all-skills:* 键 (一次性迁移清理)
  console.log('\n🧹 清理遗留的 skill:* KV 键 (已迁移到 D1)...');
  const existingKeys = await fetchAllKeys();

  const staleKeys = existingKeys.filter((key) => {
    if (activeKeys.has(key)) return false;
    // 清理: 所有 skill:* 和 all-skills* 键 (前端已用 D1)
    if (key.startsWith('skill:')) return true;
    if (key.startsWith('all-skills')) return true;
    // 清理: 过期的 doc:* 键
    if (key.startsWith('doc:') && !activeKeys.has(key)) return true;
    return false;
  });

  if (staleKeys.length > 0) {
    const skillKeyCount = staleKeys.filter((k) => k.startsWith('skill:')).length;
    const otherKeyCount = staleKeys.length - skillKeyCount;
    console.log(`🗑️  发现 ${staleKeys.length} 个过期 Keys (${skillKeyCount} skill:*, ${otherKeyCount} other)`);
    await deleteKeys(staleKeys);
  } else {
    console.log('✅ KV 已经很干净，无需清理。');
  }

  if (hadSyncError) {
    console.error('\n❌ KV 同步存在失败项');
    process.exitCode = 1;
  } else {
    console.log('\n✅ KV 同步完成!');
  }
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
  const bulkItems: Array<{ key: string; value: string }> = [];

  // 支持的语言
  const locales = ['en', 'zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru', 'ar'];

  for (const page of docsCache.pages) {
    for (const lang of locales) {
      if (page.content[lang]) {
        const key = `doc:${lang}:${page.slug}`;
        const value = JSON.stringify({
          title: page.title[lang] || page.title.en,
          content: page.content[lang],
          section: page.section,
        });
        bulkItems.push({ key, value });
      }
    }
  }

  // 写入侧边栏结构
  bulkItems.push({
    key: 'docs:sidebar',
    value: JSON.stringify(docsCache.sidebar),
  });

  // 写入完整的 docs-cache (供 sitemap-docs.xml 和其他运行时端点使用)
  // 包含 { version, lastUpdated, pages, sidebar } 结构
  const docsCacheRaw = fs.readFileSync(docsCachePath, 'utf-8');
  bulkItems.push({
    key: 'docs-cache',
    value: docsCacheRaw,
  });

  if (bulkItems.length > 0) {
    console.log(`📡 批量写入文档数据 (${bulkItems.length} items)...`);
    const success = await writeToKV(bulkItems);
    if (success) {
      console.log(`✅ 成功同步 ${bulkItems.length} 个文档缓存项`);
    }
  }

  return bulkItems.map((i) => i.key);
}

main()
  .then(async () => {
    // syncSitemapData already called inside main() before docs
    if (hadSyncError) {
      console.error('\n❌ Some KV sync tasks failed.');
      process.exitCode = 1;
    } else {
      console.log('\n✅ All sync tasks completed!');
    }
  })
  .catch(console.error);

async function syncSitemapData() {
  if (kvNamespaceUnavailable) {
    console.warn('⚠️ Skip sitemap KV sync because namespace is unavailable.');
    return;
  }
  console.log('\n🗺️  Syncing sitemap data...');
  const sitemapPath = path.join(process.cwd(), 'data/sitemap-skills.json');
  if (fs.existsSync(sitemapPath)) {
    const sitemapData = fs.readFileSync(sitemapPath, 'utf-8');
    // sitemap 数据通常不大，单次写入即可
    const success = await writeToKV([{ key: 'sitemap-skills', value: sitemapData }]);
    if (success) {
      console.log('✅ Sitemap data synced to KV');
    } else {
      console.error('❌ Failed to sync sitemap data');
      hadSyncError = true;
    }
  } else {
    console.warn('⚠️  sitemap-skills.json not found');
  }

  // ── skill-collection-lookup (18 KiB) ──
  // Used at runtime by skill detail pages (relatedCollections).
  // The frontend reads from SKILLS_CACHE KV; this script ensures the key is populated.
  console.log('\n🔗 Syncing skill-collection-lookup...');
  const collectionLookupPath = path.join(process.cwd(), 'data/skill-collection-lookup.json');
  if (fs.existsSync(collectionLookupPath)) {
    const data = fs.readFileSync(collectionLookupPath, 'utf-8');
    const success = await writeToKV([{ key: 'skill-collection-lookup', value: data }]);
    if (success) {
      console.log('✅ skill-collection-lookup synced to KV');
    } else {
      console.error('❌ Failed to sync skill-collection-lookup');
      hadSyncError = true;
    }
  } else {
    console.warn('⚠️  skill-collection-lookup.json not found');
  }

  // ── related-skills-lookup (3.4 MiB) ──
  // Used at runtime by skill detail pages (relatedSkills).
  // The frontend reads from SKILLS_CACHE KV; this script ensures the key is populated.
  console.log('\n🔀 Syncing related-skills-lookup...');
  const relatedSkillsPath = path.join(process.cwd(), 'data/related-skills-lookup.json');
  if (fs.existsSync(relatedSkillsPath)) {
    const data = fs.readFileSync(relatedSkillsPath, 'utf-8');
    // ~3.4 MiB — still within single KV write limit (25 MiB), but use bulk for consistency
    const success = await writeToKV([{ key: 'related-skills-lookup', value: data }]);
    if (success) {
      console.log('✅ related-skills-lookup synced to KV');
    } else {
      console.error('❌ Failed to sync related-skills-lookup');
      hadSyncError = true;
    }
  } else {
    console.warn('⚠️  related-skills-lookup.json not found');
  }

  // ── seo-sitemap-blocklist (~103 KiB) ──
  // Used at runtime by middleware and skill detail pages to suppress
  // low-quality or removed skills from sitemap/search. Missing key causes
  // `isSitemapSkillBlocked` to crash on `blocklist.repoKeys` being undefined.
  console.log('\n🚫 Syncing seo-sitemap-blocklist...');
  const blocklistPath = path.join(process.cwd(), 'data/seo-sitemap-blocklist.json');
  if (fs.existsSync(blocklistPath)) {
    const data = fs.readFileSync(blocklistPath, 'utf-8');
    const success = await writeToKV([{ key: 'seo-sitemap-blocklist', value: data }]);
    if (success) {
      console.log('✅ seo-sitemap-blocklist synced to KV');
    } else {
      console.error('❌ Failed to sync seo-sitemap-blocklist');
      hadSyncError = true;
    }
  } else {
    console.warn('⚠️  seo-sitemap-blocklist.json not found');
  }
}
