/**
 * List Command (Refactored)
 * 
 * Lists all installed skills across all supported IDEs.
 * Uses the unified skills discovery from utils/skills.ts.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { findAllSkills } from '../utils/skills.js';
import { IDE_CONFIG } from '../config/ides.js';
import { hasSkillMetadata, readSkillMetadata } from '../utils/skill-metadata.js';
import { dirname } from 'path';

export const listCommand = new Command('list')
    .description('List all installed skills')
    .option('-i, --ide <ide>', 'Filter by specific IDE')
    .option('--verbose', 'Show detailed information including paths')
    .action(async (options: { ide?: string; verbose?: boolean }) => {
        console.log(chalk.bold('\n📦 Installed Skills\n'));

        const skills = findAllSkills(options.ide);

        if (skills.length === 0) {
            console.log(chalk.yellow('No skills installed yet.'));
            console.log('');
            console.log('Install skills:');
            console.log(chalk.cyan('  killer install <skill-name>'));
            console.log(chalk.cyan('  killer install owner/repo'));
            console.log('');
            console.log('Or run:');
            console.log(chalk.cyan('  killer sync'));
            console.log(chalk.dim('  to make existing skills discoverable by AI'));
            return;
        }

        // Sort: project skills first, then global, alphabetically within each
        const sorted = skills.sort((a, b) => {
            if (a.location !== b.location) {
                return a.location === 'project' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        // Group by location
        const projectSkills = sorted.filter(s => s.location === 'project');
        const globalSkills = sorted.filter(s => s.location === 'global');

        // Display project skills
        if (projectSkills.length > 0) {
            console.log(chalk.blue.bold('Project Skills'));
            console.log(chalk.dim('─'.repeat(50)));
            for (const skill of projectSkills) {
                displaySkill(skill, options.verbose);
            }
            console.log('');
        }

        // Display global skills
        if (globalSkills.length > 0) {
            console.log(chalk.dim.bold('Global Skills'));
            console.log(chalk.dim('─'.repeat(50)));
            for (const skill of globalSkills) {
                displaySkill(skill, options.verbose);
            }
            console.log('');
        }

        // Summary
        console.log(chalk.dim('─'.repeat(50)));
        console.log(chalk.dim(
            `Summary: ${chalk.blue(`${projectSkills.length} project`)}, ` +
            `${chalk.white(`${globalSkills.length} global`)} ` +
            `(${skills.length} total)`
        ));

        // Tips
        console.log('');
        console.log(chalk.dim('💡 Commands:'));
        console.log(chalk.dim(`   killer sync     - Make skills discoverable by AI`));
        console.log(chalk.dim(`   killer read <s> - Read skill content`));
        console.log(chalk.dim(`   killer manage   - Interactively manage skills`));
    });

/**
 * Display a single skill entry
 */
function displaySkill(skill: { name: string; description: string; path: string; location: string }, verbose?: boolean): void {
    const locationBadge = skill.location === 'project'
        ? chalk.blue('●')
        : chalk.dim('○');

    console.log(`  ${locationBadge} ${chalk.bold(skill.name)}`);

    if (skill.description) {
        // Truncate long descriptions
        const desc = skill.description.length > 60
            ? skill.description.slice(0, 57) + '...'
            : skill.description;
        console.log(chalk.dim(`    ${desc}`));
    }

    if (verbose) {
        console.log(chalk.dim(`    Path: ${skill.path}`));

        // Check for metadata
        const skillDir = dirname(skill.path);
        if (hasSkillMetadata(skillDir)) {
            const metadata = readSkillMetadata(skillDir);
            if (metadata) {
                console.log(chalk.dim(`    Source: ${metadata.sourceType} (${metadata.source})`));
                console.log(chalk.dim(`    Installed: ${new Date(metadata.installedAt).toLocaleDateString()}`));
            }
        } else {
            console.log(chalk.yellow(`    ⚠ No metadata (re-install to enable updates)`));
        }
    }

    console.log('');
}
