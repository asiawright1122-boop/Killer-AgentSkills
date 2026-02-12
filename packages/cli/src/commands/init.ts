/**
 * Init Command
 * 
 * Initialize skills configuration in a project.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { select, confirm } from '@inquirer/prompts';
import { IDE_CONFIG, SUPPORTED_IDES } from '../config/ides.js';

export const initCommand = new Command('init')
    .description('Initialize skills configuration in current project')
    .option('-i, --ide <ide>', 'Target IDE')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .action(async (options: { ide?: string; yes?: boolean }) => {
        const spinner = ora();
        const cwd = process.cwd();

        try {
            console.log(chalk.bold('\n🚀 Initialize Killer-Skills\n'));

            // Detect or select IDE
            let targetIDE = options.ide;

            if (!targetIDE && !options.yes) {
                // Detect existing IDE configurations
                const detected = detectExistingIDE(cwd);

                if (detected) {
                    const useDetected = await confirm({
                        message: `Detected ${IDE_CONFIG[detected].name}. Use this IDE?`,
                        default: true
                    });

                    if (useDetected) {
                        targetIDE = detected;
                    }
                }

                if (!targetIDE) {
                    const choices = SUPPORTED_IDES.slice(0, 10).map(ide => ({
                        name: `${IDE_CONFIG[ide].name}`,
                        value: ide
                    }));

                    targetIDE = await select({
                        message: 'Select your IDE:',
                        choices
                    });
                }
            }

            targetIDE = targetIDE || 'claude';
            const ideConfig = IDE_CONFIG[targetIDE];

            console.log(chalk.dim(`\nConfiguring for: ${ideConfig.name}`));

            // Create skills directory
            spinner.start('Creating skills directory...');
            const skillsDir = path.join(cwd, ideConfig.paths.project);
            await fs.ensureDir(skillsDir);
            spinner.succeed(`Created ${ideConfig.paths.project}`);

            // Create .gitkeep
            const gitkeepPath = path.join(skillsDir, '.gitkeep');
            if (!await fs.pathExists(gitkeepPath)) {
                await fs.writeFile(gitkeepPath, '');
            }

            // Create config file based on IDE
            const configCreated = await createIDEConfig(cwd, targetIDE, options.yes);

            // Summary
            console.log(chalk.green('\n✅ Initialization complete!\n'));
            console.log(chalk.dim('Created:'));
            console.log(chalk.dim(`  📁 ${ideConfig.paths.project}/`));
            if (configCreated) {
                console.log(chalk.dim(`  📄 ${configCreated}`));
            }

            console.log(chalk.dim('\nNext steps:'));
            console.log(chalk.cyan('  1. Install skills: killer install <skill-name>'));
            console.log(chalk.cyan('  2. Create custom: killer create my-skill'));
            console.log(chalk.cyan('  3. Sync for AI:   killer sync'));

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.yellow('\n\nCancelled by user'));
                process.exit(0);
            }
            spinner.fail(chalk.red('Initialization failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Detect existing IDE configuration in project
 */
function detectExistingIDE(projectPath: string): string | null {
    const detectionOrder = [
        { ide: 'cursor', files: ['.cursor', '.cursorrules'] },
        { ide: 'windsurf', files: ['.windsurf', '.windsurfrules'] },
        { ide: 'claude', files: ['.claude', 'CLAUDE.md'] },
        { ide: 'antigravity', files: ['.agent', '.gemini', 'AGENTS.md'] },
        { ide: 'vscode', files: ['.vscode'] },
    ];

    for (const { ide, files } of detectionOrder) {
        for (const file of files) {
            if (fs.existsSync(path.join(projectPath, file))) {
                return ide;
            }
        }
    }

    return null;
}

/**
 * Create IDE-specific configuration file
 */
async function createIDEConfig(projectPath: string, ide: string, skipPrompt?: boolean): Promise<string | null> {
    const configFiles: Record<string, { path: string; content: string }> = {
        cursor: {
            path: '.cursorrules',
            content: `# Cursor Rules

## Skills Integration

This project uses Killer-Skills for AI capabilities.

Run \`killer sync\` to update this file with available skills.

<!-- SKILLS_TABLE_START -->
<!-- Run 'killer sync' to populate -->
<!-- SKILLS_TABLE_END -->
`
        },
        windsurf: {
            path: '.windsurfrules',
            content: `# Windsurf Rules

## Skills Integration

This project uses Killer-Skills for AI capabilities.

Run \`killer sync\` to update this file with available skills.

<!-- SKILLS_TABLE_START -->
<!-- Run 'killer sync' to populate -->
<!-- SKILLS_TABLE_END -->
`
        },
        claude: {
            path: 'CLAUDE.md',
            content: `# Claude Configuration

## Skills Integration

This project uses Killer-Skills for AI capabilities.

Run \`killer sync\` to update this file with available skills.

<!-- SKILLS_TABLE_START -->
<!-- Run 'killer sync' to populate -->
<!-- SKILLS_TABLE_END -->
`
        },
        antigravity: {
            path: 'AGENTS.md',
            content: `# Agents Configuration

## Skills Integration

This project uses Killer-Skills for AI capabilities.

Run \`killer sync\` to update this file with available skills.

<!-- SKILLS_TABLE_START -->
<!-- Run 'killer sync' to populate -->
<!-- SKILLS_TABLE_END -->
`
        }
    };

    const config = configFiles[ide];
    if (!config) return null;

    const configPath = path.join(projectPath, config.path);

    // Check if already exists
    if (await fs.pathExists(configPath)) {
        if (!skipPrompt) {
            const overwrite = await confirm({
                message: `${config.path} already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) return null;
        } else {
            return null; // Don't overwrite in yes mode
        }
    }

    await fs.writeFile(configPath, config.content);
    return config.path;
}
