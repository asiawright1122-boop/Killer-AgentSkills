/**
 * Skill Dependencies Utilities
 * 
 * Manage skill dependencies - skills that depend on other skills.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export interface SkillDependency {
    name: string;
    version?: string;
    optional?: boolean;
}

export interface SkillDependencies {
    requires: SkillDependency[];
    optional: SkillDependency[];
}

/**
 * Parse dependencies from SKILL.md frontmatter
 * 
 * Example SKILL.md:
 * ---
 * name: my-skill
 * requires:
 *   - pdf
 *   - docx
 * optional:
 *   - xlsx
 * ---
 */
export function parseDependencies(skillMdContent: string): SkillDependencies {
    const result: SkillDependencies = {
        requires: [],
        optional: []
    };

    const frontmatterMatch = skillMdContent.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return result;

    const frontmatter = frontmatterMatch[1];

    // Parse requires
    const requiresMatch = frontmatter.match(/^requires:\s*\n((?:\s*-\s*.+\n?)*)/m);
    if (requiresMatch) {
        const lines = requiresMatch[1].split('\n');
        for (const line of lines) {
            const match = line.match(/^\s*-\s*(.+)\s*$/);
            if (match) {
                const dep = parseDependencyString(match[1].trim());
                if (dep) result.requires.push(dep);
            }
        }
    }

    // Parse optional
    const optionalMatch = frontmatter.match(/^optional:\s*\n((?:\s*-\s*.+\n?)*)/m);
    if (optionalMatch) {
        const lines = optionalMatch[1].split('\n');
        for (const line of lines) {
            const match = line.match(/^\s*-\s*(.+)\s*$/);
            if (match) {
                const dep = parseDependencyString(match[1].trim());
                if (dep) {
                    dep.optional = true;
                    result.optional.push(dep);
                }
            }
        }
    }

    return result;
}

/**
 * Parse a dependency string like "pdf" or "pdf@1.0.0"
 */
function parseDependencyString(str: string): SkillDependency | null {
    if (!str) return null;

    const parts = str.split('@');
    return {
        name: parts[0].trim(),
        version: parts[1]?.trim()
    };
}

/**
 * Check if all required dependencies are installed
 */
export async function checkDependencies(
    skillPath: string,
    installedSkills: string[]
): Promise<{ satisfied: boolean; missing: SkillDependency[]; optional: SkillDependency[] }> {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!await fs.pathExists(skillMdPath)) {
        return { satisfied: true, missing: [], optional: [] };
    }

    const content = await fs.readFile(skillMdPath, 'utf-8');
    const deps = parseDependencies(content);

    const installedSet = new Set(installedSkills.map(s => s.toLowerCase()));

    const missing = deps.requires.filter(d => !installedSet.has(d.name.toLowerCase()));
    const optionalMissing = deps.optional.filter(d => !installedSet.has(d.name.toLowerCase()));

    return {
        satisfied: missing.length === 0,
        missing,
        optional: optionalMissing
    };
}

/**
 * Display dependency check results
 */
export function displayDependencyStatus(
    skillName: string,
    result: { satisfied: boolean; missing: SkillDependency[]; optional: SkillDependency[] }
): void {
    if (result.satisfied && result.optional.length === 0) {
        console.log(chalk.green(`  ✓ All dependencies satisfied for ${skillName}`));
        return;
    }

    if (!result.satisfied) {
        console.log(chalk.red(`\n⚠️  Missing dependencies for ${skillName}:`));
        for (const dep of result.missing) {
            console.log(chalk.red(`   • ${dep.name}${dep.version ? `@${dep.version}` : ''}`));
        }
        console.log(chalk.dim('\nInstall missing dependencies:'));
        console.log(chalk.cyan(`   killer install ${result.missing.map(d => d.name).join(' ')}`));
    }

    if (result.optional.length > 0) {
        console.log(chalk.yellow(`\n💡 Optional dependencies for ${skillName}:`));
        for (const dep of result.optional) {
            console.log(chalk.yellow(`   • ${dep.name}${dep.version ? `@${dep.version}` : ''} (optional)`));
        }
    }
}

/**
 * Get all dependencies for a skill recursively
 */
export async function getAllDependencies(
    skillPath: string,
    getSkillPath: (name: string) => string | null,
    visited = new Set<string>()
): Promise<SkillDependency[]> {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!await fs.pathExists(skillMdPath)) {
        return [];
    }

    const skillName = path.basename(skillPath);
    if (visited.has(skillName)) {
        return []; // Avoid circular dependencies
    }
    visited.add(skillName);

    const content = await fs.readFile(skillMdPath, 'utf-8');
    const deps = parseDependencies(content);

    const allDeps: SkillDependency[] = [...deps.requires, ...deps.optional];

    // Recursively get dependencies of dependencies
    for (const dep of deps.requires) {
        const depPath = getSkillPath(dep.name);
        if (depPath) {
            const subDeps = await getAllDependencies(depPath, getSkillPath, visited);
            allDeps.push(...subDeps);
        }
    }

    return allDeps;
}
