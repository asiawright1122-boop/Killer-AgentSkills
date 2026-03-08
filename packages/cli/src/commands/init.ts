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
import { generateWindsurfWorkflows, logWindsurfWorkflows } from '../utils/windsurf-workflows.js';

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
                    const choices = SUPPORTED_IDES.slice(0, 15).map(ide => ({
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

            // Generate Windsurf workflows if targeting Windsurf
            if (targetIDE === 'windsurf') {
                const wfCount = await generateWindsurfWorkflows(cwd);
                if (wfCount > 0) {
                    logWindsurfWorkflows();
                }
            }

            // Summary
            console.log(chalk.green('\n✅ Initialization complete!\n'));
            console.log(chalk.dim('Created:'));
            console.log(chalk.dim(`  📁 ${ideConfig.paths.project}/`));
            if (configCreated) {
                console.log(chalk.dim(`  📄 ${configCreated}`));
            }
            if (targetIDE === 'windsurf') {
                console.log(chalk.dim(`  📁 .windsurf/workflows/ (slash commands)`));
            }

            console.log(chalk.dim('\nNext steps:'));
            console.log(chalk.cyan('  1. Install skills: kiro install <skill-name>'));
            console.log(chalk.cyan('  2. Create custom: kiro create my-skill'));
            console.log(chalk.cyan('  3. Sync for AI:   kiro sync'));

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
    for (const ide of SUPPORTED_IDES) {
        const config = IDE_CONFIG[ide];

        // Skip if no detection files
        if (!config.detectFiles || config.detectFiles.length === 0) continue;

        for (const file of config.detectFiles) {
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
    const config = IDE_CONFIG[ide];
    if (!config) return null;

    // Determine config file path
    let configFileName = '';

    // Hardcoded logic for now to ensure compatibility
    // In future, we should add `configFileName` to `IDEConfig`
    if (ide === 'cursor') configFileName = '.cursorrules';
    else if (ide === 'windsurf') configFileName = '.windsurfrules';
    else if (ide === 'trae') configFileName = path.join('.trae', 'rules', 'project_rules.md');
    else if (ide === 'claude') configFileName = 'CLAUDE.md';
    else if (ide === 'goose') configFileName = '.goosehints';
    else if (ide === 'continue') configFileName = path.join('.continue', 'rules', 'skills.md');
    else if (ide === 'augment') configFileName = path.join('.augment', 'rules', 'skills.md');
    else if (ide === 'cody') configFileName = path.join('.github', 'instructions', 'cody.md');
    else if (ide === 'antigravity' || ide === 'opencode' || ide === 'aider' || ide === 'amazonq' || ide === 'codex' || ide === 'openclaw') configFileName = 'AGENTS.md';
    else if (ide === 'roo' || ide === 'cline') configFileName = '.clinerules';
    else if (config.format === 'rules.md') configFileName = `.${ide}rules`;
    else if (config.format === 'instructions.md') configFileName = `${ide}-instructions.md`;
    else return null;

    // Build content
    const content = `# ${config.name} Configuration

## Skills Integration

This project uses Killer-Skills for AI capabilities.

Run \`killer sync\` to update this file with available skills.

<!-- SKILLS_TABLE_START -->
<!-- Run 'killer sync' to populate -->
<!-- SKILLS_TABLE_END -->
`;

    const configPath = path.join(projectPath, configFileName);

    // Check if already exists
    if (await fs.pathExists(configPath)) {
        if (!skipPrompt) {
            const overwrite = await confirm({
                message: `${configFileName} already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) return null;
        } else {
            return null; // Don't overwrite in yes mode
        }
    }

    // Ensure directory exists if needed (e.g. .github/)
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, content);
    return configFileName;
}
