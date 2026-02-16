/**
 * Debug Skill Script
 * 运行: npx tsx scripts/debug-skill.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { AIService } from './lib/ai';
import { KVService } from './lib/kv'; // Optional if used later
import {
    CATEGORY_RULES,
    OFFICIAL_REPOS,
    isOfficialRepo,
    GITHUB_API
} from './lib/constants';
import { calculateQualityScore as sharedCalculateQualityScore } from '../src/lib/shared/validation';
import type { SkillCache, TranslateContext, SeoData, CacheData } from './lib/types';

// Try loading .env.local if available
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

// ===== Service Instances =====
const aiService = new AIService();
const kvService = new KVService(); // Keeping for consistency or potential usage

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Category Determination (Local copy as in build script)
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

// SEO 数据现在直接从缓存的 description 字段获取，无需单独生成



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
    return items;
}

/**
 * 自动发现 GitHub 上新发布的 Skills
 * 使用 GitHub Code Search API 搜索包含 SKILL.md 的仓库
 */
async function discoverNewSkillsFromGitHub(existingIds: Set<string>): Promise<any[]> {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GITHUB_TOKEN not set, skipping auto-discovery');
        return [];
    }

    console.log('🔎 Discovering new Skills from GitHub...');
    const newSkills: any[] = [];

    // 搜索策略：查找最近更新的包含 SKILL.md 的仓库
    const searchQueries = [
        'filename:SKILL.md path:/ pushed:>2024-01-01',  // 根目录的 SKILL.md
        'filename:SKILL.md path:skills pushed:>2024-01-01',  // skills 目录下的
        'filename:SKILL.md path:.claude pushed:>2024-01-01',  // .claude 目录下的
        'filename:SKILL.md path:.agents pushed:>2024-01-01',  // .agents 目录下的
        'filename:SKILL.md path:.codex pushed:>2024-01-01',  // .codex 目录下的
    ];

    for (const query of searchQueries) {
        try {
            // GitHub Code Search API
            const searchUrl = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=50&sort=indexed&order=desc`;
            const response = await fetch(searchUrl, { headers: getHeaders() });

            if (!response.ok) {
                if (response.status === 403) {
                    console.log('   ⚠️ GitHub API rate limit reached, skipping discovery');
                    break;
                }
                continue;
            }

            const data = await response.json() as any;
            const items = data.items || [];

            for (const item of items) {
                const repoFullName = item.repository?.full_name;
                if (!repoFullName) continue;

                const [owner, repo] = repoFullName.split('/');
                const filePath = item.path;

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
                    const contentRes = await fetch(rawUrl);
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

                    // 限制每次最多发现 20 个新 Skills，避免 API 过载
                    if (newSkills.length >= 20) {
                        console.log(`\n   → Reached discovery limit (20), stopping...`);
                        return newSkills;
                    }
                } catch {
                    continue;
                }
            }

            // 短暂休息，避免触发限流
            await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            console.error(`   Error searching with query "${query}":`, e);
        }
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
            const response = await fetch(url, { headers: getHeaders() });
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
    const paths = skillsPath
        ? [`${skillsPath}/SKILL.md`, 'SKILL.md']
        : [
            'SKILL.md',
            '.codex/skills/SKILL.md',
            '.claude/skills/SKILL.md',
            '.agent/skills/SKILL.md',
            `skills/${repo}/SKILL.md`,
            `.codex/skills/${repo}/SKILL.md`,
            `.claude/skills/${repo}/SKILL.md`
        ];

    for (const p of paths) {
        try {
            const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`;
            const response = await fetch(url);
            if (response.ok) return response.text();

            // 尝试 master 分支
            const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${p}`;
            const masterResponse = await fetch(masterUrl);
            if (masterResponse.ok) return masterResponse.text();
        } catch {
            continue;
        }
    }
    return null;
}

function parseSkillMd(content: string): SkillCache['skillMd'] & { body?: string } | undefined {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
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

    console.log(`🚀 Starting cache build in [${mode.toUpperCase()}] mode... (Force: ${force})\n`);

    if (!['discover', 'update'].includes(mode)) {
        console.error(`❌ Invalid mode: ${mode}. Use --mode=discover or --mode=update`);
        process.exit(1);
    }

    // Load existing cache
    let existingMap = new Map<string, SkillCache>();
    const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
    if (fs.existsSync(cachePath)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheData;
            oldData.skills.forEach(s => existingMap.set(s.id, s));
            console.log(`📚 Loaded ${existingMap.size} skills from cache`);
        } catch { }
    }

    const skills: SkillCache[] = [];
    const processedRepos = new Set<string>();

    // Helper to get or translate metadata (Description + SEO)
    async function processMetadata(
        id: string,
        text: string,
        context?: TranslateContext
    ): Promise<{ description: string | Record<string, string>, seo?: SeoData }> {
        const existing = existingMap.get(id);

        // Check if existing data is sufficient
        if (!force && existing && existing.seo &&
            existing.seo.definition && existing.seo.definition['zh'] &&
            existing.seo.features && existing.seo.features['zh'] && existing.seo.features['zh'].length > 0 &&
            existing.seo.keywords && existing.seo.keywords['zh'] && existing.seo.keywords['zh'].length > 0
        ) {
            // Already has rich SEO data, reuse it
            return { description: existing.description, seo: existing.seo };
        }

        process.stdout.write('T'); // T for Translating/Generating
        return await aiService.translateMetadata(text, context);
    }

    // 1. 处理官方仓库 (仅在 update 模式下，或者 discover 模式下检查是否存在)
    // In Discover mode, we skip deep checking existing official repos to save time/API
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
                        const contents = await contentsRes.json() as any[];
                        const skillDirs = contents.filter((item: any) => item.type === 'dir' && !item.name.startsWith('.'));

                        console.log(`      Found ${skillDirs.length} skills in ${repo.skillsPath}/`);

                        for (const skillDir of skillDirs) {
                            if (!skillDir.name.includes("python-patterns")) continue;
                            const skillId = `${repoPath}/${skillDir.name}`;
                            if (processedRepos.has(skillId)) continue;
                            processedRepos.add(skillId);

                            const skillMdPath = `${repo.skillsPath}/${skillDir.name}/SKILL.md`;
                            let skillMdContent = '';
                            const branches = ['main', 'master'];
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

                            const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
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
                            skill.qualityScore = calculateQualityScore(skill);
                            skills.push(skill);
                            process.stdout.write('.');
                        }
                    }
                } catch (e) {
                    console.log(`      ⚠️ Failed to list skills directory: ${e}`);
                }
            } else {
                const skillMdContent = await fetchSkillMd(repo.owner, repo.repo, '');
                const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
                const skillId = repoPath;

                if (!processedRepos.has(skillId)) {
                    processedRepos.add(skillId);
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
                    skill.qualityScore = calculateQualityScore(skill);
                    skills.push(skill);
                    process.stdout.write('.');
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
        } else {
            // Local backup format (flat structure)
            repoName = item.repo;
            ownerLogin = item.owner;
            stars = item.stars || 0;
            forks = item.forks || 0;
            updatedAt = item.fetchedAt || new Date().toISOString();
            // topics might not be in local backup based on previous view, but we can try
            topics = item.topics || [];
            rawDesc = item.description || '';
            content = item.content || '';
        }

        const repoPath = `${ownerLogin}/${repoName}`;

        // 1. Validate Structure: Must have content and be parseable
        if (!content) {
            // If no content in item, we might skip it or try to fetch (but for recovery, we rely on backup)
            continue;
        }

        const skillMd = parseSkillMd(content);
        if (!skillMd || !skillMd.name) {
            // Invalid structure - user explicitly asked to remove these
            continue;
        }

        // 2. Generate Unique ID
        // Use repoPath + skillName to allow multiple skills per repo
        const skillId = `${repoPath}/${skillMd.name}`;

        if (processedRepos.has(skillId)) continue;
        processedRepos.add(skillId);

        // console.log(`   → ${skillId}`);
        process.stdout.write('.');

        const metadata = await processMetadata(skillId, rawDesc, {
            name: skillMd.name,
            topics: topics,
            bodyPreview: skillMd.bodyPreview
        });

        const skill: SkillCache = {
            id: skillId,
            name: skillMd.name,
            description: metadata.description,
            seo: metadata.seo,
            owner: ownerLogin,
            repo: repoName,
            repoPath,
            stars: stars,
            forks: forks,
            updatedAt: updatedAt,
            topics: topics,
            category: 'community',
            skillMd: skillMd,
            lastSynced: new Date().toISOString(),
        };

        skill.category = determineCategory(skill);
        skill.qualityScore = calculateQualityScore(skill);
        skills.push(skill);
    }

    // 2.5 自动发现 GitHub 上新发布的 Skills
    console.log('\n🔎 Auto-discovering new Skills from GitHub...');
    const discoveredSkills = await discoverNewSkillsFromGitHub(processedRepos);

    for (const item of discoveredSkills) {
        const skillMd = parseSkillMd(item.content);
        if (!skillMd || !skillMd.name) continue;

        const skillId = item.skillId || `${item.owner}/${item.repo}/${skillMd.name}`;
        if (processedRepos.has(skillId)) continue;

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

        // 严格模式：新发现的技能如果分数低于 30，直接丢弃，不浪费 AI 额度
        if (strictScore < 30) {
            // console.log(`Skipping low quality skill: ${skillId} (Score: ${strictScore})`);
            continue;
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
        skill.qualityScore = calculateQualityScore(skill);
        skills.push(skill);
        process.stdout.write('+'); // + for newly discovered and added
    }

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

        // 分批处理 (Batch Processing)
        const BATCH_SIZE = 5;
        // In DISCOVER mode, processedCount will stay 0


        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (skill) => {
                const currentDesc = typeof skill.description === 'string' ? skill.description : (skill.description.en || '');

                // 智能跳过：如果已经 SEO 优化过（长度足够且包含中文），则只保留不重跑
                // 之前的优化已经跑过了 463 个技能，这里只补漏
                // 智能跳过：如果已经有完整的 SEO 数据，则只保留不重跑
                const hasSeo = skill.seo && skill.seo.definition && skill.seo.definition['zh'];

                if (hasSeo) {
                    skills.push(skill);
                    process.stdout.write('s'); // skip
                } else {
                    const rawDesc = skill.skillMd?.description || currentDesc || '';
                    const context = {
                        name: skill.name,
                        topics: skill.topics,
                        bodyPreview: skill.skillMd?.bodyPreview
                    };

                    const metadata = await processMetadata(skill.id, rawDesc, context);
                    skill.description = metadata.description;
                    skill.seo = metadata.seo;
                    skill.lastSynced = new Date().toISOString();

                    skills.push(skill);
                    processedCount++;
                    process.stdout.write('U'); // update
                }
            }));

            // Batch 之间短暂休息，给 API 喘息时间
            await new Promise(r => setTimeout(r, 50));
        }
    } // End of if (mode === 'update')

    console.log(`\n   → Processed ${tasks.length} existing skills (Optimized: ${processedCount})`);


    // 5. 最终清理 Filtering & Deduplication
    console.log(`\n🧹 Running final cleanup...`);
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

        // Rule 0: Critical Quality Score (Must be > 30)
        // This effectively filters out empty, invalid, or suspicious skills
        if (!isOfficial && (skill.qualityScore || 0) < 30) {
            continue;
        }

        // Rule 1: Minimum Description Length (20 chars) - Redundant if score works, but safe to keep
        if (!isOfficial && desc.length < 20) {
            continue;
        }

        // Rule 2: Minimum Stars (5) for non-official
        if (!isOfficial && skill.stars < 5) {
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

    console.log(`\n✅ Cache built successfully! with Translations`);
    console.log(`   📊 Total skills: ${skills.length}`);
    console.log(`   📁 Output: ${outputFile}`);
    console.log(`   🔄 API Stats: (NVIDIA/Cloudflare usage tracked by AIService)`);

    // ========== 直接同步到 Cloudflare KV ==========
    // 消除 24 小时延迟，Crawler 完成后立即更新网站数据
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5'; // SKILLS_CACHE

    if (CF_API_TOKEN && CF_ACCOUNT_ID) {
        console.log(`\n📤 Syncing to Cloudflare KV...`);
        try {
            const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/all-skills`;
            const response = await fetch(kvUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cleanedSkills),
            });

            if (response.ok) {
                console.log(`   ✅ Successfully synced ${cleanedSkills.length} skills to KV!`);
            } else {
                const error = await response.text();
                console.error(`   ❌ KV sync failed: ${error}`);
            }
        } catch (e) {
            console.error(`   ❌ KV sync error:`, e);
        }
    } else {
        console.log(`\n⚠️ Skipping KV sync (CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set)`);
    }
}

// 运行
buildCache().catch(console.error);

