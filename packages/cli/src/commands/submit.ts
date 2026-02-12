/**
 * Submit Command
 * 
 * Submit a skill to the Killer-Skills registry for inclusion.
 * This prepares and validates the skill, then sends it to the registry API.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { confirm, input } from '@inquirer/prompts';

interface SkillSubmission {
    name: string;
    description: string;
    author: string;
    email?: string;
    repository?: string;
    tags: string[];
    version: string;
    content: string;
    structure: Record<string, boolean>;
}

export const submitCommand = new Command('submit')
    .argument('[path]', 'Path to skill directory', '.')
    .description('Submit a skill to the Killer-Skills registry')
    .option('--dry-run', 'Validate without submitting')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (skillPath: string, options: {
        dryRun?: boolean;
        yes?: boolean;
    }) => {
        const spinner = ora('Preparing skill for submission...').start();

        try {
            // Resolve skill path
            const resolvedPath = path.resolve(skillPath);
            const skillMdPath = path.join(resolvedPath, 'SKILL.md');

            // Check SKILL.md exists
            if (!await fs.pathExists(skillMdPath)) {
                spinner.fail(chalk.red('SKILL.md not found'));
                console.log(chalk.dim(`Looking in: ${resolvedPath}`));
                process.exit(1);
            }

            // Read and parse SKILL.md
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const metadata = parseSkillMetadata(content);

            spinner.succeed('Skill loaded');

            // Validate metadata
            console.log(chalk.bold('\n📦 Skill Information\n'));
            console.log(chalk.dim('─'.repeat(50)));
            console.log(`  ${chalk.cyan('Name:')}        ${metadata.name}`);
            console.log(`  ${chalk.cyan('Description:')} ${metadata.description || chalk.yellow('(missing)')}`);
            console.log(`  ${chalk.cyan('Author:')}      ${metadata.author || chalk.yellow('(missing)')}`);
            console.log(`  ${chalk.cyan('Version:')}     ${metadata.version || '1.0.0'}`);
            console.log(`  ${chalk.cyan('Tags:')}        ${metadata.tags?.join(', ') || chalk.dim('none')}`);
            console.log(chalk.dim('─'.repeat(50)));

            // Check structure
            const structure = {
                'SKILL.md': true,
                'scripts/': await fs.pathExists(path.join(resolvedPath, 'scripts')),
                'references/': await fs.pathExists(path.join(resolvedPath, 'references')),
                'examples/': await fs.pathExists(path.join(resolvedPath, 'examples')),
                'assets/': await fs.pathExists(path.join(resolvedPath, 'assets'))
            };

            console.log(chalk.bold('\n📁 Structure\n'));
            for (const [item, exists] of Object.entries(structure)) {
                const icon = exists ? chalk.green('✓') : chalk.dim('○');
                console.log(`  ${icon} ${item}`);
            }

            // Validate required fields
            const errors: string[] = [];
            if (!metadata.name) errors.push('Missing skill name in frontmatter');
            if (!metadata.description) errors.push('Missing description in frontmatter');

            if (errors.length > 0) {
                console.log(chalk.red('\n⚠️  Validation Errors:\n'));
                errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
                console.log(chalk.dim('\nFix these issues before submitting.'));
                process.exit(1);
            }

            // Collect additional info if needed
            let author = metadata.author;
            let email = metadata.email;
            let repository = metadata.repository;

            if (!options.yes) {
                if (!author) {
                    author = await input({
                        message: 'Author name:',
                        required: true
                    });
                }

                if (!email) {
                    email = await input({
                        message: 'Contact email (optional):',
                        required: false
                    });
                }

                if (!repository) {
                    repository = await input({
                        message: 'GitHub repository URL (optional):',
                        required: false
                    });
                }
            }

            // Dry run - stop here
            if (options.dryRun) {
                console.log(chalk.green('\n✅ Dry run complete. Skill is ready for submission.'));
                console.log(chalk.dim('\nRemove --dry-run to submit.'));
                return;
            }

            // Confirm submission
            if (!options.yes) {
                const proceed = await confirm({
                    message: 'Submit this skill to the registry?',
                    default: true
                });

                if (!proceed) {
                    console.log(chalk.yellow('\nSubmission cancelled.'));
                    return;
                }
            }

            // Prepare submission
            const submission: SkillSubmission = {
                name: metadata.name,
                description: metadata.description,
                author: author || 'Anonymous',
                email,
                repository,
                tags: metadata.tags || [],
                version: metadata.version || '1.0.0',
                content,
                structure
            };

            // Submit to registry
            spinner.start('Submitting to registry...');

            const result = await submitToRegistry(submission);

            if (result.success) {
                spinner.succeed(chalk.green('Skill submitted successfully!'));
                console.log(chalk.dim('\nYour skill will be reviewed and added to the registry.'));
                if (result.trackingId) {
                    console.log(chalk.dim(`Tracking ID: ${result.trackingId}`));
                }
            } else {
                spinner.fail(chalk.red('Submission failed'));
                console.log(chalk.red(`Error: ${result.error}`));
            }

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.yellow('\n\nCancelled'));
                process.exit(0);
            }
            spinner.fail(chalk.red('Submission failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Parse skill metadata from SKILL.md frontmatter
 */
function parseSkillMetadata(content: string): {
    name: string;
    description: string;
    author?: string;
    email?: string;
    repository?: string;
    version?: string;
    tags?: string[];
} {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

    const result: Record<string, string | string[]> = {};

    if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)?$/);
            if (match) {
                const [, key, value] = match;
                if (value) {
                    result[key] = value.trim();
                }
            }
        }

        // Parse tags if present
        const tagsMatch = frontmatterMatch[1].match(/tags:\s*\n((?:\s*-\s*.+\n?)*)/m);
        if (tagsMatch) {
            const tags = tagsMatch[1]
                .split('\n')
                .map(line => line.match(/^\s*-\s*(.+)$/)?.[1]?.trim())
                .filter(Boolean) as string[];
            result.tags = tags;
        }
    }

    // Try to extract name from first heading if not in frontmatter
    if (!result.name) {
        const headingMatch = content.match(/^#\s+(.+)/m);
        if (headingMatch) {
            result.name = headingMatch[1].trim();
        }
    }

    return result as {
        name: string;
        description: string;
        author?: string;
        email?: string;
        repository?: string;
        version?: string;
        tags?: string[];
    };
}

/**
 * Submit skill to registry API
 */
async function submitToRegistry(submission: SkillSubmission): Promise<{
    success: boolean;
    trackingId?: string;
    error?: string;
}> {
    return new Promise((resolve) => {
        // For now, simulate submission
        // In production, this would POST to the actual registry API

        const registryUrl = process.env.KILLER_SKILLS_REGISTRY_API ||
            'https://killer-skills.vercel.app/api/skills/submit';

        try {
            const url = new URL(registryUrl);
            const data = JSON.stringify(submission);

            const req = https.request({
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'User-Agent': 'killer-skills-cli/1.6.0'
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        resolve({
                            success: result.success || res.statusCode === 200 || res.statusCode === 201,
                            trackingId: result.trackingId || result.id,
                            error: result.error || result.message
                        });
                    } catch {
                        resolve({
                            success: res.statusCode === 200 || res.statusCode === 201,
                            error: body
                        });
                    }
                });
            });

            req.on('error', (e) => {
                // If API not available, provide instructions
                resolve({
                    success: false,
                    error: `Registry API not available. Submit via GitHub instead:\n` +
                        `  1. Create a PR to https://github.com/anthropics/killer-skills\n` +
                        `  2. Add your skill to the registry/skills.json file`
                });
            });

            req.write(data);
            req.end();
        } catch (e) {
            resolve({
                success: false,
                error: (e as Error).message
            });
        }
    });
}
