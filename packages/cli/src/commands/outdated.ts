/**
 * Outdated Command
 * 
 * Check for outdated skills that can be updated.
 * Compares installed skills against their source repositories.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { findAllSkills } from '../utils/skills.js';
import { readSkillMetadata, SkillSourceMetadata } from '../utils/skill-metadata.js';
import { fetchGitHubAPI } from '../utils/github.js';

interface OutdatedSkill {
    name: string;
    path: string;
    sourceType: string;
    installedAt: string;
    currentCommit?: string;
    latestCommit?: string;
    isOutdated: boolean;
    updateAvailable: boolean;
    error?: string;
}

export const outdatedCommand = new Command('outdated')
    .description('Check for outdated skills that can be updated')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options: { verbose?: boolean }) => {
        const spinner = ora('Checking for updates...').start();

        try {
            const skills = findAllSkills();
            const results: OutdatedSkill[] = [];

            spinner.text = `Checking ${skills.length} skill(s)...`;

            for (const skill of skills) {
                const skillDir = path.dirname(skill.path);
                const metadata = readSkillMetadata(skillDir);

                if (!metadata) {
                    results.push({
                        name: skill.name,
                        path: skillDir,
                        sourceType: 'unknown',
                        installedAt: 'unknown',
                        isOutdated: false,
                        updateAvailable: false,
                        error: 'No metadata (re-install to enable updates)'
                    });
                    continue;
                }

                const result: OutdatedSkill = {
                    name: skill.name,
                    path: skillDir,
                    sourceType: metadata.sourceType,
                    installedAt: metadata.installedAt,
                    currentCommit: metadata.commitHash,
                    isOutdated: false,
                    updateAvailable: false
                };

                // Check if update is available for git sources
                if (metadata.sourceType === 'git' && metadata.repoUrl) {
                    try {
                        const latestCommit = await getLatestCommit(metadata.repoUrl);
                        result.latestCommit = latestCommit;

                        if (metadata.commitHash && latestCommit) {
                            result.isOutdated = metadata.commitHash !== latestCommit;
                            result.updateAvailable = result.isOutdated;
                        } else {
                            // No commit hash stored, check by date
                            result.updateAvailable = true; // Assume updates might be available
                        }
                    } catch (e) {
                        result.error = (e as Error).message;
                    }
                } else if (metadata.sourceType === 'local') {
                    result.updateAvailable = true; // Local sources can always be refreshed
                }

                results.push(result);
            }

            spinner.stop();

            // Display results
            const outdated = results.filter(r => r.updateAvailable && !r.error);
            const unknown = results.filter(r => r.error);
            const upToDate = results.filter(r => !r.updateAvailable && !r.error);

            console.log(chalk.bold('\n📦 Skill Update Status\n'));
            console.log(chalk.dim('─'.repeat(60)));

            // Outdated skills
            if (outdated.length > 0) {
                console.log(chalk.yellow.bold(`\n⚠️  Updates Available (${outdated.length})\n`));
                for (const skill of outdated) {
                    console.log(`  ${chalk.yellow('↑')} ${chalk.bold(skill.name)}`);
                    if (options.verbose) {
                        console.log(chalk.dim(`    Source: ${skill.sourceType}`));
                        console.log(chalk.dim(`    Installed: ${formatDate(skill.installedAt)}`));
                        if (skill.currentCommit) {
                            console.log(chalk.dim(`    Current: ${skill.currentCommit.slice(0, 7)}`));
                        }
                        if (skill.latestCommit) {
                            console.log(chalk.dim(`    Latest:  ${skill.latestCommit.slice(0, 7)}`));
                        }
                    }
                }
            }

            // Up to date
            if (upToDate.length > 0) {
                console.log(chalk.green.bold(`\n✓ Up to Date (${upToDate.length})\n`));
                for (const skill of upToDate) {
                    console.log(`  ${chalk.green('✓')} ${skill.name}`);
                    if (options.verbose) {
                        console.log(chalk.dim(`    Installed: ${formatDate(skill.installedAt)}`));
                    }
                }
            }

            // Unknown / errors
            if (unknown.length > 0) {
                console.log(chalk.dim.bold(`\n? Cannot Check (${unknown.length})\n`));
                for (const skill of unknown) {
                    console.log(`  ${chalk.dim('?')} ${skill.name}`);
                    if (options.verbose && skill.error) {
                        console.log(chalk.dim(`    ${skill.error}`));
                    }
                }
            }

            console.log(chalk.dim('\n─'.repeat(60)));
            console.log(chalk.dim(`Total: ${results.length} skill(s)`));

            // Summary and next steps
            if (outdated.length > 0) {
                console.log(chalk.yellow(`\n💡 Run ${chalk.cyan('killer update')} to update all skills`));
                console.log(chalk.dim(`   Or: killer update ${outdated.map(s => s.name).join(' ')}`));
            } else if (unknown.length === results.length) {
                console.log(chalk.dim('\n💡 Re-install skills to enable update tracking:'));
                console.log(chalk.cyan('   killer install <skill-name>'));
            } else {
                console.log(chalk.green('\n✅ All skills are up to date!'));
            }

        } catch (error) {
            spinner.fail(chalk.red('Failed to check for updates'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Get latest commit hash from a GitHub repo
 */
async function getLatestCommit(repoUrl: string): Promise<string | undefined> {
    // Parse repo URL
    const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\s.]+)/);
    if (!match) return undefined;

    const [, owner, repo] = match;
    const cleanRepo = repo.replace('.git', '');

    try {
        interface CommitResponse {
            sha: string;
        }

        const data = await fetchGitHubAPI<CommitResponse[]>(
            `/repos/${owner}/${cleanRepo}/commits?per_page=1`
        );

        if (Array.isArray(data) && data.length > 0) {
            return data[0].sha;
        }
    } catch {
        // Ignore errors
    }

    return undefined;
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    } catch {
        return dateStr;
    }
}
