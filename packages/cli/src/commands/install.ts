/**
 * Install Command (Unified)
 * 
 * Supports installation from:
 * - GitHub: owner/repo, github.com/owner/repo
 * - Local: ./path, ~/path, /absolute/path
 * - Registry: skill-name
 * 
 * Merged from install.ts and add.js for a unified experience.
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { IDE_CONFIG, SUPPORTED_IDES, getInstallPath } from '../config/ides.js';
import { fetchSkillMeta } from '../registry.js';
import { writeSkillMetadata, buildRegistryMetadata, buildGitMetadata, buildLocalMetadata } from '../utils/skill-metadata.js';
import { isGitHubRepo, parseRepoString, normalizeGitHubUrl, findSkillFile, downloadSkillFiles } from '../utils/github.js';
import { isLocalPath, expandTilde, ensureDir, getBestIDE, detectProjectIDEs, detectGlobalIDEs } from '../utils/platform.js';
import { injectSkill } from '../utils/adapters.js';

export const installCommand = new Command('install')
    .argument('<source>', 'Skill source: name, owner/repo, or local path')
    .description('Install a skill from registry, GitHub, or local path')
    .option('-i, --ide <ide>', `Target IDE (${SUPPORTED_IDES.join(', ')})`)
    .option('-s, --scope <scope>', 'Installation scope: project or global', 'global')
    .option('--all', 'Install to all supported IDEs')
    .option('-y, --yes', 'Skip prompts, accept defaults')
    .option('--no-sync', 'Skip auto-sync after installation')
    .option('--with-deps', 'Install with dependencies')
    .action(async (source: string, options: {
        ide?: string;
        scope?: string;
        all?: boolean;
        yes?: boolean;
        sync?: boolean;
        withDeps?: boolean;
    }) => {
        const spinner = ora(`Installing from ${source}...`).start();

        try {
            // Determine target IDEs
            let targetIDEs: string[] = [];
            if (options.all) {
                targetIDEs = SUPPORTED_IDES;
            } else if (options.ide) {
                if (!SUPPORTED_IDES.includes(options.ide)) {
                    spinner.fail(chalk.red(`Unknown IDE: ${options.ide}`));
                    console.log(chalk.yellow(`\nSupported IDEs: ${SUPPORTED_IDES.join(', ')}`));
                    process.exit(1);
                }
                targetIDEs = [options.ide];
            } else {
                // Auto-detect ALL IDEs
                let detected: { ide: string, name: string }[] = [];

                if (options.scope === 'project') {
                    detected = detectProjectIDEs();
                } else {
                    detected = detectGlobalIDEs();
                }

                if (detected.length === 0) {
                    // Fallback to default
                    targetIDEs = ['cursor']; // Defaulting to Cursor as it's most popular
                    spinner.text = `No IDE detected, defaulting to Cursor...`;
                } else {
                    targetIDEs = detected.map(d => d.ide);
                    spinner.text = `Detected IDEs: ${detected.map(d => d.name).join(', ')}`;
                }
            }

            const scope = (options.scope === 'project' ? 'project' : 'global') as 'project' | 'global';

            // Determine source type and install accordingly
            let result: InstallResult;

            if (isLocalPath(source)) {
                result = await installFromLocal(source, targetIDEs, scope, spinner);
            } else if (isGitHubRepo(source)) {
                result = await installFromGitHub(source, targetIDEs, scope, spinner);
            } else {
                result = await installFromRegistry(source, targetIDEs, scope, spinner);
            }

            if (result.installed.length === 0) {
                spinner.fail(chalk.red(`Failed to install ${source}`));
                process.exit(1);
            }

            spinner.succeed(chalk.green(`Installed ${result.skillName}`));

            // Show summary
            console.log(chalk.dim('\n📦 Installation Summary'));
            console.log(chalk.dim('─'.repeat(50)));
            console.log(`  ${chalk.bold('Skill:')}  ${result.skillName}`);
            console.log(`  ${chalk.bold('Source:')} ${result.sourceType}`);
            console.log(`  ${chalk.bold('IDEs:')}   ${result.installed.join(', ')}`);
            console.log(chalk.dim('─'.repeat(50)));

            // Auto-sync (enabled by default, disable with --no-sync)
            if (options.sync !== false) {
                console.log('');
                const syncSpinner = ora('Auto-syncing skills to AGENTS.md...').start();
                try {
                    const { execSync } = await import('child_process');
                    execSync('npx killer-skills sync', { stdio: 'pipe' });
                    syncSpinner.succeed(chalk.green('Skills synced — AI agents can now discover and auto-invoke your skills'));
                } catch {
                    syncSpinner.warn(chalk.yellow('Auto-sync failed. Run manually: killer sync'));
                }
            }

            // Tips
            console.log(chalk.dim('\n💡 Next steps:'));
            console.log(chalk.dim('   killer list   - View all installed skills'));
            console.log(chalk.dim('   killer read <skill> - Load skill content'));
            console.log(chalk.dim('   killer update - Update skills from source'));

        } catch (error) {
            spinner.fail(chalk.red(`Failed to install ${source}`));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));

            if ((error as Error).message.includes('404') || (error as Error).message.includes('Not Found')) {
                console.log(chalk.yellow('\n💡 Make sure the repository exists and contains a SKILL.md file.'));
            }

            process.exit(1);
        }
    });

interface InstallResult {
    skillName: string;
    sourceType: 'registry' | 'github' | 'local';
    installed: string[];
}

/**
 * Install from local path
 */
async function installFromLocal(
    source: string,
    targetIDEs: string[],
    scope: 'project' | 'global',
    spinner: ReturnType<typeof ora>
): Promise<InstallResult> {
    const localPath = path.resolve(expandTilde(source));

    if (!fs.existsSync(localPath)) {
        throw new Error(`Path not found: ${localPath}`);
    }

    const skillMdPath = fs.statSync(localPath).isDirectory()
        ? path.join(localPath, 'SKILL.md')
        : localPath;

    if (!fs.existsSync(skillMdPath)) {
        throw new Error(`No SKILL.md found at ${localPath}`);
    }

    const skillDir = path.dirname(skillMdPath);
    const skillName = path.basename(skillDir);

    spinner.text = `Installing ${skillName} from local path...`;

    const installed: string[] = [];

    for (const ide of targetIDEs) {
        const config = IDE_CONFIG[ide];
        try {
            const installPath = getInstallPath(ide, scope, skillName);

            // Copy entire skill directory
            await fs.ensureDir(installPath);
            await fs.copy(skillDir, installPath, { overwrite: true });

            // Write metadata
            const metadata = buildLocalMetadata(skillName, localPath);
            writeSkillMetadata(installPath, metadata);

            // Inject into IDE configuration
            await injectSkill(ide, skillName, installPath, installPath);

            installed.push(config.name);
        } catch {
            // Skip if path not available
        }
    }

    return { skillName, sourceType: 'local', installed };
}

/**
 * Install from GitHub
 */
async function installFromGitHub(
    source: string,
    targetIDEs: string[],
    scope: 'project' | 'global',
    spinner: ReturnType<typeof ora>
): Promise<InstallResult> {
    spinner.text = 'Parsing repository...';

    const normalizedSource = normalizeGitHubUrl(source);
    const { owner, repo } = parseRepoString(normalizedSource);

    spinner.text = `Finding skill in ${owner}/${repo}...`;
    const skillFile = await findSkillFile(owner, repo);
    const skillDir = path.dirname(skillFile.path);
    const skillName = skillDir === '.' ? repo : path.basename(skillDir);

    spinner.text = `Downloading ${skillName}...`;
    const basePath = skillDir === '.' ? '' : skillDir;
    const files = await downloadSkillFiles(owner, repo, basePath);

    spinner.text = `Installing ${skillName}...`;
    const installed: string[] = [];

    for (const ide of targetIDEs) {
        const config = IDE_CONFIG[ide];
        try {
            const installPath = getInstallPath(ide, scope, skillName);
            await fs.ensureDir(installPath);

            // Write all downloaded files
            for (const file of files) {
                const filePath = path.join(installPath, file.path);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, file.content);
            }

            // Write metadata
            // Write metadata
            const repoUrl = `https://github.com/${owner}/${repo}`;
            const metadata = buildGitMetadata(skillName, repoUrl, basePath || undefined);
            writeSkillMetadata(installPath, metadata);

            // Inject into IDE configuration
            await injectSkill(ide, skillName, installPath, installPath);

            installed.push(config.name);
        } catch {
            // Skip if path not available
        }
    }

    return { skillName, sourceType: 'github', installed };
}

/**
 * Install from registry
 */
async function installFromRegistry(
    skillName: string,
    targetIDEs: string[],
    scope: 'project' | 'global',
    spinner: ReturnType<typeof ora>
): Promise<InstallResult> {
    spinner.text = 'Checking skill registry...';
    const meta = await fetchSkillMeta(skillName);

    let installed: string[] = [];

    if (meta && meta.repo) {
        // Found in registry - download from GitHub
        spinner.text = `Found ${skillName} in registry, downloading...`;
        const result = await installFromGitHub(meta.repo, targetIDEs, scope, spinner);

        // Update metadata to mark as registry source
        for (const ide of targetIDEs) {
            try {
                const installPath = getInstallPath(ide, scope, skillName);
                const metadata = buildRegistryMetadata(skillName, meta.repo);
                writeSkillMetadata(installPath, metadata);

                // Inject into IDE configuration
                await injectSkill(ide, skillName, installPath, installPath);
            } catch {
                // Skip
            }
        }

        installed = result.installed;
    } else {
        // Not in registry - create placeholder
        spinner.text = `Creating placeholder for ${skillName}...`;
        const skillContent = `---
name: ${skillName}
description: Installed via Killer-Skills CLI
---

# ${skillName}

This skill was installed by Killer-Skills.
`;

        for (const ide of targetIDEs) {
            const config = IDE_CONFIG[ide];
            try {
                const installPath = getInstallPath(ide, scope, skillName);
                await fs.ensureDir(installPath);
                await fs.writeFile(path.join(installPath, 'SKILL.md'), skillContent);

                const metadata = buildRegistryMetadata(skillName, '');
                writeSkillMetadata(installPath, metadata);

                // Inject into IDE configuration
                await injectSkill(ide, skillName, installPath, installPath);

                installed.push(config.name);
            } catch {
                // Skip if path not available
            }
        }
    }

    return { skillName, sourceType: 'registry', installed };
}
