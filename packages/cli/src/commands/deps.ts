/**
 * Deps Command
 * 
 * Check and manage skill dependencies.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { findAllSkills, findSkill } from '../utils/skills.js';
import { checkDependencies, displayDependencyStatus, parseDependencies } from '../utils/dependencies.js';
import { readFileSync } from 'fs';

export const depsCommand = new Command('deps')
    .description('Check and manage skill dependencies')
    .argument('[skill-name]', 'Specific skill to check (or all if omitted)')
    .option('-t, --tree', 'Show dependency tree')
    .option('-i, --install', 'Install missing dependencies')
    .action(async (skillName: string | undefined, options: {
        tree?: boolean;
        install?: boolean;
    }) => {
        const spinner = ora('Checking dependencies...').start();

        try {
            const allSkills = findAllSkills();
            const installedNames = allSkills.map(s => s.name);

            if (skillName) {
                // Check specific skill
                const skill = findSkill(skillName);
                if (!skill) {
                    spinner.fail(chalk.red(`Skill not found: ${skillName}`));
                    console.log(chalk.dim('\nRun `killer list` to see installed skills'));
                    process.exit(1);
                }

                const skillDir = path.dirname(skill.path);
                spinner.stop();

                await checkAndDisplaySkill(skill.name, skillDir, installedNames, options.tree);

            } else {
                // Check all skills
                spinner.text = `Checking ${allSkills.length} skill(s)...`;

                const results: Array<{
                    name: string;
                    satisfied: boolean;
                    missingCount: number;
                    optionalCount: number;
                }> = [];

                for (const skill of allSkills) {
                    const skillDir = path.dirname(skill.path);
                    const result = await checkDependencies(skillDir, installedNames);
                    results.push({
                        name: skill.name,
                        satisfied: result.satisfied,
                        missingCount: result.missing.length,
                        optionalCount: result.optional.length
                    });
                }

                spinner.stop();

                // Display results
                console.log(chalk.bold('\n📦 Dependency Status\n'));
                console.log(chalk.dim('─'.repeat(60)));

                const withDeps = results.filter(r => r.missingCount > 0 || r.optionalCount > 0);
                const noDeps = results.filter(r => r.missingCount === 0 && r.optionalCount === 0);

                // Skills with dependencies
                if (withDeps.length > 0) {
                    console.log(chalk.bold('\nSkills with dependencies:\n'));
                    for (const r of withDeps) {
                        const status = r.satisfied ? chalk.green('✓') : chalk.red('✗');
                        const missing = r.missingCount > 0
                            ? chalk.red(` (${r.missingCount} missing)`)
                            : '';
                        const optional = r.optionalCount > 0
                            ? chalk.yellow(` (${r.optionalCount} optional)`)
                            : '';
                        console.log(`  ${status} ${r.name}${missing}${optional}`);
                    }
                }

                // Skills without dependencies
                if (noDeps.length > 0) {
                    console.log(chalk.dim(`\nSkills without dependencies: ${noDeps.length}`));
                    if (options.tree) {
                        for (const r of noDeps) {
                            console.log(chalk.dim(`  • ${r.name}`));
                        }
                    }
                }

                // Summary
                const unsatisfied = results.filter(r => !r.satisfied);
                console.log(chalk.dim('\n─'.repeat(60)));

                if (unsatisfied.length > 0) {
                    console.log(chalk.yellow(`\n⚠️  ${unsatisfied.length} skill(s) have missing dependencies`));
                    console.log(chalk.dim('\nCheck specific skill: killer deps <skill-name>'));
                } else {
                    console.log(chalk.green('\n✅ All skill dependencies satisfied!'));
                }
            }

            // Install missing deps option
            if (options.install) {
                console.log(chalk.dim('\n💡 Install missing dependencies: killer install <skill-name>'));
            }

        } catch (error) {
            spinner.fail(chalk.red('Failed to check dependencies'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Check and display a single skill's dependencies
 */
async function checkAndDisplaySkill(
    name: string,
    skillDir: string,
    installedSkills: string[],
    showTree?: boolean
): Promise<void> {
    const result = await checkDependencies(skillDir, installedSkills);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    console.log(chalk.bold(`\n📦 Dependencies for ${name}\n`));
    console.log(chalk.dim('─'.repeat(60)));

    // Read and parse dependencies
    try {
        const content = readFileSync(skillMdPath, 'utf-8');
        const deps = parseDependencies(content);

        if (deps.requires.length === 0 && deps.optional.length === 0) {
            console.log(chalk.dim('  No dependencies defined'));
            return;
        }

        // Required dependencies
        if (deps.requires.length > 0) {
            console.log(chalk.bold('\nRequired:'));
            for (const dep of deps.requires) {
                const installed = installedSkills.some(s =>
                    s.toLowerCase() === dep.name.toLowerCase()
                );
                const status = installed ? chalk.green('✓') : chalk.red('✗');
                const version = dep.version ? chalk.dim(`@${dep.version}`) : '';
                console.log(`  ${status} ${dep.name}${version}`);
            }
        }

        // Optional dependencies
        if (deps.optional.length > 0) {
            console.log(chalk.bold('\nOptional:'));
            for (const dep of deps.optional) {
                const installed = installedSkills.some(s =>
                    s.toLowerCase() === dep.name.toLowerCase()
                );
                const status = installed ? chalk.green('✓') : chalk.yellow('○');
                const version = dep.version ? chalk.dim(`@${dep.version}`) : '';
                console.log(`  ${status} ${dep.name}${version}`);
            }
        }

        // Summary
        console.log(chalk.dim('\n─'.repeat(60)));
        displayDependencyStatus(name, result);

    } catch {
        console.log(chalk.dim('  Could not read SKILL.md'));
    }
}
