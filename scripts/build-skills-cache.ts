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
import * as crypto from 'crypto';
import { AIService } from './lib/ai';
import {
    OFFICIAL_REPOS, isOfficialRepo, CATEGORY_RULES,
    EXCLUDE_KEYWORDS, SUSPICIOUS_NAMES, SKILL_HEADERS, FUNCTIONAL_KEYWORDS,
    GITHUB_API, SUPPORTED_LOCALES, KV_NAMESPACE_ID
} from './lib/constants';
import { pLimit, fetchWithTimeout, sleep } from './lib/utils';
import {
    fetchWithRetry, fetchRepoInfo, fetchSkillMd, parseSkillMd,
    searchGitHubSkills, discoverNewSkillsFromGitHub
} from './lib/github';
import type { SeoData, AgentAnalysis, SkillCache, CacheData, TranslateContext } from './lib/types';

// Try loading .env.local if available
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

// ===== Service Instances =====
const aiService = new AIService();

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

    // Max duration parameter for CI/CD timeout prevention
    const durationArg = args.find(arg => arg.startsWith('--max-duration='));
    const maxDurationMinutes = durationArg ? parseInt(durationArg.split('=')[1], 10) : 0;
    const startTimeMs = Date.now();
    let timeLimitReached = false;

    console.log(`🚀 Starting cache build in [${mode.toUpperCase()}] mode... (Force: ${force}, Filter: ${filters.join(',') || 'None'}, Max Duration: ${maxDurationMinutes ? maxDurationMinutes + 'm' : 'Unlimited'})\n`);

    function isTimeUp(): boolean {
        if (timeLimitReached) return true;
        if (!maxDurationMinutes) return false;
        if ((Date.now() - startTimeMs) > maxDurationMinutes * 60 * 1000) {
            console.log(`\n⏳ Time limit of ${maxDurationMinutes} minutes reached. Gracefully shutting down to save progress...`);
            timeLimitReached = true;
            return true;
        }
        return false;
    }

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
        } catch (e) {
            console.error(`⚠️ Failed to load existing cache (corrupted or LFS pointer?):`, e);
        }
    }
    // Snapshot the full initial cache so saveStateOnly never loses startup-loaded data
    globalExistingMap = new Map(existingMap);

    const skills: SkillCache[] = [];
    globalSkillsRef = skills; // Global ref for SIGINT handler
    const processedRepos = new Set<string>();

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

    // Helper: 计算 SHA-256 哈希
    function computeHash(content: string): string {
        return crypto.createHash('sha256').update(content || '').digest('hex');
    }

    // Helper to get or translate metadata (Description + SEO)
    async function processMetadata(
        id: string,
        text: string,
        context?: TranslateContext,
        freshUpdatedAt?: string
    ): Promise<{ description: string | Record<string, string>, seo?: SeoData }> {
        const existing = existingMap.get(id);

        // 增量翻译: 已完整优化 + 没有更新 → 跳过
        if (!force && existing && isSkillFullyOptimized(existing) && !hasSkillUpdated(existing, freshUpdatedAt)) {
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
            if (isTimeUp()) break;
            const repoPath = `${repo.owner}/${repo.repo}`;
            console.log(`   → ${repoPath}`);

            let repoInfo = null;
            let currentRepoEtag: string | undefined = undefined;

            try {
                // Find ANY existing skill from this repo to grab its ETag
                const anyExistingSkill = Array.from(existingMap.values()).find(s => s.owner === repo.owner && s.repo === repo.repo);

                const repoInfoObj = await fetchRepoInfo(repo.owner, repo.repo, anyExistingSkill?.repoEtag);

                if (repoInfoObj?.notModified) {
                    currentRepoEtag = anyExistingSkill?.repoEtag;
                    console.log(`   ⏩ API Skipping entire repo (ETag Match): ${repoPath}`);
                    const repoSkills = Array.from(existingMap.values()).filter(s => s.owner === repo.owner && s.repo === repo.repo);
                    for (const existing of repoSkills) {
                        if (!processedRepos.has(existing.id)) {
                            processedRepos.add(existing.id);

                            // Important: must also update global ref just in case
                            if (!skills.find(s => s.id === existing.id)) {
                                skills.push({
                                    ...existing,
                                    lastSynced: new Date().toISOString()
                                });
                            }
                        }
                    }
                    continue; // Skip the entire repository parsing!!!
                }

                if (repoInfoObj) {
                    repoInfo = repoInfoObj.data;
                    currentRepoEtag = repoInfoObj.etag;
                }
            } catch (e) {
                console.log(`   ⚠️ Failed to fetch repo info (Error: ${e})`);
            }

            if (!repoInfo) {
                // FALLBACK: Try to find existing data from cache if available
                const existingSkill = Array.from(existingMap.values()).find(s => s.owner === repo.owner && s.repo === repo.repo);
                if (existingSkill) {
                    console.log(`   ⚠️ Rate limit/Error fetching repo info. Using cached data from ${existingSkill.id}`);
                    repoInfo = {
                        name: existingSkill.repo,
                        description: typeof existingSkill.description === 'string' ? existingSkill.description : existingSkill.description.en,
                        stargazers_count: existingSkill.stars,
                        forks_count: existingSkill.forks,
                        updated_at: existingSkill.updatedAt,
                        topics: existingSkill.topics,
                        default_branch: 'main',
                    } as any;
                    currentRepoEtag = existingSkill.repoEtag;
                }
            }

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

                            // INCREMENTAL CHECK: If we already have this skill deeply translated and optimized, skip fetching to save time and API limits
                            const existing = existingMap.get(skillId);
                            if (existing && isSkillFullyOptimized(existing) && !force) {
                                // Check if it needs update based on repo updated_at
                                if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                                    console.log(`      ⏩ Skipping fetch (Cached & Optimized): ${skillDir.name}`);
                                    skills.push(existing);
                                    process.stdout.write('s');
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
                                    const res = await fetchWithTimeout(url);
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
                                        const mdRes = await fetchWithTimeout(mdUrl);
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

                            const currentContentHash = computeHash(skillMdContent || rawDesc || '');

                            // INCREMENTAL CHECK: Hash MATCH bypass AI calls completely!
                            let existingHash = existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

                            // If we STILL don't have an existing hash (because old caches stripped .body),
                            // we can fetch the old content using the old commit hash/branch IF we had it,
                            // but actually, we don't have the old commit hash.
                            // However, we CAN just assume the contentHash is the currentContentHash IF
                            // `existing.description` is a fully translated object and force is false.
                            // But wait, what if the repo DID change? We don't know if SKILL.md changed.
                            // So we MUST generate a new translation if we can't be sure it didn't change!
                            // Wait, no - we CAN do a quick similarity check on the `bodyPreview`!
                            // `existing.skillMd.bodyPreview` is 500 chars.
                            // If the new `skillMd` starts with the exact same 500 chars, it's highly likely unchanged!
                            if (!existingHash && existing?.skillMd?.bodyPreview && skillMd?.bodyPreview) {
                                if (existing.skillMd.bodyPreview === skillMd.bodyPreview) {
                                    existingHash = currentContentHash; // Force match!
                                }
                            }

                            let metadataDescription = existing?.description || '';
                            let metadataSeo = existing?.seo;
                            let agentAnalysis = existing?.agentAnalysis;

                            if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
                                process.stdout.write('H'); // H = Hash Match Faster Skip
                                metadataDescription = existing.description;
                                metadataSeo = existing.seo;
                                agentAnalysis = existing.agentAnalysis;
                            } else {
                                const metadata = await processMetadata(skillId, rawDesc, {
                                    name: skillMd?.name || skillDir.name,
                                    topics: repoInfo.topics || [],
                                    bodyPreview: skillMd?.bodyPreview
                                });
                                metadataDescription = metadata.description;
                                metadataSeo = metadata.seo;

                                // Generate Agent Analysis + translate
                                const rawAgentAnalysis = await aiService.generateAgentAnalysis(skillMd?.name || skillDir.name, rawDesc, skillMd?.bodyPreview || '');
                                if (rawAgentAnalysis) {
                                    agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                                }
                            }

                            const skill: SkillCache = {
                                id: skillId,
                                name: skillMd?.name || skillDir.name,
                                description: metadataDescription,
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
                                seo: metadataSeo,
                                agentAnalysis: agentAnalysis,
                                contentHash: currentContentHash,
                                repoEtag: currentRepoEtag,
                            };

                            console.log(`      ✅ Added skill: ${skill.name} (${skill.id})`);
                            skill.qualityScore = calculateQualityScore(skill);
                            skills.push(skill);
                            globalSkillsRef = skills; // Update reference

                            // NEW: Auto-save checkpoint
                            if (skills.length % 5 === 0) {
                                console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
                                await saveStateOnly(skills);
                            }
                            process.stdout.write('.');

                        }
                    }
                } catch (e) {
                    console.log(`      ⚠️ Failed to list skills directory: ${e}`);

                    // FALLBACK: Use cached skills for this repo
                    const repoSkills = Array.from(existingMap.values()).filter(s => s.owner === repo.owner && s.repo === repo.repo);
                    if (repoSkills.length > 0) {
                        console.log(`      ⚠️ Using ${repoSkills.length} cached skills for ${repoPath} due to error`);
                        for (const existing of repoSkills) {
                            const skillId = existing.id;
                            if (processedRepos.has(skillId)) continue;
                            processedRepos.add(skillId);

                            // Check filter
                            if (filters.length > 0) {
                                const match = filters.some(f =>
                                    skillId.toLowerCase().includes(f) ||
                                    repo.owner.toLowerCase().includes(f) ||
                                    repo.repo.toLowerCase().includes(f)
                                );
                                if (!match) continue;
                            }

                            console.log(`      Found candidate (cached): ${existing.name}`);

                            // Use existing metadata/content
                            const skillMd = existing.skillMd;
                            const rawDesc = skillMd?.description || (typeof existing.description === 'string' ? existing.description : existing.description.en);
                            const bodyPreview = skillMd?.bodyPreview || ''; // Use bodyPreview if available

                            const skill: SkillCache = {
                                ...existing,
                                lastSynced: new Date().toISOString() // Update sync time
                            };

                            // RE-GENERATE AI text
                            process.stdout.write('T');
                            const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, rawDesc, bodyPreview);
                            if (rawAgentAnalysis) {
                                skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                            }

                            skill.qualityScore = calculateQualityScore(skill);
                            skills.push(skill);
                            globalSkillsRef = skills; // Update reference

                            // NEW: Auto-save checkpoint
                            if (skills.length % 5 === 0) {
                                console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
                                await saveStateOnly(skills);
                            }
                            process.stdout.write('.');
                        }
                    }
                }
            } else {
                const skillId = repoPath;

                if (!processedRepos.has(skillId)) {
                    processedRepos.add(skillId);

                    // INCREMENTAL CHECK: Single-file repo
                    const existing = existingMap.get(skillId);
                    if (existing && isSkillFullyOptimized(existing) && !force) {
                        if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                            console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${repo.repo}`);
                            skills.push(existing);
                            process.stdout.write('s');
                            continue;
                        }
                    }

                    const skillMdContent = await fetchSkillMd(repo.owner, repo.repo, '');
                    const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
                    const rawDesc = skillMd?.description || repoInfo.description || '';

                    const currentContentHash = computeHash(skillMdContent || rawDesc || '');

                    let metadataDescription = existing?.description || '';
                    let metadataSeo = existing?.seo;
                    let agentAnalysis = existing?.agentAnalysis;
                    let existingHash = existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

                    if (!existingHash && existing?.skillMd?.bodyPreview && skillMd?.bodyPreview) {
                        if (existing.skillMd.bodyPreview === skillMd.bodyPreview) {
                            existingHash = currentContentHash; // Force match!
                        }
                    }

                    if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
                        process.stdout.write('H');
                        metadataDescription = existing.description;
                        metadataSeo = existing.seo;
                        agentAnalysis = existing.agentAnalysis;
                    } else {
                        const metadata = await processMetadata(skillId, rawDesc, {
                            name: skillMd?.name || repoInfo.name,
                            topics: repoInfo.topics || [],
                            bodyPreview: skillMd?.bodyPreview
                        });
                        metadataDescription = metadata.description;
                        metadataSeo = metadata.seo;

                        const rawAgentAnalysis = await aiService.generateAgentAnalysis(skillMd?.name || repoInfo.name, rawDesc, skillMd?.bodyPreview || '');
                        if (rawAgentAnalysis) {
                            agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                        }
                    }

                    const skill: SkillCache = {
                        id: skillId,
                        name: skillMd?.name || repoInfo.name,
                        description: metadataDescription,
                        seo: metadataSeo,
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
                        agentAnalysis: agentAnalysis,
                        contentHash: currentContentHash,
                        repoEtag: currentRepoEtag,
                    };

                    skill.qualityScore = calculateQualityScore(skill);
                    skills.push(skill);
                    globalSkillsRef = skills; // Update reference

                    // NEW: Auto-save checkpoint
                    if (skills.length % 5 === 0) {
                        console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
                        await saveStateOnly(skills);
                    }
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

        // Optimization: If existing skill is fully optimized and NOT updated, use it directly
        // Note: we use item.updatedAt (from search result) to check for updates
        if (existingSkill && isSkillFullyOptimized(existingSkill) && !hasSkillUpdated(existingSkill, updatedAt)) {
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

    // P0 FIX: Pre-filter dedup by repo name — keep only highest-stars entry per name
    // This eliminates 90%+ of junk items BEFORE expensive fetch/translate
    const nameStarsMap = new Map<string, { idx: number; stars: number }>();
    for (let i = 0; i < skillsToProcess.length; i++) {
        const item = skillsToProcess[i];
        // Use repo name as rough skill name proxy (exact name requires parsing)
        const nameKey = item.repo.toLowerCase();
        const existing = nameStarsMap.get(nameKey);
        if (!existing || item.stars > existing.stars) {
            nameStarsMap.set(nameKey, { idx: i, stars: item.stars });
        }
    }
    const dedupedIndices = new Set(Array.from(nameStarsMap.values()).map(v => v.idx));
    const beforeDedup = skillsToProcess.length;
    const dedupedSkillsToProcess = skillsToProcess.filter((_: any, i: number) => dedupedIndices.has(i));
    if (beforeDedup !== dedupedSkillsToProcess.length) {
        console.log(`\n🧹 Pre-filter: ${beforeDedup} → ${dedupedSkillsToProcess.length} items (removed ${beforeDedup - dedupedSkillsToProcess.length} repo-name duplicates)`);
    }

    // Track processed skill names to avoid translating same-named skills from different repos
    const processedNames = new Set<string>();

    const limit = pLimit(8); // Concurrency 8
    await Promise.all(dedupedSkillsToProcess.map((item: any) => limit(async () => {
        if (isTimeUp()) return;
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

            // P0 FIX: Name-level dedup — if another repo already claimed this skill name, skip
            const skillNameKey = skillMd.name.toLowerCase();
            if (processedNames.has(skillNameKey)) {
                process.stdout.write('D'); // D = Duplicate name skipped
                return;
            }

            // Check if existing in cache
            const existing = existingMap.get(skillId);
            if (!force && existing && isSkillFullyOptimized(existing) && !hasSkillUpdated(existing, item.updatedAt)) {
                skills.push(existing);
                processedRepos.add(skillId);
                globalSkillsRef = skills; // Keep reference updated

                // NEW: Auto-save checkpoint for official skills
                if (skills.length % 10 === 0) {
                    console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                    await saveStateOnly(skills);
                }
                process.stdout.write('s');
                return;
            }

            processedRepos.add(skillId);

            // console.log(`   → ${skillId}`);
            process.stdout.write('.');

            const currentContentHash = computeHash(item.content || item.description || '');

            let itemContent = item.content || '';
            const parsedSkillMd = itemContent ? parseSkillMd(itemContent) : undefined;

            let existingHash = existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

            // Assume same definition hash if the preview is identical
            if (!existingHash && existing?.skillMd?.bodyPreview && parsedSkillMd?.bodyPreview) {
                if (existing.skillMd.bodyPreview === parsedSkillMd.bodyPreview) {
                    existingHash = currentContentHash; // Force match!
                }
            }

            let metadataDescription = existing?.description || '';
            let metadataSeo = existing?.seo;
            let agentAnalysis = existing?.agentAnalysis;

            if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
                process.stdout.write('H'); // Hash Match Skip
                metadataDescription = existing.description;
                metadataSeo = existing.seo;
                agentAnalysis = existing.agentAnalysis;
            } else {
                const metadata = await processMetadata(skillId, item.description || '', {
                    name: skillMd.name,
                    topics: item.topics || [],
                    bodyPreview: skillMd.bodyPreview
                });
                metadataDescription = metadata.description;
                metadataSeo = metadata.seo;

                const rawAgentAnalysis = await aiService.generateAgentAnalysis(skillMd.name, typeof metadataDescription === 'string' ? metadataDescription : metadataDescription.en, skillMd.bodyPreview || '');
                if (rawAgentAnalysis) {
                    agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                }
            }

            const skill: SkillCache = {
                id: skillId,
                name: skillMd.name,
                description: metadataDescription,
                seo: metadataSeo,
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
                agentAnalysis: agentAnalysis,
                contentHash: currentContentHash,
            };

            skill.qualityScore = calculateQualityScore(skill);

            // P0 FIX: Quality pre-filter — reject low-quality skills BEFORE saving
            if ((skill.qualityScore || 0) < 20) {
                process.stdout.write('Q'); // Q = Quality filter reject
                return;
            }

            processedNames.add(skillNameKey); // Claim this name after quality check passes
            skills.push(skill);

            // Auto-save every 10 newly processed skills
            if (skills.length % 10 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                await saveStateOnly(skills);
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
        if (isTimeUp()) return;
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

            const currentContentHash = computeHash(item.content || rawDesc || '');

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
                updatedAt: item.fetchedAt || item.updatedAt || new Date().toISOString(),
                topics: item.topics || [],
                category: 'community',
                skillMd: skillMd,
                lastSynced: new Date().toISOString(),
                contentHash: currentContentHash,
            };

            skill.category = determineCategory(skill);
            globalSkillsRef = skills; // Keep reference updated

            // Auto-save every 10 newly discovered skills
            if (skills.length % 10 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                await saveStateOnly(skills);
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
        // In DISCOVER mode, we keep existing skills but apply quality filter
        // to prevent low-quality skills from persisting indefinitely
        console.log(`\n⏭️  Preserving existing skills with quality check (Discover Mode)`);
        let preservedCount = 0;
        let droppedCount = 0;
        for (const [id, skill] of Array.from(existingMap.entries())) {
            if (!processedRepos.has(id)) {
                const isOfficial = OFFICIAL_REPOS.some(or => or.owner === skill.owner && or.repo === skill.repo) || skill.category === 'official';
                // Quality gate: drop truly broken entries in discover mode too
                if (!isOfficial && (skill.qualityScore || 0) < 15) {
                    droppedCount++;
                    continue;
                }
                skills.push(skill);
                preservedCount++;
            }
        }
        if (droppedCount > 0) {
            console.log(`   🗑️ Dropped ${droppedCount} low-quality cached skills (score < 15)`);
        }
        console.log(`   ✅ Preserved ${preservedCount} existing skills`);
    }

    if (mode === 'update') {
        // Use the robust pLimit from utils (handles errors correctly)
        const pLimit = (concurrency: number) => {
            const queue: (() => Promise<void>)[] = [];
            let activeCount = 0;

            const next = () => {
                activeCount--;
                if (queue.length > 0) {
                    queue.shift()!();
                }
            };

            const run = (fn: () => Promise<void>) => new Promise<void>((resolve, reject) => {
                const trigger = async () => {
                    activeCount++;
                    try {
                        await fn();
                        resolve();
                    } catch (e) {
                        reject(e);
                    } finally {
                        next();
                    }
                };

                if (activeCount < concurrency) {
                    trigger();
                } else {
                    queue.push(trigger);
                }
            });

            return run;
        };

        // 4 NVIDIA API keys × 1 concurrent request per key = 4 parallel slots (Ultra Safe)
        const CONCURRENCY = 4;
        const limit = pLimit(CONCURRENCY);

        console.log(`\n🚀 Processing ${tasks.length} skills with Concurrency=${CONCURRENCY} (4 NVIDIA keys × 1 each)...`);

        const promises = tasks.map((skill, index) => limit(async () => {
            if (isTimeUp()) {
                skills.push(skill); // CRITICAL: Preserve the un-updated skill so it isn't deleted from the cache
                return;
            }

            const currentDesc = typeof skill.description === 'string' ? skill.description : (skill.description.en || '');

            // 增量翻译: 翻译完整 + SEO 完整 + 无更新 → 跳过
            if (isSkillFullyOptimized(skill) && !hasSkillUpdated(skill)) {
                skills.push(skill);
                process.stdout.write('S'); // Skip (Optimized)
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

                // Generate Agent Analysis + translate (same NVIDIA key)
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

            }
        }));

        await Promise.all(promises);
    } // End of if (mode === 'update')

    console.log(`\n   → Processed ${tasks.length} existing skills (Optimized: ${processedCount})`);

    if (isTimeUp()) {
        console.log(`\n⏳ Time limit reached! Saving progress via merge to prevent wiping unprocessed skills...`);
        await saveStateOnly(skills);
    } else {
        await finalizeAndSave(skills);
    }
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

    // Dedup by ID — each skill page is unique. Only apply quality filters.
    const idMap = new Map<string, SkillCache>();

    for (const skill of skills) {
        const desc = getDescText(skill);
        // Explicitly check if it is an official repo
        const isOfficial = OFFICIAL_REPOS.some(or => or.owner === skill.owner && or.repo === skill.repo) || skill.category === 'official';

        // Rule 0: Quality Score gate — reject low-quality entries
        // Raised from 5 → 15 to prevent junk from leaking through
        if (!isOfficial && (skill.qualityScore || 0) < 15) {
            continue;
        }

        // Rule 1: Minimum Description Length (10 chars) — pages without content hurt SEO
        if (!isOfficial && desc.length < 10) {
            continue;
        }

        // Rule 2: Stars gate REMOVED — AI agent skills are often personal config repos

        // Dedup: if same ID appears twice, keep the latest
        idMap.set(skill.id, skill);
    }

    const cleanedSkills = Array.from(idMap.values()).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
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

    // ========== 清除本地 miniflare KV 缓存 ==========
    // 确保 dev server 使用最新的 skills-cache.json 而非过期的 miniflare KV 数据
    const miniflareKvDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', KV_NAMESPACE_ID);
    if (fs.existsSync(miniflareKvDir)) {
        try {
            fs.rmSync(miniflareKvDir, { recursive: true, force: true });
            console.log(`   🧹 Cleared local miniflare KV cache`);
        } catch (error) {
            console.warn(`   ⚠️ Failed to clear miniflare KV cache:`, error);
        }
    }

    // ========== 提示同步 KV ==========
    console.log(`\n📋 To deploy to Cloudflare KV, run: npm run sync:kv`);
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
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // IMPORTANT: 3-layer merge to guarantee zero data loss:
    //   Layer 1: globalExistingMap (snapshot of the FULL initial cache from startup)
    //   Layer 2: on-disk file (in case other processes updated it)
    //   Layer 3: current session skills (newest, highest priority)
    const allSkillsMap = new Map<string, SkillCache>();

    // 1. Start with the FULL initial cache snapshot (never lose startup-loaded data)
    globalExistingMap.forEach((s, id) => allSkillsMap.set(id, s));

    // 2. Merge from file on disk (in case other processes or manual edits happened)
    if (fs.existsSync(outputFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8')) as CacheData;
            if (data.skills) data.skills.forEach(s => allSkillsMap.set(s.id, s));
        } catch (e) { /* ignore */ }
    }

    // 3. Overwrite with current session skills (freshest data wins)
    skills.forEach(s => allSkillsMap.set(s.id, s));

    // allSkillsMap is already deduped by ID — no secondary dedup needed.
    // Each skill has a unique ID; name collisions across repos are intentional (different pages).
    const uniqueSkills = Array.from(allSkillsMap.values());

    const cacheData: CacheData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        totalCount: uniqueSkills.length,
        skills: uniqueSkills,
    };
    fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));
}

// Helper to check if a skill is fully optimized (SEO + Translations) to skip expensive AI calls
function isSkillFullyOptimized(skill: SkillCache): boolean {
    // 0. Check Prompt Version (v3 = Feb 2026 quality audit fixes)
    // If agentAnalysis is missing version or version < 3, it needs re-generation with improved prompts.
    if (!skill.agentAnalysis?.version || skill.agentAnalysis.version < 3) {
        return false;
    }

    // 1. Check for SEO fields: title, description, features (non-empty), keywords (non-empty)
    if (!skill.seo?.description?.en) {
        return false;
    }
    if (!skill.seo?.title?.en) {
        return false;
    }

    // Features and Keywords validation (AI sometimes omits 'en' if source is EN, check if at least one language got populated)
    const features = skill.seo?.features;
    if (!features || typeof features !== 'object' || !Object.values(features).some(arr => Array.isArray(arr) && arr.length > 0)) {
        return false;
    }

    const keywords = skill.seo?.keywords;
    if (!keywords || typeof keywords !== 'object' || !Object.values(keywords).some(arr => Array.isArray(arr) && arr.length > 0)) {
        return false;
    }

    // 2. Check for missing translations in description
    if (typeof skill.description !== 'object') {
        return false; // Must be localized
    }
    for (const loc of SUPPORTED_LOCALES) {
        if (!skill.description[loc]) {
            return false;
        }
    }

    // 3. Check Agent Analysis (Must exist and be localized)
    if (!skill.agentAnalysis) {
        return false;
    }
    if (typeof skill.agentAnalysis.suitability !== 'object') {
        return false;
    }
    for (const loc of SUPPORTED_LOCALES) {
        if (!(skill.agentAnalysis.suitability as Record<string, string>)[loc]) {
            return false;
        }
    }

    // 4. Check Agent Analysis useCases have translations (not empty arrays)
    if (typeof skill.agentAnalysis.useCases === 'object' && !Array.isArray(skill.agentAnalysis.useCases)) {
        for (const loc of SUPPORTED_LOCALES) {
            const arr = (skill.agentAnalysis.useCases as Record<string, string[]>)[loc];
            if (!arr || arr.length === 0) {
                return false;
            }
        }
    } else {
        return false;
    }

    return true;
}

// Global reference for SIGINT handler
let globalSkillsRef: SkillCache[] = [];
// Global reference for existingMap — ensures saveStateOnly never loses startup-loaded data
let globalExistingMap: Map<string, SkillCache> = new Map();

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

