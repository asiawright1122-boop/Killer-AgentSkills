/**
 * Sync Command
 * 
 * Synchronizes installed skills to a markdown file (AGENTS.md, CLAUDE.md, etc.)
 * by generating standardized prompts that AI agents can understand.
 * 
 * Uses IDE-specific templates for optimal compatibility.
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { findAllSkills } from '../utils/skills.js';
import {
    replaceSkillsSection,
    removeSkillsSection,
    ensureMarkdownFile
} from '../utils/agents-md.js';
import { IDE_CONFIG } from '../config/ides.js';
import { generatePromptForIDE } from '../utils/prompt-templates.js';

interface SyncOptions {
    ide?: string;
    output?: string;
    yes?: boolean;
    remove?: boolean;
    all?: boolean;
}

// IDE-specific output file configurations (all 17 IDEs)
const IDE_OUTPUT_FILES: Record<string, string> = {
    // Editors
    cursor: '.cursorrules',
    windsurf: '.windsurfrules',
    vscode: '.github/copilot-instructions.md',
    trae: 'AGENTS.md',
    // CLI Agents
    claude: 'CLAUDE.md',
    antigravity: 'AGENTS.md',
    aider: 'AGENTS.md',
    codex: 'AGENTS.md',
    // Agents
    goose: 'AGENTS.md',
    cline: 'AGENTS.md',
    roo: 'AGENTS.md',
    kiro: '.kiro/agents/skills.md',
    augment: 'AGENTS.md',
    // VS Code Extensions
    continue: 'AGENTS.md',
    copilot: '.github/copilot-instructions.md',
    cody: 'AGENTS.md',
    amazonq: 'AGENTS.md',
    // Default
    default: 'AGENTS.md',
};

export const syncCommand = new Command('sync')
    .description('Sync installed skills to AGENTS.md (makes skills discoverable by AI)')
    .option('-i, --ide <ide>', 'Target IDE for sync')
    .option('-o, --output <path>', 'Output file path (default: auto-detect based on IDE)')
    .option('-y, --yes', 'Skip interactive prompts, sync all skills')
    .option('--remove', 'Remove skills section from output file')
    .option('-a, --all', 'Sync to ALL supported IDEs at once')
    .action(async (options: SyncOptions) => {
        const spinner = ora();

        try {
            // --all mode: sync to every IDE
            if (options.all) {
                const allIDEs = Object.keys(IDE_OUTPUT_FILES).filter(k => k !== 'default');
                spinner.start('Finding installed skills...');
                const skills = findAllSkills();
                spinner.succeed(`Found ${chalk.cyan(skills.length)} skill(s)`);

                if (skills.length === 0) {
                    console.log(chalk.yellow('\nNo skills installed.'));
                    return;
                }

                console.log(chalk.dim(`\nSyncing to ${allIDEs.length} IDEs...\n`));
                let synced = 0;
                for (const ide of allIDEs) {
                    const ideConfig = IDE_CONFIG[ide];
                    if (!ideConfig) continue;
                    const outputPath = IDE_OUTPUT_FILES[ide];
                    try {
                        ensureMarkdownFile(outputPath);
                        const prompt = generatePromptForIDE(ide, skills);
                        const content = readFileSync(outputPath, 'utf-8');
                        const updated = replaceSkillsSection(content, prompt);
                        writeFileSync(outputPath, updated);
                        console.log(`  ${chalk.green('✔')} ${ideConfig.name} → ${chalk.dim(outputPath)}`);
                        synced++;
                    } catch {
                        console.log(`  ${chalk.gray('○')} ${ideConfig.name} ${chalk.dim('(skipped)')}`);
                    }
                }
                console.log(chalk.green(`\n✅ Synced ${skills.length} skills to ${synced} IDEs`));
                return;
            }

            // Determine target IDE
            const targetIDE = options.ide || detectIDE();
            const ideConfig = IDE_CONFIG[targetIDE];

            if (!ideConfig) {
                console.error(chalk.red(`Unknown IDE: ${targetIDE}`));
                process.exit(1);
            }

            // Determine output file
            const outputPath = options.output || IDE_OUTPUT_FILES[targetIDE] || IDE_OUTPUT_FILES.default;

            console.log(chalk.dim(`Target IDE: ${ideConfig.name}`));
            console.log(chalk.dim(`Output file: ${outputPath}`));
            console.log('');

            // Handle remove option
            if (options.remove) {
                if (!existsSync(outputPath)) {
                    console.log(chalk.yellow(`File not found: ${outputPath}`));
                    return;
                }

                spinner.start('Removing skills section...');
                const content = readFileSync(outputPath, 'utf-8');
                const updated = removeSkillsSection(content);
                writeFileSync(outputPath, updated);
                spinner.succeed(chalk.green(`Removed skills section from ${outputPath}`));
                return;
            }

            // Find installed skills across ALL IDE paths (not just target IDE)
            // This ensures skills installed for one IDE (e.g. Antigravity) 
            // are also discoverable when syncing to another IDE (e.g. Cursor)
            spinner.start('Finding installed skills...');
            const skills = findAllSkills();
            spinner.succeed(`Found ${chalk.cyan(skills.length)} skill(s)`);

            if (skills.length === 0) {
                console.log(chalk.yellow('\nNo skills installed.'));
                console.log(chalk.dim('Install skills first:'));
                console.log(chalk.cyan('  killer install <skill-name>'));
                console.log(chalk.cyan('  killer install owner/repo'));
                return;
            }

            // Display skills to be synced
            console.log(chalk.dim('\nSkills to sync:'));
            skills.forEach(skill => {
                const locationBadge = skill.location === 'project'
                    ? chalk.blue('(project)')
                    : chalk.dim('(global)');
                console.log(`  ${chalk.cyan('•')} ${skill.name} ${locationBadge}`);
            });
            console.log('');

            // Ensure output file exists
            spinner.start(`Writing to ${outputPath}...`);
            ensureMarkdownFile(outputPath);

            // Generate IDE-specific prompt
            const prompt = generatePromptForIDE(targetIDE, skills);
            const content = readFileSync(outputPath, 'utf-8');
            const updated = replaceSkillsSection(content, prompt);

            writeFileSync(outputPath, updated);

            // Check if we updated existing or added new
            const hadMarkers = content.includes('<skills_system') ||
                content.includes('<!-- SKILLS_TABLE_START -->');

            if (hadMarkers) {
                spinner.succeed(chalk.green(`Synced ${skills.length} skill(s) to ${outputPath}`));
            } else {
                spinner.succeed(chalk.green(`Added skills section to ${outputPath} (${skills.length} skill(s))`));
            }

            // Print usage tips
            console.log(chalk.dim('\n💡 Tips:'));
            console.log(chalk.dim(`   • AI agents can now discover and use your skills`));
            console.log(chalk.dim(`   • Use 'killer read <skill>' to load skill content`));
            console.log(chalk.dim(`   • Run 'killer sync' again after installing new skills`));

        } catch (error) {
            spinner.fail(chalk.red('Sync failed'));
            console.error(error);
            process.exit(1);
        }
    });

/**
 * Detect the current IDE based on project files
 */
function detectIDE(): string {
    const cwd = process.cwd();

    // Check for IDE-specific files (ordered by priority matching ides.ts)
    const detectionOrder = [
        // Editors
        { ide: 'cursor', files: ['.cursor', '.cursorrules'] },
        { ide: 'windsurf', files: ['.windsurf', '.windsurfrules'] },
        { ide: 'trae', files: ['.trae'] },
        // CLI Agents
        { ide: 'claude', files: ['.claude', 'CLAUDE.md'] },
        { ide: 'antigravity', files: ['.agent', '.gemini'] },
        { ide: 'aider', files: ['.aider'] },
        { ide: 'codex', files: ['.codex'] },
        // Agents
        { ide: 'goose', files: ['.goose'] },
        { ide: 'cline', files: ['.cline'] },
        { ide: 'roo', files: ['.roo'] },
        { ide: 'kiro', files: ['.kiro'] },
        { ide: 'augment', files: ['.augment'] },
        // Extensions (lower priority)
        { ide: 'continue', files: ['.continue'] },
        { ide: 'cody', files: ['.cody'] },
        { ide: 'amazonq', files: ['.amazonq'] },
        // VS Code last (very common, less specific)
        { ide: 'vscode', files: ['.vscode'] },
    ];

    for (const { ide, files } of detectionOrder) {
        for (const file of files) {
            if (existsSync(`${cwd}/${file}`)) {
                return ide;
            }
        }
    }

    // Default to antigravity (AGENTS.md format)
    return 'antigravity';
}
