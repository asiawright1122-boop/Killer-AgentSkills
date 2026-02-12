/**
 * Unified Type Definitions
 * 
 * Centralized types for the Killer-Skills CLI.
 */

/**
 * Skill information as discovered in the filesystem
 */
export interface Skill {
    name: string;
    description: string;
    location: 'project' | 'global';
    path: string;
    ide?: string;
}

/**
 * Skill location details for reading
 */
export interface SkillLocation {
    path: string;
    baseDir: string;
    source: string;
}

/**
 * Options for install command
 */
export interface InstallOptions {
    ide?: string;
    scope?: 'project' | 'global';
    all?: boolean;
    yes?: boolean;
    path?: string;
}

/**
 * Options for sync command
 */
export interface SyncOptions {
    ide?: string;
    output?: string;
    yes?: boolean;
    remove?: boolean;
}

/**
 * SKILL.md frontmatter metadata
 */
export interface SkillMetadata {
    name: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
    repo?: string;
}

/**
 * Source metadata for update tracking
 */
export interface SkillSourceMetadata {
    source: string;
    sourceType: 'git' | 'local' | 'registry';
    repoUrl?: string;
    subpath?: string;
    localPath?: string;
    registryName?: string;
    installedAt: string;
    version?: string;
    commitHash?: string;
}

/**
 * Registry skill entry
 */
export interface RegistrySkill {
    name: string;
    repo: string;
    description: string;
    tags?: string[];
    version?: string;
}
