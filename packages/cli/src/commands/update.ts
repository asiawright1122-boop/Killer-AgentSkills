/**
 * Update Command
 * 
 * Updates installed skills from their recorded source metadata.
 * Supports git repositories and local sources.
 */

import { Command } from 'commander';
import { existsSync, cpSync, rmSync, mkdirSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { findAllSkills, normalizeSkillNames, getSkillBaseDir } from '../utils/skills.js';
import { readSkillMetadata, writeSkillMetadata } from '../utils/skill-metadata.js';

export const updateCommand = new Command('update')
    .argument('[skill-names...]', 'Skill name(s) to update (default: all)')
    .description('Update installed skills from their source')
    .option('--force', 'Force update even if no changes detected')
    .action(async (skillNamesArg: string[], options: { force?: boolean }) => {
        const requested = normalizeSkillNames(skillNamesArg);
        const allSkills = findAllSkills();

        if (allSkills.length === 0) {
            console.log(chalk.yellow('No skills installed.'));
            console.log('');
            console.log('Install skills:');
            console.log(chalk.cyan('  killer install <skill-name>'));
            console.log(chalk.cyan('  killer install owner/repo'));
            return;
        }

        // Filter to requested skills, or all if none specified
        let targets = allSkills;
        if (requested.length > 0) {
            const requestedSet = new Set(requested);
            targets = allSkills.filter(skill => requestedSet.has(skill.name));

            const missing = requested.filter(name => !allSkills.some(s => s.name === name));
            if (missing.length > 0) {
                console.log(chalk.yellow(`Skipping unknown skills: ${missing.join(', ')}`));
            }
        }

        if (targets.length === 0) {
            console.log(chalk.yellow('No matching skills to update.'));
            return;
        }

        console.log(chalk.dim(`Updating ${targets.length} skill(s)...`));
        console.log('');

        let updated = 0;
        let skipped = 0;
        const issues: Array<{ name: string; reason: string }> = [];

        for (const skill of targets) {
            const skillDir = getSkillBaseDir(skill.path);
            const metadata = readSkillMetadata(skillDir);

            if (!metadata) {
                console.log(chalk.yellow(`⏭  ${skill.name} - no metadata (re-install to enable updates)`));
                issues.push({ name: skill.name, reason: 'no metadata' });
                skipped++;
                continue;
            }

            const spinner = ora(`Updating ${skill.name}...`).start();

            try {
                if (metadata.sourceType === 'local') {
                    // Update from local source
                    const localPath = metadata.localPath;
                    if (!localPath || !existsSync(localPath)) {
                        spinner.fail(`${skill.name} - local source missing`);
                        issues.push({ name: skill.name, reason: 'local source missing' });
                        skipped++;
                        continue;
                    }

                    if (!existsSync(join(localPath, 'SKILL.md'))) {
                        spinner.fail(`${skill.name} - SKILL.md missing at local source`);
                        issues.push({ name: skill.name, reason: 'SKILL.md missing' });
                        skipped++;
                        continue;
                    }

                    updateSkillFromDir(skillDir, localPath);
                    writeSkillMetadata(skillDir, {
                        ...metadata,
                        installedAt: new Date().toISOString()
                    });

                    spinner.succeed(chalk.green(`${skill.name} - updated from local`));
                    updated++;
                    continue;
                }

                if (metadata.sourceType === 'git' || metadata.sourceType === 'registry') {
                    const repoUrl = metadata.repoUrl;
                    if (!repoUrl) {
                        spinner.fail(`${skill.name} - missing repo URL`);
                        issues.push({ name: skill.name, reason: 'missing repo URL' });
                        skipped++;
                        continue;
                    }

                    // Clone to temp directory
                    const tempDir = join(homedir(), `.killer-temp-${Date.now()}`);
                    mkdirSync(tempDir, { recursive: true });

                    try {
                        execSync(`git clone --depth 1 --quiet "${repoUrl}" "${tempDir}/repo"`, {
                            stdio: 'pipe',
                        });

                        const repoDir = join(tempDir, 'repo');
                        const subpath = metadata.subpath && metadata.subpath !== '.'
                            ? metadata.subpath
                            : '';
                        const sourceDir = subpath ? join(repoDir, subpath) : repoDir;

                        if (!existsSync(join(sourceDir, 'SKILL.md'))) {
                            spinner.fail(`${skill.name} - SKILL.md not found in repo`);
                            issues.push({ name: skill.name, reason: 'SKILL.md not in repo' });
                            skipped++;
                            continue;
                        }

                        updateSkillFromDir(skillDir, sourceDir);
                        writeSkillMetadata(skillDir, {
                            ...metadata,
                            installedAt: new Date().toISOString(),
                        });

                        spinner.succeed(chalk.green(`${skill.name} - updated from git`));
                        updated++;
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                    continue;
                }

                spinner.warn(`${skill.name} - unknown source type`);
                issues.push({ name: skill.name, reason: 'unknown source type' });
                skipped++;

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                spinner.fail(`${skill.name} - ${errorMsg}`);
                issues.push({ name: skill.name, reason: errorMsg });
                skipped++;
            }
        }

        // Summary
        console.log('');
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`${chalk.green('✅ Updated:')} ${updated}`);
        console.log(`${chalk.yellow('⏭  Skipped:')} ${skipped}`);

        if (issues.length > 0 && issues.length <= 5) {
            console.log('');
            console.log(chalk.dim('Issues:'));
            for (const { name, reason } of issues) {
                console.log(chalk.dim(`  • ${name}: ${reason}`));
            }
        }

        if (updated > 0) {
            console.log('');
            console.log(chalk.dim('💡 Run `killer sync` to update AGENTS.md'));
        }
    });

/**
 * Update skill directory from source directory
 */
function updateSkillFromDir(targetPath: string, sourceDir: string): void {
    const targetDir = dirname(targetPath);
    mkdirSync(targetDir, { recursive: true });

    // Security check
    if (!isPathInside(targetPath, targetDir)) {
        throw new Error('Security error: path outside target directory');
    }

    // Remove old and copy new
    rmSync(targetPath, { recursive: true, force: true });
    cpSync(sourceDir, targetPath, { recursive: true, dereference: true });
}

/**
 * Check if path is inside directory
 */
function isPathInside(targetPath: string, targetDir: string): boolean {
    const resolvedPath = resolve(targetPath);
    const resolvedDir = resolve(targetDir);
    const dirWithSep = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep;
    return resolvedPath.startsWith(dirWithSep);
}
