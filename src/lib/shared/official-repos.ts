/**
 * Single Source of Truth: Official Repository List
 *
 * This module defines the canonical list of official repositories.
 * It is designed to be dependency-free so it can run in:
 * - VPS Node.js scripts (build-skills-cache.ts)
 * - Cloudflare Workers (content-workflow.ts, via symlink)
 * - Astro frontend (skills-config.ts derives from this)
 *
 * The data is now stored in `data/official-repos.json` for easier updates.
 */

import officialReposData from '../../../data/official-repos.json';

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
export const OFFICIAL_REPOS: OfficialRepo[] = officialReposData as OfficialRepo[];

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
