#!/usr/bin/env npx tsx

/**
 * SKILL HARVESTER v2
 * 
 * 专用的 GitHub 技能收割脚本。
 * 目标：批量搜集包含 SKILL.md 的仓库，存入 data/expanded-github-skills.json，供构建脚本离线使用。
 * 
 * v2 重构修复:
 * - 修复: Code Search API 不返回 stars/forks，改用 Repos API 批量补充
 * - 修复: REQUEST_DELAY 从 2.5s → 7s (Code Search: 10 req/min)
 * - 修复: 移除 Code Search 不支持的 `stars:` 语法
 * - 新增: 仓库级垃圾过滤（黑名单 + 单仓库上限）
 * - 新增: --prune 模式清理失效条目
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import * as dotenv from 'dotenv';

// Load .env.local
if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is not set in .env.local');
    process.exit(1);
}

// 目标文件
const DATA_FILE = path.join(process.cwd(), 'data/expanded-github-skills.json');

// ============ Configuration ============

// Code Search API: 10 requests/min for authenticated users
// 7s delay = ~8.5 req/min — safe margin below 10
const CODE_SEARCH_DELAY = 7000;

// Repos API: 5000 req/hr for authenticated users
// 200ms delay = safe for batch enrichment
const REPOS_API_DELAY = 200;

const PER_PAGE = 100;
const MAX_PAGES = 10; // GitHub API limit: 1000 records (10 * 100)

// ============ Junk Filtering ============

// Repos that are "skill registries" or bulk-generated, not real skills
const BLOCKED_REPOS = new Set([
    'majiayu000/claude-skill-registry',
    'ma1orek/replay',
    'sickn33/antigravity-awesome-skills',
]);

// Max skills per repo — repos with more are likely aggregators/registries
const MAX_SKILLS_PER_REPO = 30;

// ============ Types ============

interface HarvestedSkill {
    owner: string;
    repo: string;
    description: string | null;
    stars: number;
    forks: number;
    topics: string[];
    updatedAt: string;
    filePath: string;
}

// ============ Data I/O ============

function loadExisting(): HarvestedSkill[] {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : (data.items || []);
    } catch (e) {
        console.error('⚠️ Failed to load existing data, starting fresh.', e);
        return [];
    }
}

function saveData(items: HarvestedSkill[]) {
    // 按 Stars 降序排序
    const sorted = items.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    fs.writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2));
    console.log(`💾 Saved ${sorted.length} items to ${DATA_FILE}`);
}

// ============ Validation ============

/**
 * 验证文件名是否为合法的 SKILL.md
 * GitHub Code Search API 大小写不敏感，会返回 skill.md / Skill.md 等变体
 * 只接受: SKILL.md, SKILL.MD 或路径中含 /skills/ 的文件
 */
function isValidSkillFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    if (fileName === 'SKILL.md' || fileName === 'SKILL.MD') return true;
    if (filePath.includes('/skills/') && fileName.toLowerCase() === 'skill.md') return true;
    return false;
}

/**
 * 检查仓库是否在黑名单中
 */
function isBlockedRepo(owner: string, repo: string): boolean {
    return BLOCKED_REPOS.has(`${owner}/${repo}`);
}

// ============ Search Strategies ============

/**
 * 生成 Code Search 查询策略
 * 注意: Code Search API 不支持 `stars:` `forks:` 等 Repository 限定符
 * 有效限定符: filename, path, language, org, repo, pushed, size
 */
function generateSearchStrategies() {
    const strategies: string[] = [];

    // 1. 按特定路径 (Agent 框架目录) — 最高质量的来源
    const agentPaths = ['.claude', '.agents', '.codex', '.cursor', '.windsurf', '.kiro', '.gemini'];
    for (const p of agentPaths) {
        strategies.push(`filename:SKILL.md path:${p}`);
    }

    // 2. skills/ 目录 — 标准技能存放位置
    strategies.push('filename:SKILL.md path:skills');

    // 3. 根目录 SKILL.md
    strategies.push('filename:SKILL.md path:/');

    // 4. 动态时间切片 — 从 2024-01 到当前季度
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const quarters: string[] = [];

    for (let year = 2024; year <= currentYear; year++) {
        const maxQ = year === currentYear ? Math.floor(currentMonth / 3) : 3;
        for (let q = 0; q <= maxQ; q++) {
            const startMonth = q * 3 + 1;
            const endMonth = q * 3 + 3;
            const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
            const endDay = new Date(year, endMonth, 0).getDate();
            const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            quarters.push(`${start}..${end}`);
        }
    }
    for (const dateRange of quarters) {
        strategies.push(`filename:SKILL.md pushed:${dateRange}`);
    }

    return strategies;
}

// ============ GitHub API ============

async function searchGitHub(query: string, page: number, retryCount: number = 0): Promise<any> {
    const MAX_RETRIES = 3;
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}`;
    console.log(`   📡 Requesting page ${page}: ${query} ...`);

    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (response.status === 403 || response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
            console.error(`   ❌ Max retries (${MAX_RETRIES}) exceeded for rate limit, aborting this query.`);
            return null;
        }
        const resetTime = response.headers.get('x-ratelimit-reset');
        const waitSeconds = resetTime ? Math.max(0, parseInt(resetTime) - Math.floor(Date.now() / 1000)) : 60;
        console.warn(`   ⚠️ Rate limit hit! Waiting for ${waitSeconds} seconds... (retry ${retryCount + 1}/${MAX_RETRIES})`);
        if (waitSeconds > 300) {
            console.error('   ❌ Wait time too long (> 5 mins), aborting this query.');
            return null;
        }
        await new Promise(r => setTimeout(r, (waitSeconds + 2) * 1000));
        return searchGitHub(query, page, retryCount + 1);
    }

    if (response.status === 422) {
        // Validation failed — often means invalid query syntax
        console.warn(`   ⚠️ Query validation failed (422): "${query}". Skipping.`);
        return null;
    }

    if (!response.ok) {
        console.error(`   ❌ API Error: ${response.status} ${response.statusText}`);
        return null;
    }

    return await response.json();
}

/**
 * 批量获取仓库的 stars/forks 等元数据
 * Code Search API 不返回这些信息，需要单独调用 Repos API
 * Repos API 限额: 5000 req/hr (远高于 Code Search 的 10 req/min)
 */
async function enrichWithRepoMetadata(skills: HarvestedSkill[]): Promise<void> {
    // 按 repo 去重，避免同一 repo 多次调用
    const repoMap = new Map<string, HarvestedSkill[]>();
    for (const s of skills) {
        const key = `${s.owner}/${s.repo}`;
        if (!repoMap.has(key)) repoMap.set(key, []);
        repoMap.get(key)!.push(s);
    }

    // 只对 stars=0 的仓库补充（避免重复调用）
    const allEntries = Array.from(repoMap.entries());
    const needsEnrichment = allEntries.filter(([_, items]) =>
        items.some(s => s.stars === 0 && s.forks === 0)
    );

    if (needsEnrichment.length === 0) {
        console.log('   ℹ️ No repos need metadata enrichment');
        return;
    }

    console.log(`   📊 Enriching ${needsEnrichment.length} repos with stars/forks...`);
    let enriched = 0;
    let failed = 0;

    for (const [repoKey, items] of needsEnrichment) {
        try {
            const url = `https://api.github.com/repos/${repoKey}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const data = await response.json() as any;
                for (const item of items) {
                    item.stars = data.stargazers_count || 0;
                    item.forks = data.forks_count || 0;
                    item.description = item.description || data.description || null;
                    item.updatedAt = data.updated_at || item.updatedAt;
                    item.topics = data.topics || item.topics || [];
                }
                enriched++;
            } else if (response.status === 404) {
                // Repo deleted or made private — mark for removal
                for (const item of items) {
                    item.stars = -1; // Sentinel value for pruning
                }
                failed++;
            } else if (response.status === 403 || response.status === 429) {
                console.warn(`   ⚠️ Repos API rate limit hit during enrichment. Stopping.`);
                break;
            }

            await new Promise(r => setTimeout(r, REPOS_API_DELAY));
        } catch (e) {
            failed++;
        }
    }

    console.log(`   ✅ Enriched ${enriched} repos, ${failed} failed/404`);
}

// ============ Data Cleaning ============

/**
 * 清洗 harvest 数据，移除垃圾仓库和异常数据
 */
function cleanHarvestData(items: HarvestedSkill[]): HarvestedSkill[] {
    const beforeCount = items.length;

    // 1. 移除黑名单仓库
    items = items.filter(x => !isBlockedRepo(x.owner, x.repo));

    // 2. 移除已删除/私有化的仓库 (stars=-1 sentinel)
    items = items.filter(x => x.stars !== -1);

    // 3. 限制每个仓库最多 N 个技能（保留 stars 最高的或首先发现的）
    const repoCounts = new Map<string, number>();
    items = items.filter(x => {
        const key = `${x.owner}/${x.repo}`;
        const count = (repoCounts.get(key) || 0) + 1;
        repoCounts.set(key, count);
        return count <= MAX_SKILLS_PER_REPO;
    });

    const afterCount = items.length;
    if (beforeCount !== afterCount) {
        console.log(`🧹 Cleaned: ${beforeCount} → ${afterCount} items (removed ${beforeCount - afterCount})`);
    }

    return items;
}

// ============ Prune Mode ============

/**
 * 验证旧条目是否仍然有效（仓库是否公开、SKILL.md 是否存在）
 * 使用: npm run skills:harvest -- --prune
 */
async function pruneStaleEntries(items: HarvestedSkill[]): Promise<HarvestedSkill[]> {
    console.log(`🔪 Pruning stale entries from ${items.length} items...`);

    // Only check unique repos (not every skill file individually)
    const repoMap = new Map<string, HarvestedSkill[]>();
    for (let i = 0; i < items.length; i++) {
        const s = items[i];
        const key = `${s.owner}/${s.repo}`;
        if (!repoMap.has(key)) repoMap.set(key, []);
        repoMap.get(key)!.push(s);
    }

    let removed = 0;
    const staleRepos = new Set<string>();

    const repoEntries = Array.from(repoMap.keys());
    for (const repoKey of repoEntries) {
        try {
            const url = `https://api.github.com/repos/${repoKey}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                staleRepos.add(repoKey);
                removed++;
            } else if (response.status === 403 || response.status === 429) {
                console.warn('   ⚠️ Rate limit during prune. Stopping early.');
                break;
            }

            await new Promise(r => setTimeout(r, REPOS_API_DELAY));
        } catch {
            // Network error — skip, don't remove
        }
    }

    const result = items.filter(x => !staleRepos.has(`${x.owner}/${x.repo}`));
    console.log(`   ✅ Pruned ${removed} stale repos (${items.length - result.length} items removed)`);
    return result;
}

// ============ Main ============

async function main() {
    console.log('🌾 SKILL HARVESTER v2 STARTED');

    // Parse args
    const args = process.argv.slice(2);
    const targetArg = args.find(a => a.startsWith('--target='));
    const TARGET_NEW = targetArg ? parseInt(targetArg.split('=')[1]) : 1000;
    const isPruneMode = args.includes('--prune');
    const isEnrichOnly = args.includes('--enrich');

    // 1. 加载现有数据
    let allSkills = loadExisting();
    // Bug Fix: 使用 owner/repo/filePath 作为去重键
    const existingKeys = new Set(allSkills.map(s => `${s.owner}/${s.repo}/${s.filePath}`));
    console.log(`📚 Loaded ${allSkills.length} existing skills.`);

    // Special modes
    if (isPruneMode) {
        allSkills = await pruneStaleEntries(allSkills);
        allSkills = cleanHarvestData(allSkills);
        saveData(allSkills);
        console.log('✅ Prune complete!');
        return;
    }

    if (isEnrichOnly) {
        console.log('📊 Enrich-only mode: updating stars/forks for existing data...');
        await enrichWithRepoMetadata(allSkills);
        allSkills = cleanHarvestData(allSkills);
        saveData(allSkills);
        console.log('✅ Enrichment complete!');
        return;
    }

    // 2. 正常 harvest 模式
    console.log(`🎯 Target: Find ${TARGET_NEW} new skills.`);

    const strategies = generateSearchStrategies();
    let newFoundCount = 0;
    let skippedCount = 0;
    const newBatch: HarvestedSkill[] = []; // Track new items for batch enrichment

    for (const query of strategies) {
        if (newFoundCount >= TARGET_NEW) break;

        console.log(`\n🔍 Strategy: ${query}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            if (newFoundCount >= TARGET_NEW) break;

            // Code Search API rate limit: 10 req/min
            await new Promise(r => setTimeout(r, CODE_SEARCH_DELAY));

            const data = await searchGitHub(query, page);
            if (!data) break;

            const items = data.items || [];
            if (items.length === 0) break;

            let pageNewCount = 0;
            for (const item of items) {
                const filePath = item.path;

                // 严格验证文件名
                if (!isValidSkillFile(filePath)) {
                    skippedCount++;
                    continue;
                }

                const owner = item.repository.owner.login;
                const repo = item.repository.name;

                // 黑名单过滤
                if (isBlockedRepo(owner, repo)) {
                    skippedCount++;
                    continue;
                }

                // 去重
                const key = `${owner}/${repo}/${filePath}`;
                if (existingKeys.has(key)) continue;

                // Note: Code Search API 不返回 stars/forks
                // 先存 0，后面批量用 Repos API 补充
                const skill: HarvestedSkill = {
                    owner,
                    repo,
                    description: item.repository.description || null,
                    stars: 0,  // Will be enriched later via Repos API
                    forks: 0,  // Will be enriched later via Repos API
                    topics: item.repository.topics || [],
                    updatedAt: item.repository.updated_at || new Date().toISOString(),
                    filePath: filePath
                };

                allSkills.push(skill);
                newBatch.push(skill);
                existingKeys.add(key);
                newFoundCount++;
                pageNewCount++;
            }

            console.log(`      Page ${page}: ${items.length} results, ${pageNewCount} new.`);

            if (items.length < PER_PAGE) break; // No more pages
        }
    }

    // 3. 批量补充 stars/forks
    if (newBatch.length > 0) {
        console.log(`\n📊 Enriching ${newBatch.length} new items with repo metadata...`);
        await enrichWithRepoMetadata(newBatch);
    }

    // Also enrich existing items that still have stars=0 (from previous v1 harvests)
    const staleItems = allSkills.filter(s => s.stars === 0 && !newBatch.includes(s));
    if (staleItems.length > 0) {
        console.log(`\n📊 Enriching ${staleItems.length} legacy items (stars=0) with repo metadata...`);
        // Limit to avoid API overload
        const batchSize = Math.min(staleItems.length, 500);
        await enrichWithRepoMetadata(staleItems.slice(0, batchSize));
    }

    // 4. 清洗数据
    allSkills = cleanHarvestData(allSkills);

    // 5. 保存
    saveData(allSkills);

    console.log(`\n✅ Harvest complete! Found ${newFoundCount} new skills. (Skipped ${skippedCount} false positives)`);
    console.log(`📚 Total Database Size: ${allSkills.length}`);
}

main().catch(console.error);
