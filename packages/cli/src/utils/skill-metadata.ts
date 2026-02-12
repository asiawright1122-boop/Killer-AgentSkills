/**
 * Skill Metadata Management
 * 
 * Tracks installation source for each skill, enabling:
 * - One-command updates via `killer update`
 * - Version tracking and change detection
 * - Source transparency for users
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const SKILL_METADATA_FILE = '.killer-meta.json';

export type SkillSourceType = 'git' | 'local' | 'registry';

export interface SkillSourceMetadata {
    /** Original source input (e.g., "anthropics/skills", "./my-skill") */
    source: string;
    /** Type of source */
    sourceType: SkillSourceType;
    /** Full repository URL for git sources */
    repoUrl?: string;
    /** Subpath within the repository */
    subpath?: string;
    /** Local filesystem path for local sources */
    localPath?: string;
    /** Registry skill name for registry sources */
    registryName?: string;
    /** ISO timestamp of installation */
    installedAt: string;
    /** Semantic version if available */
    version?: string;
    /** Git commit hash for precise tracking */
    commitHash?: string;
}

/**
 * Read skill metadata from a skill directory
 */
export function readSkillMetadata(skillDir: string): SkillSourceMetadata | null {
    const metadataPath = join(skillDir, SKILL_METADATA_FILE);

    if (!existsSync(metadataPath)) {
        return null;
    }

    try {
        const raw = readFileSync(metadataPath, 'utf-8');
        return JSON.parse(raw) as SkillSourceMetadata;
    } catch {
        return null;
    }
}

/**
 * Write skill metadata to a skill directory
 */
export function writeSkillMetadata(skillDir: string, metadata: SkillSourceMetadata): void {
    const metadataPath = join(skillDir, SKILL_METADATA_FILE);

    const payload: SkillSourceMetadata = {
        ...metadata,
        installedAt: metadata.installedAt || new Date().toISOString(),
    };

    writeFileSync(metadataPath, JSON.stringify(payload, null, 2));
}

/**
 * Check if a skill has metadata (indicating it was installed via killer-skills)
 */
export function hasSkillMetadata(skillDir: string): boolean {
    return existsSync(join(skillDir, SKILL_METADATA_FILE));
}

/**
 * Build metadata for a git source
 */
export function buildGitMetadata(
    source: string,
    repoUrl: string,
    subpath?: string,
    commitHash?: string
): SkillSourceMetadata {
    return {
        source,
        sourceType: 'git',
        repoUrl,
        subpath: subpath || '',
        installedAt: new Date().toISOString(),
        commitHash,
    };
}

/**
 * Build metadata for a local source
 */
export function buildLocalMetadata(source: string, localPath: string): SkillSourceMetadata {
    return {
        source,
        sourceType: 'local',
        localPath,
        installedAt: new Date().toISOString(),
    };
}

/**
 * Build metadata for a registry source
 */
export function buildRegistryMetadata(
    skillName: string,
    repoUrl: string,
    version?: string
): SkillSourceMetadata {
    return {
        source: skillName,
        sourceType: 'registry',
        registryName: skillName,
        repoUrl,
        version,
        installedAt: new Date().toISOString(),
    };
}
