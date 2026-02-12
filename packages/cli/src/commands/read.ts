/**
 * Read Command
 * 
 * Outputs skill content to stdout for AI agents to consume dynamically.
 * Compatible with OpenSkills format for cross-tool interoperability.
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import chalk from 'chalk';
import { findSkill, normalizeSkillNames, getSkillBaseDir } from '../utils/skills.js';

export const readCommand = new Command('read')
    .argument('<skill-names...>', 'Skill name(s) to read (comma-separated or space-separated)')
    .description('Read skill content to stdout (for AI agents)')
    .action((skillNamesArg: string[]) => {
        const skillNames = normalizeSkillNames(skillNamesArg);

        if (skillNames.length === 0) {
            console.error(chalk.red('Error: No skill names provided'));
            process.exit(1);
        }

        const resolved: Array<{ name: string; path: string; baseDir: string }> = [];
        const missing: string[] = [];

        // Resolve all skill paths
        for (const name of skillNames) {
            const skill = findSkill(name);
            if (!skill) {
                missing.push(name);
                continue;
            }
            resolved.push({
                name,
                path: skill.path,
                baseDir: getSkillBaseDir(skill.path),
            });
        }

        // Report missing skills
        if (missing.length > 0) {
            console.error(chalk.red(`Error: Skill(s) not found: ${missing.join(', ')}`));
            console.error('');
            console.error('Searched in skill directories for all supported IDEs.');
            console.error('');
            console.error('Install skills:');
            console.error(chalk.cyan('  killer install <skill-name>'));
            console.error(chalk.cyan('  killer install owner/repo'));
            process.exit(1);
        }

        // Output each skill in standard format
        for (const { name, path, baseDir } of resolved) {
            try {
                const content = readFileSync(path, 'utf-8');

                // Output in OpenSkills-compatible format
                console.log(`Reading: ${name}`);
                console.log(`Base directory: ${baseDir}`);
                console.log('');
                console.log(content);
                console.log('');
                console.log(`Skill read: ${name}`);

                // Add separator if multiple skills
                if (resolved.length > 1 && resolved.indexOf({ name, path, baseDir }) < resolved.length - 1) {
                    console.log('---');
                    console.log('');
                }
            } catch (error) {
                console.error(chalk.red(`Error reading skill ${name}: ${error}`));
                process.exit(1);
            }
        }
    });
