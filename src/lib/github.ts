/**
 * Shared GitHub API utilities.
 * Centralizes constants and helpers used across submit.ts, files.ts, etc.
 */

export const GITHUB_API_BASE = 'https://api.github.com';

export const COMMON_BRANCHES = ['main', 'master', 'canary', 'develop'];

/**
 * Common SKILL.md search paths for skill discovery.
 * @param repo - Repository name (used for repo-specific sub-skill paths)
 */
export function getSkillMdPaths(repo: string): string[] {
    return [
        'SKILL.md',
        '.codex/skills/SKILL.md',
        '.claude/skills/SKILL.md',
        '.agent/skills/SKILL.md',
        'skills/SKILL.md',
        `.agent/skills/${repo}/SKILL.md`,
        `skills/${repo}/SKILL.md`,
        `.codex/skills/${repo}/SKILL.md`,
        `.claude/skills/${repo}/SKILL.md`,
    ];
}

export function getGitHubHeaders(): Record<string, string> {
    return {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Killer-Skills-App',
    };
}
