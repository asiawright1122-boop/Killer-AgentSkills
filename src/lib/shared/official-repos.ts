/**
 * Single Source of Truth: Official Repository List
 *
 * This module defines the canonical list of official repositories.
 * It is designed to be dependency-free so it can run in:
 * - VPS Node.js scripts (build-skills-cache.ts)
 * - Cloudflare Workers (content-workflow.ts, via symlink)
 * - Astro frontend (skills-config.ts derives from this)
 *
 * When adding a new official repo, update THIS file.
 * All other files import from here.
 */

export interface OfficialRepo {
    owner: string;
    repo: string;
    /** Optional: path where skills are located in the repo */
    skillsPath?: string;
    /** Optional: display name override for repos without standard SKILL.md frontmatter */
    displayName?: string;
}

/**
 * Core official repository list.
 * These repos get special treatment in validation (bypass strict checks)
 * and scoring (bonus points).
 */
export const OFFICIAL_REPOS: OfficialRepo[] = [
    // === Verified Official Skills ===
    { owner: 'anthropics', repo: 'skills', skillsPath: 'skills' },
    { owner: 'vercel-labs', repo: 'skills', skillsPath: 'skills' },
    { owner: 'obra', repo: 'superpowers', skillsPath: 'skills' },
    { owner: 'affaan-m', repo: 'everything-claude-code', skillsPath: 'skills' },
    { owner: 'ComposioHQ', repo: 'awesome-claude-skills', skillsPath: '' },
    { owner: 'remotion-dev', repo: 'skills', skillsPath: 'skills' },
    { owner: 'callstackincubator', repo: 'agent-skills', skillsPath: 'skills' },
    { owner: 'getsentry', repo: 'skills', skillsPath: 'plugins/sentry-skills/skills' },
    { owner: 'expo', repo: 'skills', skillsPath: 'plugins/expo-app-design/skills' },
    { owner: 'stripe', repo: 'ai', skillsPath: 'skills' },
    { owner: 'huggingface', repo: 'skills', skillsPath: 'skills' },
    { owner: 'google-labs-code', repo: 'stitch-skills', skillsPath: 'skills' },
    { owner: 'supabase', repo: 'agent-skills', skillsPath: 'skills' },
    { owner: 'cloudflare', repo: 'skills', skillsPath: 'skills' },
    // === Official MCP Servers ===
    { owner: 'neondatabase', repo: 'mcp-server-neon', skillsPath: 'README.md', displayName: 'Neon (Postgres)' },
    { owner: 'tadata-org', repo: 'fastapi_mcp', skillsPath: 'README.md', displayName: 'FastAPI' },
    // === Featured repos with SKILL.md / agent skills ===
    { owner: 'langgenius', repo: 'dify', skillsPath: '.agents/skills' },
    { owner: 'vercel', repo: 'next.js', skillsPath: '.claude/skills' },
    { owner: 'facebook', repo: 'react', skillsPath: '.claude/skills' },
    { owner: 'n8n-io', repo: 'n8n', skillsPath: '.claude/skills' },
];

/**
 * Check if a repo is in the official list.
 * @param owner - GitHub username or org
 * @param repo - Optional repo name. If omitted, matches any repo from that owner.
 */
export function isOfficialRepo(owner: string, repo?: string): boolean {
    if (!repo) {
        return OFFICIAL_REPOS.some(r => r.owner === owner);
    }
    return OFFICIAL_REPOS.some(r => r.owner === owner && r.repo === repo);
}
