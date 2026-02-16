/**
 * Skills 缓存构建脚本
 * 运行: npx tsx scripts/build-skills-cache.ts
 * 
 * 重构后：所有共享逻辑已提取到 scripts/lib/ 模块
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import * as dotenv from 'dotenv';

// ===== Shared Lib Imports =====
import { AIService } from './lib/ai';
import { KVService } from './lib/kv';
import {
    OFFICIAL_REPOS, isOfficialRepo, CATEGORY_RULES,
    EXCLUDE_KEYWORDS, SUSPICIOUS_NAMES, SKILL_HEADERS, FUNCTIONAL_KEYWORDS,
    GITHUB_API, SUPPORTED_LOCALES, KV_NAMESPACE_ID
} from './lib/constants';
import { pLimit, fetchWithTimeout, sleep } from './lib/utils';
import type { SeoData, AgentAnalysis, SkillCache, CacheData, TranslateContext } from './lib/types';

// Try loading .env.local if available
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

// ===== Service Instances =====
const aiService = new AIService();
const kvService = new KVService();

// GitHub API config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ===== Build-Specific Scoring Logic =====
function sharedCalculateQualityScore(skill: any): number {
    let score = 0;
    const isOfficial = isOfficialRepo(skill.owner, skill.repo);

    if (!skill.name) return 0;

    const nameLower = skill.name.toLowerCase();
    if (!isOfficial && SUSPICIOUS_NAMES.some(k => nameLower === k || nameLower.includes(k + '-'))) {
        return 0;
    }

    const bodyLower = (skill.body || '').toLowerCase();

    let headerScore = 0;
    for (const h of SKILL_HEADERS) {
        if (bodyLower.includes(h)) { headerScore = 25; break; }
    }
    score += headerScore;

    let foundKeywords = 0;
    for (const k of FUNCTIONAL_KEYWORDS) {
        if (bodyLower.includes(k)) foundKeywords++;
    }
    score += Math.min(20, foundKeywords * 5);

    if ((skill.body || '').includes('```')) score += 10;
    if (bodyLower.includes('json') || bodyLower.includes('yaml')) score += 5;

    if (!isOfficial) {
        if (headerScore === 0 && foundKeywords < 2) return 0;
        if (bodyLower.length < 50) return 0;
    }

    const standardPaths = ['.codex/', '.claude/', '.agent/', 'skills/'];
    if (skill.repoPath && standardPaths.some(p => skill.repoPath!.includes(p))) {
        score += 20;
    }

    if (skill.name) score += 5;
    if (skill.version) score += 5;
    if (skill.tags && skill.tags.length > 0) score += 5;

    const desc = skill.description || '';
    if (desc.length > 50) score += 10;

    if (isOfficial) {
        score += 30;
    } else {
        if (skill.updatedAt) {
            const daysSinceUpdate = Math.floor((Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceUpdate < 180) score += 5;
        }
        if (skill.stars && skill.stars > 50) score += 15;
        else if (skill.stars && skill.stars > 10) score += 10;
    }

    return Math.min(100, score);
}

// ===== Category Determination =====
function determineCategory(skill: SkillCache): string {
    const text = `${skill.name} ${JSON.stringify(skill.description)} ${(skill.topics || []).join(' ')}`.toLowerCase();
    const topics = new Set((skill.topics || []).map(t => t.toLowerCase()));

    if (topics.has('code-review')) return 'code-review';
    if (topics.has('testing') || topics.has('test')) return 'testing';
    if (topics.has('design') || topics.has('ui')) return 'design';
    if (topics.has('security')) return 'security';
    if (topics.has('database')) return 'database';

    let bestCategory = 'development';
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
        let score = 0;
        for (const keyword of keywords) {
            if (topics.has(keyword)) score += 10;
            if (skill.name.toLowerCase().includes(keyword)) score += 5;
            if (text.includes(keyword)) score += 1;
        }
        if (score > maxScore) { maxScore = score; bestCategory = category; }
    }

    if (skill.name === 'backend-patterns') return 'development';
    if (maxScore === 0) {
        if (text.includes('agent')) return 'ai';
        if (text.includes('code')) return 'development';
    }

    return bestCategory;
}



async function searchGitHubSkills(): Promise<any[]> {
    console.log('🔍 Loading skills from data/expanded-github-skills.json...');
    const expandedPath = path.join(process.cwd(), 'data/expanded-github-skills.json');
    const morePath = path.join(process.cwd(), 'data/more-github-skills.json');
    let items: any[] = [];

    if (fs.existsSync(expandedPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(expandedPath, 'utf-8'));
            items = items.concat(Array.isArray(data) ? data : data.items || []);
        } catch (e) {
            console.error('Error reading expanded-github-skills.json', e);
        }
    }

    if (fs.existsSync(morePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(morePath, 'utf-8'));
            items = items.concat(Array.isArray(data) ? data : data.items || []);
        } catch (e) {
            console.error('Error reading more-github-skills.json', e);
        }
    }

    console.log(`   → Found ${items.length} items from local backups`);

    // If local backups are empty, try to fetch some from GitHub API directly to bootstrap
    if (items.length === 0) {
        console.log('   ⚠️ No local backups found. Fetching initial batch from GitHub API...');
        // Use a broad search to bootstrap
        const bootstrapQueries = [
            'filename:SKILL.md sort:input',
            'filename:SKILL.md stars:>10'
        ];

        for (const query of bootstrapQueries) {
            try {
                const searchUrl = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=100`;
                const response = await fetchWithTimeout(searchUrl, { headers: getHeaders() });
                if (response.ok) {
                    const data = await response.json() as any;
                    const newItems = data.items || [];
                    console.log(`      Found ${newItems.length} items via API (${query})`);

                    // Transform to matching structure
                    const transformed = newItems.map((item: any) => ({
                        owner: item.repository.owner.login,
                        repo: item.repository.name,
                        stars: item.repository.stargazers_count,
                        forks: item.repository.forks_count,
                        topics: item.repository.topics || [],
                        description: item.repository.description,
                        updatedAt: item.repository.updated_at,
                        filePath: item.path
                    }));

                    items = items.concat(transformed);
                }
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error('Bootstrap search failed:', e);
            }
        }

        // Save to expanded-github-skills.json for next time
        if (items.length > 0) {
            fs.writeFileSync(expandedPath, JSON.stringify(items, null, 2));
            console.log(`   💾 Saved ${items.length} bootstrapped items to ${expandedPath}`);
        }
    }

    return items;
}

/**
 * 自动发现 GitHub 上新发布的 Skills
 * 使用 GitHub Code Search API 搜索包含 SKILL.md 的仓库
 * - 动态日期: 基于缓存的 lastUpdated 搜索新仓库
 * - 翻页: 每个查询最多 3 页 × 100 结果
 * - 扩大搜索: 覆盖所有常见 IDE/Agent 目录
 */
async function discoverNewSkillsFromGitHub(existingIds: Set<string>, lastCacheUpdate?: string, fullDiscovery: boolean = false): Promise<any[]> {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GITHUB_TOKEN not set, skipping auto-discovery');
        return [];
    }

    console.log('🔎 Discovering new Skills from GitHub...');
    const newSkills: any[] = [];
    const processedRepoFiles = new Set<string>(); // 去重: repo/path

    // 动态日期: 使用缓存的 lastUpdated - 2天 作为搜索起点，确保不遗漏
    let searchSince = '2024-01-01';

    if (fullDiscovery) {
        console.log('   🌍 Full Discovery Mode: Searching from 2024-01-01');
        searchSince = '2024-01-01';
    } else if (lastCacheUpdate) {
        const d = new Date(lastCacheUpdate);
        d.setDate(d.getDate() - 2); // 往前推 2 天，留余量
        searchSince = d.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    console.log(`   📅 Searching for repos pushed since: ${searchSince}`);

    // 搜索策略: 覆盖所有常见的 Skill 存放位置
    const searchQueries = [
        `filename:SKILL.md path:/ pushed:>${searchSince}`,           // 根目录
        `filename:SKILL.md path:skills pushed:>${searchSince}`,      // skills/
        `filename:SKILL.md path:.claude pushed:>${searchSince}`,     // .claude/
        `filename:SKILL.md path:.agents pushed:>${searchSince}`,     // .agents/
        `filename:SKILL.md path:.codex pushed:>${searchSince}`,      // .codex/
        `filename:SKILL.md path:.cursor pushed:>${searchSince}`,     // .cursor/
        `filename:SKILL.md path:.windsurf pushed:>${searchSince}`,   // .windsurf/
        `filename:SKILL.md path:.kiro pushed:>${searchSince}`,       // .kiro/
        `filename:SKILL.md path:.gemini pushed:>${searchSince}`,     // .gemini/
        `filename:SKILL.md "name:" "description:" pushed:>${searchSince}`, // 通用搜索，不限路径
    ];

    // Add generic broad searches if in full discovery mode
    if (fullDiscovery) {
        searchQueries.push(`filename:SKILL.md language:markdown star:>0`);
        searchQueries.push(`filename:SKILL.md path:.custom`);
    }

    const DISCOVERY_LIMIT = 2000; // 提升上限: 100 -> 2000
    const MAX_PAGES = 10;         // 提升翻页: 3 -> 10 (GitHub API max 1000 results per query)

    for (const query of searchQueries) {
        if (newSkills.length >= DISCOVERY_LIMIT) break;

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const searchUrl = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}&sort=indexed&order=desc`;
                const response = await fetchWithTimeout(searchUrl, { headers: getHeaders() });

                if (!response.ok) {
                    if (response.status === 403 || response.status === 422) {
                        console.log('   ⚠️ GitHub API rate limit reached, skipping remaining queries');
                        return newSkills; // 限流时直接返回已有结果
                    }
                    break; // 其他错误，跳到下一个查询
                }

                const data = await response.json() as any;
                const items = data.items || [];

                if (items.length === 0) break; // 没有更多结果，跳到下一个查询

                for (const item of items) {
                    const repoFullName = item.repository?.full_name;
                    if (!repoFullName) continue;

                    const [owner, repo] = repoFullName.split('/');
                    const filePath = item.path;
                    const repoFileKey = `${repoFullName}/${filePath}`;

                    // 去重: 同一 repo/path 只处理一次
                    if (processedRepoFiles.has(repoFileKey)) continue;
                    processedRepoFiles.add(repoFileKey);

                    // 生成唯一 ID
                    const skillId = filePath === 'SKILL.md'
                        ? repoFullName
                        : `${repoFullName}/${filePath.replace('/SKILL.md', '').replace('SKILL.md', '')}`.replace(/\/$/, '');

                    // 跳过已存在的
                    if (existingIds.has(skillId) || existingIds.has(repoFullName)) {
                        continue;
                    }

                    // 获取 SKILL.md 内容
                    const branch = item.repository?.default_branch || 'main';
                    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/${branch}/${filePath}`;

                    try {
                        const contentRes = await fetchWithTimeout(rawUrl);
                        if (!contentRes.ok) continue;

                        const content = await contentRes.text();

                        // 验证是否有有效的 frontmatter
                        if (!content.includes('---') || !content.includes('name:')) {
                            continue;
                        }

                        // 获取仓库信息
                        const repoInfo = await fetchRepoInfo(owner, repo);
                        if (!repoInfo) continue;

                        newSkills.push({
                            owner,
                            repo,
                            content,
                            stars: repoInfo.stargazers_count || 0,
                            forks: repoInfo.forks_count || 0,
                            topics: repoInfo.topics || [],
                            description: repoInfo.description || '',
                            fetchedAt: new Date().toISOString(),
                            filePath,
                            skillId,
                        });

                        process.stdout.write('N'); // N for New discovery

                        if (newSkills.length >= DISCOVERY_LIMIT) {
                            console.log(`\n   → Reached discovery limit (${DISCOVERY_LIMIT}), stopping...`);
                            return newSkills;
                        }
                    } catch {
                        continue;
                    }
                }

                // 如果返回不满 100 条，说明没有下一页了
                if (items.length < 100) break;

                // 翻页间隔，避免触发限流
                await new Promise(r => setTimeout(r, 2000));

            } catch (e) {
                console.error(`   Error searching with query "${query}" page ${page}:`, e);
                break;
            }
        }

        // 查询间隔
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n   → Discovered ${newSkills.length} new Skills from GitHub`);
    return newSkills;
}

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Killer-Skills-Build-Script'
    };
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }
    return headers;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetchWithTimeout(url, { headers: getHeaders() });
            if (response.status === 403) {
                console.warn('⚠️ GitHub API rate limit, waiting 60s...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
}

async function fetchRepoInfo(owner: string, repo: string): Promise<any> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    return response.json();
}

async function fetchSkillMd(owner: string, repo: string, skillsPath: string): Promise<string | null> {
    // If skillsPath ends in .md (or other extensions), treat it as a specific file, not a directory
    if (skillsPath && (skillsPath.endsWith('.md') || skillsPath.endsWith('.cursorrules'))) {
        const paths = [skillsPath];
        for (const p of paths) {
            for (const branch of ['main', 'master', 'canary', 'develop']) {
                try {
                    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
                    const response = await fetchWithTimeout(url);
                    if (response.ok) return response.text();
                } catch { continue; }
            }
        }
        return null;
    }

    const paths = skillsPath
        ? [`${skillsPath}/SKILL.md`, 'SKILL.md']
        : [
            'SKILL.md',
            '.cursorrules', // Support .cursorrules as top-level skill
            '.codex/skills/SKILL.md',
            '.claude/skills/SKILL.md',
            '.agent/skills/SKILL.md',
            `skills/${repo}/SKILL.md`,
            `.codex/skills/${repo}/SKILL.md`,
            `.claude/skills/${repo}/SKILL.md`
        ];

    const branchesToTry = ['main', 'master', 'canary', 'develop'];
    for (const p of paths) {
        for (const branch of branchesToTry) {
            try {
                const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
                const response = await fetchWithTimeout(url);
                if (response.ok) return response.text();
            } catch {
                continue;
            }
        }
    }
    return null;
}

function parseSkillMd(content: string): SkillCache['skillMd'] & { body?: string } | undefined {
    // Robust Regex: Handle \r\n, loose whitespace
    content = content.trimStart();
    const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) return undefined;

    const [, frontmatter, body] = match;
    const meta: Record<string, any> = {};

    frontmatter.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim().replace(/['\"]/g, '');

            // 处理数组
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1);
                meta[key] = value.split(',').map(s => s.trim().replace(/['\"]/g, ''));
            } else {
                meta[key] = value;
            }
        }
    });

    return {
        name: meta.name || '',
        description: meta.description || '',
        version: meta.version,
        tags: meta.tags,
        bodyPreview: body.slice(0, 500).trim(),
        body: body // Return full body for validation
    };
}

/**
 * Calculate quality score using shared validation module
 * This is a wrapper to adapt SkillCache to SkillScoringInput
 */
function calculateQualityScore(skill: SkillCache): number {
    if (!skill.skillMd) return 0;

    const bodyRaw = (skill.skillMd as any).body || skill.skillMd.bodyPreview || '';
    const desc = typeof skill.description === 'string' ? skill.description : (skill.description?.en || '');

    return sharedCalculateQualityScore({
        name: skill.skillMd.name || skill.name,
        owner: skill.owner,
        repo: skill.repo,
        body: bodyRaw,
        repoPath: skill.repoPath,
        description: desc,
        stars: skill.stars,
        updatedAt: skill.updatedAt,
        version: skill.skillMd.version,
        tags: skill.skillMd.tags
    });
}



async function buildCache(): Promise<void> {
    // Parse arguments
    const args = process.argv.slice(2);
    const modeArg = args.find(arg => arg.startsWith('--mode='));
    const mode = modeArg ? modeArg.split('=')[1] : 'update'; // default to update (full)
    const force = args.includes('--force'); // Force re-generation of AI content
    const filterArg = args.find(arg => arg.startsWith('--filter='));
    const filters = filterArg ? filterArg.split('=')[1].toLowerCase().split(',') : [];
    const liveSync = true; // FORCE ENABLE: Always real-time KV sync as per requirement

    console.log(`🚀 Starting cache build in [${mode.toUpperCase()}] mode... (Force: ${force}, Filter: ${filters.join(',') || 'None'}, Live: ${liveSync} [FORCED])\n`);

    if (!['discover', 'update', 'full-discovery'].includes(mode)) {
        console.error(`❌ Invalid mode: ${mode}. Use --mode=discover, --mode=update, or --mode=full-discovery`);
        process.exit(1);
    }

    // Load existing cache
    let existingMap = new Map<string, SkillCache>();
    let lastCacheUpdate: string | undefined;
    const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
    if (fs.existsSync(cachePath)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheData;
            oldData.skills.forEach(s => existingMap.set(s.id, s));
            lastCacheUpdate = oldData.lastUpdated;
            console.log(`📚 Loaded ${existingMap.size} skills from cache (last updated: ${lastCacheUpdate || 'unknown'})`);
        } catch { }
    }

    const skills: SkillCache[] = [];
    globalSkillsRef = skills; // Store reference for SIGINT handler
    const processedRepos = new Set<string>();

    // Helper: 检查翻译是否完整 (所有 9 种语言都有 SEO 数据 且包含 agentAnalysis)
    function isTranslationComplete(skill: SkillCache): boolean {
        if (!skill.seo || !skill.description) return false;

        // Check for Agent Analysis with translations
        if (!skill.agentAnalysis) return false;
        // If suitability is still a plain string, it hasn't been translated yet
        if (typeof skill.agentAnalysis.suitability === 'string') return false;
        // Check that suitability has entries for all supported locales
        const suitabilityMap = skill.agentAnalysis.suitability as Record<string, string>;
        if (!suitabilityMap['en']) return false;
        const hasAllAgentLocales = SUPPORTED_LOCALES.every(loc => {
            const val = suitabilityMap[loc];
            if (!val || val.trim().length === 0) return false;
            // STRICT CHECK: If we have existing "bad" data (short keywords), mark as incomplete to force re-gen
            if (suitabilityMap['en'] && suitabilityMap['en'].length > 20 && val.length < 10) return false;
            return true;
        });
        if (!hasAllAgentLocales) return false;

        // 检查 description 是否有所有语言版本
        const desc = skill.description;
        if (typeof desc === 'string') return false; // 纯字符串 = 未翻译
        const hasAllDesc = SUPPORTED_LOCALES.every(loc => desc[loc] && desc[loc].trim().length > 0);
        if (!hasAllDesc) return false;

        return true;
    }

    // Helper: 检查 skill 是否有更新 (updatedAt > lastSynced)
    function hasSkillUpdated(skill: SkillCache, freshUpdatedAt?: string): boolean {
        if (!skill.lastSynced) return true; // 从未同步过
        if (freshUpdatedAt) {
            return new Date(freshUpdatedAt) > new Date(skill.lastSynced);
        }
        if (skill.updatedAt) {
            return new Date(skill.updatedAt) > new Date(skill.lastSynced);
        }
        return false;
    }

    // Helper to get or translate metadata (Description + SEO)
    async function processMetadata(
        id: string,
        text: string,
        context?: TranslateContext,
        freshUpdatedAt?: string
    ): Promise<{ description: string | Record<string, string>, seo?: SeoData }> {
        const existing = existingMap.get(id);

        // 增量翻译: 已完整翻译 + 没有更新 → 跳过
        if (!force && existing && isTranslationComplete(existing) && !hasSkillUpdated(existing, freshUpdatedAt)) {
            process.stdout.write('s'); // s = skip (已完成)
            return { description: existing.description, seo: existing.seo };
        }

        process.stdout.write('T'); // T for Translating/Generating
        return await aiService.translateMetadata(text, context);
    }

    // 1. 处理官方仓库 (仅在 update 模式下，或者 discover 模式下检查是否存在)
    if (mode === 'update') {
        console.log('📦 Processing official repos...');
        for (const repo of OFFICIAL_REPOS) {
            const repoPath = `${repo.owner}/${repo.repo}`;
            console.log(`   → ${repoPath}`);

            const repoInfo = await fetchRepoInfo(repo.owner, repo.repo);
            if (!repoInfo) {
                console.log(`   ⚠️ Failed to fetch repo info`);
                continue;
            }

            if (repo.skillsPath) {
                try {
                    const contentsUrl = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${repo.skillsPath}`;
                    const contentsRes = await fetchWithRetry(contentsUrl);
                    if (contentsRes.ok) {
                        const contents = await contentsRes.json() as any;

                        let skillDirs: any[] = [];
                        if (Array.isArray(contents)) {
                            skillDirs = contents.filter((item: any) => item.type === 'dir' && !item.name.startsWith('.'));
                        } else if (contents.type === 'file') {
                            // If skillsPath points to a file (like README.md), use the filename (e.g. README.md) as the skill name
                            // This ensures the skillId becomes 'owner/repo/README.md'
                            skillDirs = [{ name: repo.skillsPath, type: 'file', path: contents.path, download_url: contents.download_url }];
                        }

                        console.log(`      Found ${skillDirs.length} skills in ${repo.skillsPath}`);

                        for (const skillDir of skillDirs) {
                            const skillId = `${repoPath}/${skillDir.name}`;
                            if (processedRepos.has(skillId)) continue;

                            console.log(`      Found candidate: ${skillDir.name}`);

                            // Check filter for individual skills within the repo
                            if (filters.length > 0) {
                                const match = filters.some(f =>
                                    skillDir.name.toLowerCase().includes(f) ||
                                    repo.owner.toLowerCase().includes(f) ||
                                    repo.repo.toLowerCase().includes(f)
                                );
                                if (!match) continue;
                            }

                            processedRepos.add(skillId);

                            // INCREMENTAL CHECK: If we already have this skill in cache with a body, and it's recent, skip fetching
                            const existing = existingMap.get(skillId);
                            // If we have existing data, and it has a body, and we are not forcing update
                            // And it was synced recently (e.g. within 24 hours), we can likely skip fetching content
                            // We still might want to check for updates if it's been a while, but for now let's trust the body
                            if (existing && existing.skillMd?.body && !force) {
                                // Check if it needs update based on repo updated_at
                                if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                                    console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${skillDir.name}`);
                                    skills.push(existing);
                                    process.stdout.write('s');
                                    // Live sync cached official skills
                                    if (liveSync) {
                                        await kvService.pushSkill(existing);
                                    }
                                    continue;
                                }
                            }

                            let skillMdContent = '';
                            let isSingleFile = false;

                            if (skillDir.type === 'file') {
                                isSingleFile = true;
                                try {
                                    // Use download_url from API if available, otherwise construct raw URL
                                    const url = skillDir.download_url || `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/${repo.skillsPath}`;
                                    const res = await fetch(url);
                                    if (res.ok) {
                                        skillMdContent = await res.text();
                                    }
                                } catch (e) {
                                    console.log(`      ⚠️ Failed to fetch file content: ${e}`);
                                }
                            } else {
                                const skillMdPath = `${repo.skillsPath}/${skillDir.name}/SKILL.md`;
                                const defaultBranch = repoInfo?.default_branch;
                                const branches = [defaultBranch, 'main', 'master', 'canary', 'develop'].filter((b, i, a) => b && a.indexOf(b) === i);
                                for (const branch of branches) {
                                    try {
                                        const mdUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${skillMdPath}`;
                                        const mdRes = await fetch(mdUrl);
                                        if (mdRes.ok) {
                                            skillMdContent = await mdRes.text();
                                            break;
                                        }
                                    } catch { }
                                }
                            }

                            const parsed = skillMdContent ? parseSkillMd(skillMdContent) : undefined;

                            // Fallback for README.md or non-standard skills
                            const skillMd = parsed || (isSingleFile ? {
                                name: (repo as any).displayName || repoInfo.name, // Use displayName from config if available
                                description: repoInfo.description,
                                bodyPreview: skillMdContent.slice(0, 5000), // Use content as body for AI to analyze
                                tags: repoInfo.topics
                            } : undefined);

                            const rawDesc = skillMd?.description || '';

                            const metadata = await processMetadata(skillId, rawDesc, {
                                name: skillMd?.name || skillDir.name,
                                topics: repoInfo.topics || [],
                                bodyPreview: skillMd?.bodyPreview
                            });

                            const skill: SkillCache = {
                                id: skillId,
                                name: skillMd?.name || skillDir.name,
                                description: metadata.description,
                                owner: repo.owner,
                                repo: repo.repo,
                                repoPath,
                                stars: repoInfo.stargazers_count,
                                forks: repoInfo.forks_count,
                                updatedAt: repoInfo.updated_at,
                                topics: repoInfo.topics || [],
                                skillMd,
                                category: 'official',
                                lastSynced: new Date().toISOString(),
                                seo: metadata.seo,
                            };

                            // Generate Agent Analysis + translate
                            const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, rawDesc, skillMd?.bodyPreview || '');
                            if (rawAgentAnalysis) {
                                skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                            }

                            console.log(`      ✅ Added skill: ${skill.name} (${skill.id})`);
                            skill.qualityScore = calculateQualityScore(skill);
                            skills.push(skill);
                            process.stdout.write('.');
                            // Live sync newly processed official skills
                            if (liveSync) {
                                await kvService.pushSkill(skill);
                            }
                        }
                    }
                } catch (e) {
                    console.log(`      ⚠️ Failed to list skills directory: ${e}`);
                }
            } else {
                const skillId = repoPath;

                if (!processedRepos.has(skillId)) {
                    processedRepos.add(skillId);

                    // INCREMENTAL CHECK: Single-file repo
                    const existing = existingMap.get(skillId);
                    if (existing && existing.skillMd?.body && !force) {
                        if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                            console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${repo.repo}`);
                            skills.push(existing);
                            process.stdout.write('s');
                            // Live sync cached single-repo official skills
                            if (liveSync) {
                                await kvService.pushSkill(existing);
                            }
                            continue;
                        }
                    }

                    const skillMdContent = await fetchSkillMd(repo.owner, repo.repo, '');
                    const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
                    const rawDesc = skillMd?.description || repoInfo.description || '';

                    const metadata = await processMetadata(skillId, rawDesc, {
                        name: skillMd?.name || repoInfo.name,
                        topics: repoInfo.topics || [],
                        bodyPreview: skillMd?.bodyPreview
                    });

                    const skill: SkillCache = {
                        id: skillId,
                        name: skillMd?.name || repoInfo.name,
                        description: metadata.description,
                        seo: metadata.seo,
                        owner: repo.owner,
                        repo: repo.repo,
                        repoPath,
                        stars: repoInfo.stargazers_count,
                        forks: repoInfo.forks_count,
                        updatedAt: repoInfo.updated_at,
                        topics: repoInfo.topics || [],
                        skillMd,
                        category: 'official',
                        lastSynced: new Date().toISOString(),
                    };

                    // Generate Agent Analysis + translate
                    const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, rawDesc, skillMd?.bodyPreview || '');
                    if (rawAgentAnalysis) {
                        skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                    }

                    skill.qualityScore = calculateQualityScore(skill);
                    skills.push(skill);
                    process.stdout.write('.');
                    // Live sync newly processed single-repo official skills
                    if (liveSync) {
                        await kvService.pushSkill(skill);
                    }
                }
            }
        }
    } else {
        console.log('📦 Skipping official repos check (Discover Mode)');
        // In discover mode, we still need to keep existing official skills in the list
        // We'll load them from existingMap later in step 3
    }

    // 2. 搜索更多 Skills
    console.log('\n🔍 Searching for more skills...');
    const searchResults = await searchGitHubSkills();
    const skillsToProcess: any[] = [];

    for (const item of searchResults) {
        // Handle both GitHub API format and local backup format
        let repoName = '';
        let ownerLogin = '';
        let stars = 0;
        let forks = 0;
        let updatedAt = new Date().toISOString();
        let topics: string[] = [];
        let rawDesc = '';
        let content = '';
        let filePath = '';

        if (item.repository) {
            // GitHub API format
            const repo = item.repository;
            repoName = repo.name;
            ownerLogin = typeof repo.owner === 'object' ? repo.owner.login : repo.owner;
            stars = repo.stargazers_count;
            forks = repo.forks_count;
            updatedAt = repo.updated_at;
            topics = repo.topics || [];
            rawDesc = repo.description || '';
            filePath = item.path || '';
        } else {
            // Local backup format (flat structure)
            repoName = item.repo;
            ownerLogin = item.owner;
            stars = item.stars || 0;
            forks = item.forks || 0;
            updatedAt = item.fetchedAt || item.updatedAt || new Date().toISOString();
            topics = item.topics || [];
            rawDesc = item.description || '';
            content = item.content || '';
            filePath = item.filePath || '';
        }

        // Bug Fix: 使用 repoPath + skillName 作为去重键
        // Note: we can't be 100% sure of skillId until we parse skillMd
        // But we can check if any skill from this repo/path is already in processed-repos
        const repoPath = `${ownerLogin}/${repoName}`;
        const dedupeKey = filePath ? `${repoPath}/${filePath}` : repoPath;
        if (processedRepos.has(dedupeKey)) continue;

        // NEW: Check if this repo/path is already in existingMap and complete
        // We look for any skill that matches this owner/repo/path
        const existingSkill = Array.from(existingMap.values()).find(s =>
            s.owner === ownerLogin && s.repo === repoName && (s.repoPath === repoPath || s.id.startsWith(repoPath))
        );

        if (existingSkill && isTranslationComplete(existingSkill)) {
            skills.push(existingSkill);
            // We need a unique ID for processedRepos, use the one from cache
            processedRepos.add(existingSkill.id);
            process.stdout.write('s');
            continue;
        }

        // Content fetching moved to parallel step
        // if (!content) continue; // Allow empty content to proceed to parallel step

        skillsToProcess.push({
            owner: ownerLogin,
            repo: repoName,
            stars: stars,
            forks: forks,
            updatedAt: updatedAt,
            topics: topics,
            description: rawDesc,
            content: content,
            filePath: filePath,
        });
    }

    const limit = pLimit(8); // Concurrency 8
    await Promise.all(skillsToProcess.map((item: any) => limit(async () => {
        try {
            // 0. Fetch content if missing (Parallelized)
            if (!item.content && item.filePath) {
                try {
                    const repoPath = `${item.owner}/${item.repo}`;
                    const filePath = item.filePath;

                    // Bug Fix: 严格验证文件名
                    const fileName = filePath.split('/').pop() || '';
                    const isValidFile = fileName === 'SKILL.md' || fileName === 'SKILL.MD'
                        || (filePath.includes('/skills/') && fileName.toLowerCase() === 'skill.md');

                    if (isValidFile) {
                        const branch = 'main';
                        const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`;
                        let res = await fetchWithTimeout(rawUrl);
                        if (res.ok) {
                            item.content = await res.text();
                        } else {
                            // Try master branch
                            const masterUrl = `https://raw.githubusercontent.com/${repoPath}/master/${filePath}`;
                            res = await fetchWithTimeout(masterUrl);
                            if (res.ok) {
                                item.content = await res.text();
                            }
                        }
                    }
                    // Jitter delay (100-500ms)
                    await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
                } catch (e) { console.error(`Fetch failed for ${item.repo}:`, e); }
            }

            // Fallback fetch
            if (!item.content) {
                try {
                    const fetched = await fetchSkillMd(item.owner, item.repo, item.filePath ? item.filePath.replace('/SKILL.md', '').replace('SKILL.md', '') : '');
                    if (fetched) item.content = fetched;
                } catch { }
            }

            if (!item.content) return;

            // 1. Validation & Parsing checks
            const skillMd = parseSkillMd(item.content);
            if (!skillMd || !skillMd.name) {
                // Invalid structure - not a proper SKILL.md
                return;
            }

            // 2. Generate Unique ID
            // Use repoPath + skillName to allow multiple skills per repo
            const repoPath = `${item.owner}/${item.repo}`;
            const skillId = `${repoPath}/${skillMd.name}`;

            if (processedRepos.has(skillId)) return;

            // Check if existing in cache
            const existing = existingMap.get(skillId);
            if (!force && existing && isTranslationComplete(existing) && !hasSkillUpdated(existing, item.updatedAt)) {
                skills.push(existing);
                processedRepos.add(skillId);
                process.stdout.write('s');
                // Live sync even skipped skills — their local data may be newer than KV
                if (liveSync) {
                    await kvService.pushSkill(existing);
                }
                return;
            }

            processedRepos.add(skillId);

            // console.log(`   → ${skillId}`);
            process.stdout.write('.');

            const metadata = await processMetadata(skillId, item.description || '', {
                name: skillMd.name,
                topics: item.topics || [],
                bodyPreview: skillMd.bodyPreview
            });

            const skill: SkillCache = {
                id: skillId,
                name: skillMd.name,
                description: metadata.description,
                seo: metadata.seo,
                owner: item.owner,
                repo: item.repo,
                repoPath,
                stars: item.stars || 0,
                forks: item.forks || 0,
                updatedAt: item.updatedAt || new Date().toISOString(),
                topics: item.topics || [],
                category: 'community',
                skillMd: skillMd,
                lastSynced: new Date().toISOString(),
            };

            // Generate Agent Analysis + translate
            const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, typeof skill.description === 'string' ? skill.description : skill.description.en, skillMd.bodyPreview || '');
            if (rawAgentAnalysis) {
                skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
            }

            skill.qualityScore = calculateQualityScore(skill);
            skills.push(skill);
            console.log(`[DEBUG] Pushed ${skill.name}. Total: ${skills.length}. Should save? ${skills.length % 1 === 0}`);

            // Auto-save every 1 processing new skills
            if (skills.length % 1 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                await saveStateOnly(skills);
            }
            // Live sync to KV if --live flag is set
            if (liveSync) {
                await kvService.pushSkill(skill);
            }
        } catch (e) {
            console.error(`\n❌ Error processing ${item.owner}/${item.repo}:`, e);
        }
    })));

    // 2.5 自动发现 GitHub 上新发布的 Skills
    console.log('\n🔎 Auto-discovering new Skills from GitHub...');
    const discoveredSkills = await discoverNewSkillsFromGitHub(processedRepos, lastCacheUpdate, mode === 'full-discovery');

    const limit2 = pLimit(8);
    await Promise.all(discoveredSkills.map(item => limit2(async () => {
        try {
            const skillMd = parseSkillMd(item.content);
            if (!skillMd || !skillMd.name) return;

            const repoPath = `${item.owner}/${item.repo}`;
            const skillId = `${repoPath}/${skillMd.name}`;

            if (processedRepos.has(skillId)) return;

            // Apply Filter for discovered skills
            if (filters.length > 0) {
                const match = filters.some(f =>
                    skillMd.name.toLowerCase().includes(f) ||
                    item.repo.toLowerCase().includes(f) ||
                    item.owner.toLowerCase().includes(f)
                );
                if (!match) return;
            }

            // 快速预验证：如果质量分太低，直接跳过不处理元数据
            // 构造一个临时对象进行评分
            const tempSkill: any = {
                id: skillId,
                name: skillMd.name,
                description: skillMd.description || item.description || '',
                owner: item.owner,
                repo: item.repo,
                repoPath: `${item.owner}/${item.repo}`,
                stars: item.stars || 0,
                updatedAt: item.updatedAt || new Date().toISOString(),
                skillMd: skillMd
            };

            const strictScore = calculateQualityScore(tempSkill);

            // 严格模式：新发现的技能如果分数低于 20 (was 30)，直接丢弃
            if (strictScore < 20) {
                // console.log(`Skipping low quality skill: ${skillId} (Score: ${strictScore})`);
                return;
            }

            processedRepos.add(skillId);

            const rawDesc = skillMd.description || item.description || '';
            const metadata = await processMetadata(skillId, rawDesc, {
                name: skillMd.name,
                topics: item.topics || [],
                bodyPreview: skillMd.bodyPreview
            });

            const skill: SkillCache = {
                id: skillId,
                name: skillMd.name,
                description: metadata.description,
                seo: metadata.seo,
                agentAnalysis: undefined, // Will be populated in update step
                owner: item.owner,
                repo: item.repo,
                repoPath: `${item.owner}/${item.repo}`,
                stars: item.stars || 0,
                forks: item.forks || 0,
                updatedAt: item.fetchedAt || new Date().toISOString(),
                topics: item.topics || [],
                category: 'community',
                skillMd: skillMd,
                lastSynced: new Date().toISOString(),
            };

            skill.category = determineCategory(skill);
            skills.push(skill);
            process.stdout.write('+'); // + for newly discovered and added
            console.log(`[DEBUG] Pushed discovered ${skill.name}. Total: ${skills.length}.`);

            // Auto-save every 1 processing new skills
            if (skills.length % 1 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                await saveStateOnly(skills);
            }
            // Live sync to KV if --live flag is set
            if (liveSync) {
                await kvService.pushSkill(skill);
            }
        } catch (e) {
            console.error(`\n❌ Error processing discovered skill:`, e);
        }
    })));

    if (discoveredSkills.length > 0) {
        console.log(`\n   → Added ${discoveredSkills.length} newly discovered Skills`);
    }

    // 3. 保留并重新优化现有缓存项 (Preserve & Smart Update)
    console.log(`\n📦 Auditing & Optimizing existing cache items (Concurrency: 5)...`);

    // 准备任务列表
    const tasks: SkillCache[] = [];
    let processedCount = 0;

    if (mode === 'update') {
        for (const [id, skill] of existingMap.entries()) {
            if (!processedRepos.has(id)) {
                // Apply Filter for existing items
                if (filters.length > 0) {
                    const match = filters.some(f =>
                        skill.name.toLowerCase().includes(f) ||
                        skill.repo.toLowerCase().includes(f) ||
                        skill.owner.toLowerCase().includes(f)
                    );
                    if (!match) {
                        skills.push(skill); // Preserve without processing
                        continue; // Skip adding to tasks
                    }
                }
                tasks.push(skill);
            }
        }
    } else {
        // In DISCOVER mode, we just keep existing skills without re-processing/verifying
        // unless they are completely missing from our current 'skills' array (which contains new discoveries)
        console.log(`\n⏭️  Skipping deep update of existing skills (Discover Mode)`);
        for (const [id, skill] of existingMap.entries()) {
            if (!processedRepos.has(id)) {
                skills.push(skill); // Just add them back directly
            }
        }
    }

    if (mode === 'update') {
        // Simple p-limit implementation to avoid adding dependencies
        const pLimit = (concurrency: number) => {
            const queue: (() => Promise<void>)[] = [];
            let activeCount = 0;

            const next = () => {
                activeCount--;
                if (queue.length > 0) {
                    const job = queue.shift()!;
                    activeCount++;
                    job().then(next);
                }
            };

            const run = (fn: () => Promise<void>) => new Promise<void>((resolve, reject) => {
                const job = async () => {
                    try {
                        await fn();
                    } catch (e) {
                        reject(e);
                    } finally {
                        resolve();
                    }
                };

                if (activeCount < concurrency) {
                    activeCount++;
                    job().then(next);
                } else {
                    queue.push(job);
                }
            });

            return run;
        };

        // 4 NVIDIA API keys × ~4 concurrent requests per key
        const CONCURRENCY = 15;
        const limit = pLimit(CONCURRENCY);

        console.log(`\n🚀 Processing ${tasks.length} skills with Concurrency=${CONCURRENCY} (4 NVIDIA keys)...`);

        const promises = tasks.map(skill => limit(async () => {
            // No delay needed - 4 NVIDIA keys handle rate limiting via rotation

            const currentDesc = typeof skill.description === 'string' ? skill.description : (skill.description.en || '');

            // 增量翻译: 翻译完整 + 无更新 → 跳过
            if (isTranslationComplete(skill) && !hasSkillUpdated(skill)) {
                skills.push(skill);
                process.stdout.write('s'); // skip (已完整翻译)
            } else {
                const rawDesc = skill.skillMd?.description || currentDesc || '';
                const context = {
                    name: skill.name,
                    topics: skill.topics,
                    bodyPreview: skill.skillMd?.bodyPreview
                };

                // Add random delay to prevent initial burst
                await new Promise(r => setTimeout(r, Math.random() * 2000));

                const metadata = await processMetadata(skill.id, rawDesc, context);
                skill.description = metadata.description;
                skill.seo = metadata.seo;

                // Generate Agent Analysis + translate
                const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, currentDesc, context.bodyPreview || '');
                if (rawAgentAnalysis) {
                    skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                }

                skill.lastSynced = new Date().toISOString();

                skills.push(skill);
                processedCount++;
                process.stdout.write('U'); // update (需要翻译)

                // Periodic Save every 50 updates
                if (processedCount % 50 === 0) {
                    console.log(`\n💾 Auto-saving checkpoint (${processedCount} updates)...`);
                    await saveStateOnly(skills);
                }
                // Live sync to KV if --live flag is set
                if (liveSync) {
                    await kvService.pushSkill(skill);
                }
            }
        }));

        await Promise.all(promises);
    } // End of if (mode === 'update')

    console.log(`\n   → Processed ${tasks.length} existing skills (Optimized: ${processedCount})`);

    await finalizeAndSave(skills);
}

/**
 * Finalize, clean up, and save the cache to file and KV
 */
async function finalizeAndSave(skills: SkillCache[]): Promise<void> {
    console.log(`\n🧹 Running final cleanup & saving...`);
    const beforeCount = skills.length;

    // helper to get desc text
    const getDescText = (s: SkillCache) =>
        typeof s.description === 'string' ? s.description : (s.description.en || '');

    // Map by name to find duplicates
    const nameMap = new Map<string, SkillCache>();

    for (const skill of skills) {
        const desc = getDescText(skill);
        // Explicitly check if it is an official repo
        const isOfficial = OFFICIAL_REPOS.some(or => or.owner === skill.owner && or.repo === skill.repo) || skill.category === 'official';

        // Rule 0: Critical Quality Score (Must be > 20) for non-official
        if (!isOfficial && (skill.qualityScore || 0) < 20) {
            continue;
        }

        // Rule 1: Minimum Description Length (10 chars)
        if (!isOfficial && desc.length < 10) {
            continue;
        }

        // Rule 2: Minimum Stars (1) for non-official
        if (!isOfficial && skill.stars < 1) {
            continue;
        }

        // Rule 3: Deduplication
        if (nameMap.has(skill.name)) {
            const existing = nameMap.get(skill.name)!;
            const existingIsOfficial = OFFICIAL_REPOS.some(or => or.owner === existing.owner && or.repo === existing.repo) || existing.category === 'official';

            // Official always wins
            if (isOfficial && !existingIsOfficial) {
                nameMap.set(skill.name, skill);
                continue;
            }
            if (existingIsOfficial && !isOfficial) {
                continue;
            }

            // If both official or both community, compare Stars
            if (skill.stars > existing.stars) {
                nameMap.set(skill.name, skill);
            }
        } else {
            nameMap.set(skill.name, skill);
        }
    }

    const cleanedSkills = Array.from(nameMap.values()).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    console.log(`   → Removed ${beforeCount - cleanedSkills.length} low-quality/duplicate skills`);
    console.log(`   → Final count: ${cleanedSkills.length}`);

    // 4. 保存缓存
    const cacheData: CacheData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        totalCount: cleanedSkills.length,
        skills: cleanedSkills,
    };

    const outputDir = path.join(process.cwd(), 'data');
    const outputFile = path.join(outputDir, 'skills-cache.json');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));

    console.log(`\n✅ Cache saved successfully!`);
    console.log(`   📊 Total skills: ${cleanedSkills.length}`);
    console.log(`   📁 Output: ${outputFile}`);

    // ========== Generate Sitemap Data ==========
    const sitemapData = cleanedSkills
        .filter(s => s.owner && s.repo)
        .map(s => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt }));
    const sitemapFile = path.join(outputDir, 'sitemap-skills.json');
    fs.writeFileSync(sitemapFile, JSON.stringify(sitemapData, null, 2));
    console.log(`   🗺️  Sitemap data generated: ${sitemapFile} (${sitemapData.length} items)`);

    // ========== 直接同步到 Cloudflare KV ==========
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5'; // SKILLS_CACHE

    if (CF_API_TOKEN && CF_ACCOUNT_ID) {
        console.log(`\n📤 Syncing to Cloudflare KV...`);
        try {
            const slimmedSkills = cleanedSkills.map(skill => {
                const summary = { ...skill };
                if (summary.skillMd) {
                    const { body, bodyPreview, raw, ...keep } = summary.skillMd as any;
                    summary.skillMd = keep;
                }
                delete (summary as any).readme;
                delete (summary as any).content;
                return summary;
            });

            const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/all-skills`;
            const response = await fetch(kvUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(slimmedSkills),
            });

            if (response.ok) {
                console.log(`   ✅ Successfully synced ${slimmedSkills.length} skills to KV (slimmed)!`);
            } else {
                const error = await response.text();
                console.error(`   ❌ KV sync failed: ${error}`);
            }
        } catch (error) {
            console.error(`   ❌ KV sync error:`, error);
        }
    }
    // ========== 清除本地 miniflare KV 缓存 ==========
    // 确保 dev server 使用最新的 skills-cache.json 而非过期的 miniflare KV 数据
    const miniflareKvDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', KV_NAMESPACE_ID);
    if (fs.existsSync(miniflareKvDir)) {
        try {
            fs.rmSync(miniflareKvDir, { recursive: true, force: true });
            console.log(`   🧹 Cleared local miniflare KV cache (${miniflareKvDir})`);
        } catch (error) {
            console.warn(`   ⚠️ Failed to clear miniflare KV cache:`, error);
        }
    }
}
/**
 * Quick save state (Raw JSON only, no KV sync)
 */
/**
 * Push a single skill to Cloudflare KV for real-time frontend updates.
 * Uses the same API as sync-to-kv.ts but writes only `skill:{id}` key.
 * Non-blocking: failures are logged but don't interrupt the build.
 * Reuses KV_NAMESPACE_ID from line ~237 and env vars from dotenv.
 */

async function saveStateOnly(skills: SkillCache[]): Promise<void> {
    const outputDir = path.join(process.cwd(), 'data');
    const outputFile = path.join(outputDir, 'skills-cache.json');
    console.log(`[DEBUG] Saving state to ${outputFile}...`);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // IMPORTANT: Merge current session progress with existingMap to avoid losing data
    // existingMap contains the full previous cache items
    const allSkillsMap = new Map<string, SkillCache>();

    // 1. Load from file first if it exists (in case other processes or manual edits happened)
    if (fs.existsSync(outputFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8')) as CacheData;
            if (data.skills) data.skills.forEach(s => allSkillsMap.set(s.id, s));
        } catch (e) { /* ignore */ }
    }

    // 2. Overwrite with current session skills
    skills.forEach(s => allSkillsMap.set(s.id, s));

    const uniqueSkills = Array.from(allSkillsMap.values());

    const cacheData: CacheData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        totalCount: uniqueSkills.length,
        skills: uniqueSkills,
    };
    fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));
}

// Global reference for SIGINT handler
let globalSkillsRef: SkillCache[] = [];

// 运行
(async () => {
    globalSkillsRef = []; // Initialize
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Received SIGINT (Ctrl+C). Saving current progress...');
        await saveStateOnly(globalSkillsRef);
        console.log('✅ Progress saved. Exiting.');
        process.exit(0);
    });

    await buildCache();
})().catch(console.error);

