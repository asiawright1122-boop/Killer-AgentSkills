/**
 * Manage Command
 * 
 * Interactively manage (remove) installed skills.
 * Inspired by OpenSkills' manage command.
 */

import { Command } from 'commander';
import { rmSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { checkbox, confirm } from '@inquirer/prompts';
import { findAllSkills, getSkillBaseDir } from '../utils/skills.js';

export const manageCommand = new Command('manage')
    .description('Interactively manage installed skills')
    .option('--remove-all', 'Remove all skills (use with caution)')
    .action(async (options: { removeAll?: boolean }) => {
        const skills = findAllSkills();

        if (skills.length === 0) {
            console.log(chalk.yellow('No skills installed.'));
            console.log('');
            console.log('Install skills:');
            console.log(chalk.cyan('  killer install <skill-name>'));
            return;
        }

        // Handle --remove-all flag
        if (options.removeAll) {
            const confirmed = await confirm({
                message: chalk.red(`Are you sure you want to remove ALL ${skills.length} skills?`),
                default: false,
            });

            if (confirmed) {
                const spinner = ora('Removing all skills...').start();
                let removed = 0;
                for (const skill of skills) {
                    try {
                        const skillDir = getSkillBaseDir(skill.path);
                        rmSync(skillDir, { recursive: true, force: true });
                        removed++;
                    } catch {
                        // Skip errors
                    }
                }
                spinner.succeed(chalk.green(`Removed ${removed} skill(s)`));
            } else {
                console.log(chalk.yellow('Cancelled.'));
            }
            return;
        }

        // Sort: project first, then global
        const sorted = skills.sort((a, b) => {
            if (a.location !== b.location) {
                return a.location === 'project' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        try {
            // Create choices for checkbox
            const choices = sorted.map(skill => ({
                name: formatSkillChoice(skill),
                value: skill,
                checked: false, // Nothing checked by default
            }));

            console.log('');
            console.log(chalk.dim('Use ↑/↓ to navigate, Space to select, Enter to confirm'));
            console.log('');

            const toRemove = await checkbox({
                message: 'Select skills to remove',
                choices,
                pageSize: 15,
            });

            if (toRemove.length === 0) {
                console.log(chalk.yellow('No skills selected for removal.'));
                return;
            }

            // Confirm removal
            const confirmed = await confirm({
                message: `Remove ${toRemove.length} skill(s)?`,
                default: true,
            });

            if (!confirmed) {
                console.log(chalk.yellow('Cancelled.'));
                return;
            }

            // Remove selected skills
            const spinner = ora('Removing skills...').start();
            let removed = 0;

            for (const skill of toRemove) {
                try {
                    const skillDir = getSkillBaseDir(skill.path);
                    rmSync(skillDir, { recursive: true, force: true });
                    removed++;
                } catch (error) {
                    console.log(chalk.red(`  Failed to remove ${skill.name}: ${error}`));
                }
            }

            spinner.succeed(chalk.green(`Removed ${removed} skill(s)`));

            // Show what was removed
            console.log('');
            console.log(chalk.dim('Removed:'));
            for (const skill of toRemove) {
                const locationLabel = skill.location === 'project'
                    ? chalk.blue('project')
                    : chalk.dim('global');
                console.log(`  ${chalk.red('✕')} ${skill.name} (${locationLabel})`);
            }

            // Reminder to sync
            console.log('');
            console.log(chalk.dim('💡 Run `killer sync` to update AGENTS.md'));

        } catch (error) {
            // Handle Ctrl+C gracefully
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.yellow('\n\nCancelled by user'));
                process.exit(0);
            }
            throw error;
        }
    });

/**
 * Format skill choice for display
 */
function formatSkillChoice(skill: { name: string; description: string; location: string }): string {
    const locationLabel = skill.location === 'project'
        ? chalk.blue('(project)')
        : chalk.dim('(global)');

    const name = chalk.bold(skill.name.padEnd(25));

    return `${name} ${locationLabel}`;
}
