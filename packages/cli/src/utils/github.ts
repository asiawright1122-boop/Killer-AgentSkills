/**
 * GitHub API Utilities
 * 
 * Functions for fetching skills from GitHub repositories.
 * Converted from github.js to TypeScript.
 * 
 * Token resolution uses github-auth.ts with 3-layer fallback:
 * env → config → gh CLI
 */

import https from 'https';
import path from 'path'; // Added for smart resolution
import { resolveGitHubToken } from './github-auth.js';

const GITHUB_API_BASE = 'https://api.github.com';

// Cached token (resolved once per process)
let _cachedToken: string | null | undefined = undefined;

async function getToken(): Promise<string | null> {
    if (_cachedToken === undefined) {
        _cachedToken = await resolveGitHubToken();
    }
    return _cachedToken;
}

export interface RepoInfo {
    owner: string;
    repo: string;
    skillPath: string | null;
}

export interface SkillFile {
    path: string;
    content: string;
}

/**
 * Parse repo string (owner/repo) into components
 */
export function parseRepoString(repoString: string): RepoInfo {
    const parts = repoString.split('/');
    if (parts.length < 2) {
        throw new Error(`Invalid repo format: ${repoString}. Expected: owner/repo`);
    }

    return {
        owner: parts[0],
        repo: parts[1],
        skillPath: parts.length > 2 ? parts.slice(2).join('/') : null
    };
}

/**
 * Check if string looks like a GitHub repo reference
 */
export function isGitHubRepo(source: string): boolean {
    // Matches: owner/repo, owner/repo/path, github.com/owner/repo
    if (source.includes('github.com')) return true;
    if (source.startsWith('git@') || source.startsWith('https://')) return true;

    // Check for owner/repo pattern (must have exactly one slash at start)
    const parts = source.split('/');
    if (parts.length >= 2 && !source.startsWith('/') && !source.startsWith('.')) {
        // Check if first part looks like a username (not a path)
        return /^[a-zA-Z0-9_-]+$/.test(parts[0]) && /^[a-zA-Z0-9_.-]+$/.test(parts[1]);
    }

    return false;
}

/**
 * Normalize GitHub URL to owner/repo format
 */
export function normalizeGitHubUrl(source: string): string {
    // Handle github.com URLs
    const urlMatch = source.match(/github\.com[\/:]([^\/]+)\/([^\/\s]+)/);
    if (urlMatch) {
        return `${urlMatch[1]}/${urlMatch[2].replace('.git', '')}`;
    }
    return source;
}

/**
 * Fetch JSON from GitHub API
 * Uses auto-resolved token from github-auth (env → config → gh CLI)
 */
export async function fetchGitHubAPI<T>(endpoint: string, token?: string | null): Promise<T> {
    const resolvedToken = token !== undefined ? token : await getToken();

    return new Promise((resolve, reject) => {
        const url = `${GITHUB_API_BASE}${endpoint}`;
        const options: https.RequestOptions = {
            headers: {
                'User-Agent': 'killer-skills-cli',
                'Accept': 'application/vnd.github.v3+json',
                ...(resolvedToken && {
                    'Authorization': `token ${resolvedToken}`
                })
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data) as T);
                } catch (e) {
                    reject(new Error(`Failed to parse GitHub response: ${(e as Error).message}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Fetch raw file content from GitHub
 */
export async function fetchRawFile(owner: string, repo: string, filePath: string, branch = 'main'): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

        https.get(url, (res) => {
            // Handle redirect
            if (res.statusCode === 301 || res.statusCode === 302) {
                const location = res.headers.location;
                if (location) {
                    https.get(location, (redirectRes) => {
                        let data = '';
                        redirectRes.on('data', chunk => data += chunk);
                        redirectRes.on('end', () => resolve(data));
                    }).on('error', reject);
                }
                return;
            }

            if (res.statusCode !== 200) {
                // Try 'master' branch if 'main' fails
                if (branch === 'main') {
                    fetchRawFile(owner, repo, filePath, 'master')
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                reject(new Error(`Failed to fetch ${filePath}: ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

interface TreeItem {
    path: string;
    type: 'blob' | 'tree';
    sha: string;
}

interface TreeResponse {
    tree: TreeItem[];
}

/**
 * Get repository tree to find all files
 */
export async function getRepoTree(owner: string, repo: string, branch = 'main'): Promise<TreeItem[]> {
    try {
        const data = await fetchGitHubAPI<TreeResponse>(
            `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        );
        return data.tree || [];
    } catch (e) {
        // Try master branch
        if (branch === 'main') {
            return getRepoTree(owner, repo, 'master');
        }
        throw e;
    }
}

/**
 * Find SKILL.md file in repository
 */
/**
 * Find all matching SKILL.md files in repository
 */
export async function findAllSkillFiles(owner: string, repo: string, query?: string): Promise<TreeItem[]> {
    const tree = await getRepoTree(owner, repo);

    // Filter for all SKILL.md files
    const skillFiles = tree.filter(item =>
        item.type === 'blob' && item.path.endsWith('SKILL.md')
    );

    if (skillFiles.length === 0) {
        throw new Error(`No SKILL.md found in ${owner}/${repo}`);
    }

    // If query provided, filter and rank
    if (query) {
        const normalizedQuery = query.toLowerCase();

        // 1. Exact directory match (e.g. "pdf" -> "pdf/SKILL.md")
        const exactMatches = skillFiles.filter(f => {
            const dir = path.dirname(f.path).toLowerCase();
            return dir === normalizedQuery || dir.endsWith(`/${normalizedQuery}`);
        });

        if (exactMatches.length > 0) return exactMatches;

        // 2. Directory contains query
        const partialMatches = skillFiles.filter(f => {
            const dir = path.dirname(f.path).toLowerCase();
            return dir.includes(normalizedQuery);
        });

        if (partialMatches.length > 0) {
            // Return all partial matches so user can choose
            return partialMatches.sort((a, b) => a.path.length - b.path.length);
        }
    }

    // If no query or no matches found with query
    if (query) {
        // Query provided but nothing matched → this is a "not found"
        throw new Error(`No skill matching '${query}' found in ${owner}/${repo}`);
    }

    // No query → return ALL skills (monorepo browsing mode)
    return skillFiles;
}

/**
 * Find SKILL.md file in repository (Legacy: returns best single match)
 */
export async function findSkillFile(owner: string, repo: string, query?: string): Promise<TreeItem> {
    const files = await findAllSkillFiles(owner, repo, query);
    return files[0];
}

/**
 * Download all files for a skill
 */
export async function downloadSkillFiles(owner: string, repo: string, skillBasePath = ''): Promise<SkillFile[]> {
    const tree = await getRepoTree(owner, repo);

    // Find all files related to the skill
    const prefix = skillBasePath ? `${skillBasePath}/` : '';
    const skillFiles = tree.filter(item =>
        item.type === 'blob' &&
        (item.path.startsWith(prefix) || !skillBasePath)
    );

    const files: SkillFile[] = [];
    for (const file of skillFiles) {
        // Skip files that are definitely not part of a skill
        if (file.path.includes('node_modules/') ||
            file.path.includes('.git/') ||
            file.path.startsWith('.')) {
            continue;
        }

        try {
            const content = await fetchRawFile(owner, repo, file.path);
            const relativePath = skillBasePath
                ? file.path.replace(`${skillBasePath}/`, '')
                : file.path;

            files.push({
                path: relativePath,
                content
            });
        } catch {
            console.warn(`Warning: Could not download ${file.path}`);
        }
    }

    return files;
}

const TRUSTED_OWNERS = [
    'killer-skills',
    'anthropic', 'google', 'vercel', 'openai', 'microsoft',
    'aws', 'meta', 'facebook', 'github', 'cloudflare',
    'aliyun', 'tencent', 'baidu', 'bytedance'
];

/**
 * Search for skills on GitHub
 * 
 * Strategy:
 * 1. Try Code Search API (requires auth) — most precise
 * 2. Fallback to Repository Search API (no auth needed) — broader results
 * 
 * Ranking Logic (V3):
 * 1. Trusted Owners (Authority)
 * 2. Name Match (Relevance)
 * 3. Stars (Popularity)
 */
export async function searchSkillsOnGitHub(query: string, limit = 10): Promise<unknown[]> {
    interface SearchResponse {
        items?: any[];
    }

    const token = await getToken();

    // Strategy 1: Code Search (requires auth, but much more precise)
    if (token) {
        try {
            const searchQuery = encodeURIComponent(`${query} filename:SKILL.md`);
            const endpoint = `/search/code?q=${searchQuery}&per_page=${limit}`;
            const data = await fetchGitHubAPI<SearchResponse>(endpoint, token);
            if (data.items && data.items.length > 0) {
                return data.items;
            }
        } catch {
            // Code search failed, fall through to repo search
        }
    }

    // Strategy 2: Repository Search (no auth needed)
    // Search for repos that mention SKILL.md in their description, readme, or name
    try {
        // Query: check name, description, and readme
        const searchQuery = encodeURIComponent(`${query} SKILL.md in:name,description,readme`);
        // Note: We removed sort=stars to allow GitHub's relevance sorting, 
        // but we will re-sort client-side for better precision.
        const endpoint = `/search/repositories?q=${searchQuery}&per_page=${limit * 2}`; // Fetch more to re-rank
        const data = await fetchGitHubAPI<SearchResponse>(endpoint, token);

        if (data.items) {
            // Client-side Re-ranking (V3)
            const sortedItems = data.items.sort((a, b) => {
                const aOwner = (a.owner?.login || '').toLowerCase();
                const bOwner = (b.owner?.login || '').toLowerCase();

                // 1. Trusted Owner Priority
                const aTrusted = TRUSTED_OWNERS.includes(aOwner);
                const bTrusted = TRUSTED_OWNERS.includes(bOwner);
                if (aTrusted && !bTrusted) return -1;
                if (!bTrusted && aTrusted) return 1;

                // 2. Name Match Priority
                const q = query.toLowerCase();
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aDesc = (a.description || '').toLowerCase();
                const bDesc = (b.description || '').toLowerCase();

                // Exact match gets highest priority
                if (aName === q && bName !== q) return -1;
                if (bName === q && aName !== q) return 1;

                // Name contains
                const aNameHas = aName.includes(q);
                const bNameHas = bName.includes(q);
                if (aNameHas && !bNameHas) return -1;
                if (!bNameHas && aNameHas) return 1;

                // Description includes (lower priority than name)
                const aDescHas = aDesc.includes(q);
                const bDescHas = bDesc.includes(q);
                if (aDescHas && !bDescHas) return -1;
                if (!bDescHas && aDescHas) return 1;

                // 3. Star Count Priority (fallback)
                return (b.stargazers_count || 0) - (a.stargazers_count || 0);
            });

            // Take top N and transform
            return sortedItems.slice(0, limit).map((repo: any) => {
                return {
                    repository: {
                        full_name: repo.full_name,
                        html_url: repo.html_url,
                        description: repo.description,
                        stargazers_count: repo.stargazers_count
                    }
                };
            });
        }
    } catch (e) {
        console.error('Search failed:', (e as Error).message);
    }

    return [];
}
