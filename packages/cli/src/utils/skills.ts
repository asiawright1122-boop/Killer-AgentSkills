/**
 * Skills Discovery and Management Utilities
 * 
 * Functions for finding, parsing, and managing installed skills across multiple IDEs.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import { IDE_CONFIG, SUPPORTED_IDES } from '../config/ides.js';
import type { SkillInfo } from './agents-md.js';

/**
 * YAML frontmatter extraction
 */
function extractYamlField(content: string, field: string): string {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return '';

    const frontmatter = frontmatterMatch[1];
    const fieldMatch = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return fieldMatch ? fieldMatch[1].trim().replace(/^["']|["']$/g, '') : '';
}

/**
 * Check if content has valid YAML frontmatter
 */
function hasValidFrontmatter(content: string): boolean {
    return /^---\s*\n[\s\S]*?\n---/.test(content);
}

/**
 * Find all installed skills across all search paths for a specific IDE
 */
export function findAllSkills(targetIDE?: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const seenNames = new Set<string>();

    const idesToSearch = targetIDE ? [targetIDE] : SUPPORTED_IDES;

    for (const ide of idesToSearch) {
        const config = IDE_CONFIG[ide];
        if (!config) continue;

        // Search project-level skills
        const projectPath = join(process.cwd(), config.paths.project);
        if (existsSync(projectPath)) {
            const projectSkills = findSkillsInDir(projectPath, 'project');
            for (const skill of projectSkills) {
                if (!seenNames.has(skill.name)) {
                    seenNames.add(skill.name);
                    skills.push(skill);
                }
            }
        }

        // Search global skills
        if (config.paths.global && existsSync(config.paths.global)) {
            const globalSkills = findSkillsInDir(config.paths.global, 'global');
            for (const skill of globalSkills) {
                if (!seenNames.has(skill.name)) {
                    seenNames.add(skill.name);
                    skills.push(skill);
                }
            }
        }
    }

    return skills;
}

/**
 * Find skills in a specific directory
 */
function findSkillsInDir(dir: string, location: 'project' | 'global'): SkillInfo[] {
    const skills: SkillInfo[] = [];

    if (!existsSync(dir)) return skills;

    try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            // Support both directories and symlinks to directories
            if (!isDirectoryOrSymlink(entry, dir)) continue;

            const skillDir = join(dir, entry.name);
            const skillMdPath = join(skillDir, 'SKILL.md');

            if (existsSync(skillMdPath)) {
                try {
                    const content = readFileSync(skillMdPath, 'utf-8');

                    if (hasValidFrontmatter(content)) {
                        const name = extractYamlField(content, 'name') || entry.name;
                        const description = extractYamlField(content, 'description') || '';

                        skills.push({
                            name,
                            description,
                            location,
                            path: skillMdPath,
                        });
                    }
                } catch {
                    // Skip invalid skill files
                }
            }
        }
    } catch {
        // Directory not accessible
    }

    return skills;
}

/**
 * Check if entry is a directory or a symlink pointing to a directory
 * This enables local development with symlinks:
 *   ln -s ~/dev/my-skill .claude/skills/my-skill
 */
function isDirectoryOrSymlink(entry: { isDirectory: () => boolean; isSymbolicLink: () => boolean; name: string }, parentDir: string): boolean {
    if (entry.isDirectory()) {
        return true;
    }
    if (entry.isSymbolicLink()) {
        try {
            // statSync follows symlinks, so it will tell us if target is a directory
            const stats = statSync(join(parentDir, entry.name));
            return stats.isDirectory();
        } catch {
            // Broken symlink or permission error
            return false;
        }
    }
    return false;
}

/**
 * Find a specific skill by name
 */
export function findSkill(skillName: string, targetIDE?: string): SkillInfo | null {
    const skills = findAllSkills(targetIDE);
    return skills.find(s => s.name === skillName) || null;
}

/**
 * Get the base directory for a skill (for resource resolution)
 */
export function getSkillBaseDir(skillPath: string): string {
    return dirname(skillPath);
}

/**
 * Normalize skill names input (handle comma-separated and array inputs)
 */
export function normalizeSkillNames(input: string[] | string | undefined): string[] {
    if (!input) return [];

    if (Array.isArray(input)) {
        return input.flatMap(name => name.split(',')).map(n => n.trim()).filter(Boolean);
    }

    return input.split(',').map(n => n.trim()).filter(Boolean);
}

/**
 * Get skill directories by IDE
 */
export function getSkillDirectories(ide: string, scope?: 'project' | 'global'): string[] {
    const config = IDE_CONFIG[ide];
    if (!config) return [];

    const dirs: string[] = [];

    if (!scope || scope === 'project') {
        dirs.push(join(process.cwd(), config.paths.project));
    }

    if ((!scope || scope === 'global') && config.paths.global) {
        dirs.push(config.paths.global);
    }

    return dirs;
}
