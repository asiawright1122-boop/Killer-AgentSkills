#!/usr/bin/env npx tsx

/**
 * SKILL HARVESTER
 * 
 * 专用的 GitHub 技能收割脚本。
 * 目标：批量搜集包含 SKILL.md 的仓库，存入 data/expanded-github-skills.json，供构建脚本离线使用。
 * 特点：
 * 1. 专注于 Search API，不下载文件内容 (节省带宽和时间)。
 * 2. 智能分片搜索 (时间切片、Star切片) 以突破 1000 条限制。
 * 3. 实时追加写入，支持断点续传。
 * 4. 自动去重。
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load env vars
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

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

// 配置
const REQUEST_DELAY = 2500; // 2.5s delay to be safe (Limit: 30 requests/min = 1 req/2s)
const PER_PAGE = 100;
const MAX_PAGES = 10; // GitHub API limit: 1000 records (10 * 100)

interface HarvestedSkill {
    owner: string;
    repo: string;
    description: string | null;
    stars: number;
    topics: string[];
    updatedAt: string;
    filePath: string;
}

// 读取现有数据
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

// 保存数据
function saveData(items: HarvestedSkill[]) {
    // 按 Stars 降序排序
    const sorted = items.sort((a, b) => b.stars - a.stars);
    fs.writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2));
    console.log(`💾 Saved ${sorted.length} items to ${DATA_FILE}`);
}

// 生成搜索查询策略
function generateSearchStrategies() {
    const strategies = [];

    // 1. 按 Star 数切片 (高关注度)
    strategies.push('filename:SKILL.md stars:>100');
    strategies.push('filename:SKILL.md stars:50..100');
    strategies.push('filename:SKILL.md stars:20..49');
    strategies.push('filename:SKILL.md stars:10..19');
    strategies.push('filename:SKILL.md stars:1..9');
    strategies.push('filename:SKILL.md stars:0');

    // 2. 按特定路径 (Agent 框架)
    const paths = ['skills', '.claude', '.agents', '.codex', '.cursor', '.windsurf', '.kiro', '.gemini'];
    for (const p of paths) {
        strategies.push(`filename:SKILL.md path:${p}`);
    }

    // 3. 按时间切片 (补漏) - 2024年
    const months = [
        '2024-01-01..2024-03-31',
        '2024-04-01..2024-06-30',
        '2024-07-01..2024-09-30',
        '2024-10-01..2024-12-31',
        '2025-01-01..2025-03-31',
    ];
    for (const dateRange of months) {
        strategies.push(`filename:SKILL.md pushed:${dateRange}`);
    }

    return strategies;
}

// 调用 GitHub Search API
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
        return searchGitHub(query, page, retryCount + 1); // Retry with incremented count
    }

    if (!response.ok) {
        console.error(`   ❌ API Error: ${response.status} ${response.statusText}`);
        return null;
    }

    return await response.json();
}

async function main() {
    console.log('🌾 SKILL HARVESTER STARTED');

    // 1. 加载现有数据建立索引
    const allSkills = loadExisting();
    const existingKeys = new Set(allSkills.map(s => `${s.owner}/${s.repo}`));
    console.log(`📚 Loaded ${allSkills.length} existing skills.`);

    // 2. 生成搜索策略
    // 获取命令行参数 --target=N，默认 1000 新增
    const args = process.argv.slice(2);
    const targetArg = args.find(a => a.startsWith('--target='));
    const TARGET_NEW = targetArg ? parseInt(targetArg.split('=')[1]) : 1000;

    console.log(`🎯 Target: Find ${TARGET_NEW} new skills.`);

    const strategies = generateSearchStrategies();
    let newFoundCount = 0;

    // 3. 执行搜索
    for (const query of strategies) {
        if (newFoundCount >= TARGET_NEW) break;

        console.log(`\n🔍 Strategy: ${query}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            if (newFoundCount >= TARGET_NEW) break;

            // 速率控制
            await new Promise(r => setTimeout(r, REQUEST_DELAY));

            const data = await searchGitHub(query, page);
            if (!data) break; // Error or limit hit

            const items = data.items || [];
            if (items.length === 0) break; // End of results

            let pageNewCount = 0;
            for (const item of items) {
                const key = `${item.repository.owner.login}/${item.repository.name}`;

                if (existingKeys.has(key)) continue;

                // 构建新条目
                const skill: HarvestedSkill = {
                    owner: item.repository.owner.login,
                    repo: item.repository.name,
                    description: item.repository.description,
                    stars: item.repository.stargazers_count,
                    topics: item.repository.topics || [],
                    updatedAt: item.repository.updated_at,
                    filePath: item.path
                };

                allSkills.push(skill); // 加入主列表
                existingKeys.add(key); // 更新索引
                newFoundCount++;
                pageNewCount++;
            }

            console.log(`      Page ${page}: ${items.length} results, ${pageNewCount} new.`);

            // 实时保存，防止数据丢失
            if (pageNewCount > 0) {
                saveData(allSkills);
            }

            if (items.length < PER_PAGE) break; // No more pages
        }
    }

    console.log(`\n✅ Harvest complete! Found ${newFoundCount} new skills.`);
    console.log(`📚 Total Database Size: ${allSkills.length}`);
}

main().catch(console.error);
