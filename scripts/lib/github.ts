import * as fs from 'fs';
import * as path from 'path';
import { GITHUB_API } from './constants';
import { fetchWithTimeout } from './utils';
import type { SkillCache } from './types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
    const headers = getHeaders();
    if (options.headers) {
        Object.assign(headers, options.headers);
    }
    const finalOptions = { ...options, headers };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetchWithTimeout(url, finalOptions);
            if (response.status === 403) {
                console.warn('⚠️ GitHub API rate limit reached (403). Failing fast without retries.');
                return response;
            }
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
}

export async function fetchRepoInfo(owner: string, repo: string, etag?: string): Promise<{ data: any, etag?: string, notModified?: boolean } | null> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    const headers: Record<string, string> = {};
    if (etag) {
        headers['If-None-Match'] = etag;
    }
    const response = await fetchWithRetry(url, { headers });

    if (response.status === 304) {
        return { data: null, notModified: true, etag };
    }
    if (!response.ok) return null;

    return {
        data: await response.json(),
        etag: response.headers.get('etag') || undefined
    };
}

export async function fetchSkillMd(owner: string, repo: string, skillsPath: string): Promise<string | null> {
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

export function parseSkillMd(content: string): SkillCache['skillMd'] & { body?: string } | undefined {
    // Robust Regex: Handle \r\n, loose whitespace
    content = content.trimStart();
    const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        // Fallback: Treat entire file as body for non-frontmatter markdown
        return {
            name: '',
            description: content.slice(0, 500).replace(/[\r\n]+/g, ' ').trim(),
            version: undefined,
            tags: undefined,
            bodyPreview: content.slice(0, 3000).trim(),
            body: content
        };
    }

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
        bodyPreview: body.slice(0, 3000).trim(),
        body: body // Return full body for validation
    };
}

export async function searchGitHubSkills(): Promise<any[]> {
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
                const response = await fetchWithRetry(searchUrl);
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
export async function discoverNewSkillsFromGitHub(existingIds: Set<string>, lastCacheUpdate?: string, fullDiscovery: boolean = false): Promise<any[]> {
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
                const response = await fetchWithRetry(searchUrl);

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
                            stars: repoInfo.data?.stargazers_count || 0,
                            forks: repoInfo.data?.forks_count || 0,
                            topics: repoInfo.data?.topics || [],
                            description: repoInfo.data?.description || '',
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
