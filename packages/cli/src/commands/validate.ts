/**
 * Validate Command
 * 
 * Validates a skill structure and metadata against quality standards.
 * Helps users ensure their skills are ready for publishing.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

export const validateCommand = new Command('validate')
    .argument('[path]', 'Path to the skill directory', '.')
    .description('Validate skill structure and metadata quality')
    .action(async (targetPath: string) => {
        const spinner = ora('Validating skill...').start();
        const absolutePath = path.resolve(targetPath);

        try {
            // 1. Check directory existence
            if (!await fs.pathExists(absolutePath)) {
                spinner.fail(chalk.red(`Directory not found: ${absolutePath}`));
                process.exit(1);
            }

            // 2. Check SKILL.md
            const skillMdPath = path.join(absolutePath, 'SKILL.md');
            if (!await fs.pathExists(skillMdPath)) {
                spinner.fail(chalk.red('Missing SKILL.md file'));
                console.log(chalk.dim(`Expected at: ${skillMdPath}`));
                process.exit(1);
            }

            // 3. Parse content
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const validation = validateSkillMd(content);

            // 4. Report results
            if (validation.errors.length > 0) {
                spinner.fail(chalk.red('Validation failed'));
                console.log('');
                console.log(chalk.bold.red('Errors:'));
                validation.errors.forEach(err => console.log(chalk.red(`  • ${err}`)));
            } else if (validation.warnings.length > 0) {
                spinner.warn(chalk.yellow('Validation passed with warnings'));
                console.log('');
                console.log(chalk.bold.yellow('Warnings:'));
                validation.warnings.forEach(warn => console.log(chalk.yellow(`  • ${warn}`)));
            } else {
                spinner.succeed(chalk.green('Validation passed! All checks OK.'));
            }

            // Quality Score Preview
            console.log('');
            const scoreColor = validation.score >= 80 ? chalk.green : (validation.score >= 60 ? chalk.yellow : chalk.red);
            console.log(`Quality Score: ${scoreColor(validation.score + '/100')}`);

            if (validation.errors.length > 0) {
                process.exit(1);
            }

        } catch (error) {
            spinner.fail(chalk.red('Validation error'));
            console.error((error as Error).message);
            process.exit(1);
        }
    });

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
}

function validateSkillMd(content: string): ValidationResult {
    const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        score: 100
    };

    // Check Frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        result.errors.push('Invalid or missing YAML frontmatter (must start/end with ---)');
        result.score = 0;
        return result;
    }

    const [, frontmatter, body] = match;
    const meta: Record<string, any> = {};

    frontmatter.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim().replace(/['"]/g, '');
            meta[key] = value;
        }
    });

    // Validations
    if (!meta.name) {
        result.errors.push('Missing "name" field in frontmatter');
        result.score -= 20;
    } else if (!/^[a-z][a-z0-9-]*$/.test(meta.name)) {
        result.errors.push('Name must be lowercase kebab-case (e.g. my-skill)');
        result.score -= 10;
    }

    if (!meta.version) {
        result.errors.push('Missing "version" field (e.g. version: 1.0.0)');
        result.score -= 10;
    }

    if (!meta.author) {
        result.warnings.push('Missing "author" field');
        result.score -= 5;
    }

    if (!meta.description) {
        result.errors.push('Missing "description" field');
        result.score -= 20;
    } else if (meta.description.length < 20) {
        result.warnings.push(`Description is too short (${meta.description.length} chars). Aim for > 20 chars.`);
        result.score -= 15;
    }

    // Body check
    if (body.trim().length < 50) {
        result.warnings.push('Body content is very short. Add "Overview" and "Usage" sections.');
        result.score -= 20;
    }

    // Ensure score doesn't go below 0
    result.score = Math.max(0, result.score);

    return result;
}
