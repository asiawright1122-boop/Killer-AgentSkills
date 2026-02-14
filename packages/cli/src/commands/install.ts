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
import { select } from '@inquirer/prompts';
import { exec } from 'child_process';
import os from 'os';
import { IDE_CONFIG, SUPPORTED_IDES, getInstallPath } from '../config/ides.js';
// Registry removed — website search is now the primary lookup method
import { writeSkillMetadata, buildGitMetadata, buildLocalMetadata } from '../utils/skill-metadata.js';
import { isGitHubRepo, parseRepoString, normalizeGitHubUrl, findSkillFile, findAllSkillFiles, downloadSkillFiles, searchSkillsOnGitHub } from '../utils/github.js';
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
                // For direct GitHub URLs, we don't have a separate query, stick with source or derive
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
    spinner: ReturnType<typeof ora>,
    query?: string
): Promise<InstallResult> {
    spinner.text = 'Parsing repository...';

    const normalizedSource = normalizeGitHubUrl(source);
    const { owner, repo } = parseRepoString(normalizedSource);

    spinner.text = `Finding skill in ${owner}/${repo}...`;
    const skillFiles = await findAllSkillFiles(owner, repo, query);

    let skillFile;

    if (skillFiles.length === 0) {
        throw new Error(`No SKILL.md found in ${owner}/${repo}`);
    } else if (skillFiles.length === 1) {
        skillFile = skillFiles[0];
    } else {
        // Multiple skills found - prompt user
        spinner.stop();
        console.log(chalk.yellow(`\n📦 Multiple skills found in ${owner}/${repo}:`));

        const answer = await select({
            message: 'Select skill to install:',
            choices: [
                ...skillFiles.map(f => {
                    const dir = path.dirname(f.path);
                    const label = dir === '.' ? '(root)' : path.basename(dir);
                    return {
                        name: `${label}  ${chalk.dim(`(${f.path})`)}`,
                        value: f
                    };
                }),
                { name: '❌ Cancel', value: 'CANCEL' as any }
            ]
        });

        if (answer === 'CANCEL' || typeof answer === 'string') {
            console.log(chalk.dim('Installation cancelled.'));
            process.exit(0);
        }

        skillFile = answer;
        spinner.start(`Installing ${path.basename(path.dirname(skillFile.path))}...`);
    }

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

            for (const file of files) {
                const filePath = path.join(installPath, file.path);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, file.content);
            }

            const repoUrl = `https://github.com/${owner}/${repo}`;
            const metadata = buildGitMetadata(skillName, repoUrl, basePath || undefined);
            writeSkillMetadata(installPath, metadata);

            await injectSkill(ide, skillName, installPath, installPath);
            installed.push(config.name);
        } catch {
            // Skip if path not available
        }
    }

    return { skillName, sourceType: 'github', installed };
}

// ─── Helpers ───────────────────────────────────────────────

/** Search official website API */
async function searchWebsiteSkills(query: string): Promise<any[]> {
    try {
        const res = await fetch(`https://killer-skills.com/api/skills/search?q=${encodeURIComponent(query)}&limit=10`);
        if (!res.ok) return [];
        const data = await res.json() as any;
        return data.skills || [];
    } catch {
        return [];
    }
}

/**
 * Score and rank website results by relevance to the query.
 * Returns only results with score >= 40 (name must contain query), 
 * sorted by relevance score then stars.
 */
function scoreAndRankResults(results: any[], query: string): any[] {
    const q = query.toLowerCase();

    const scored = results.map(s => {
        let score = 0;
        const name = (s.name || '').toLowerCase();

        // Tier 1: Exact name match (strongest signal)
        if (name === q) score += 100;
        // Tier 2: Name starts with query
        else if (name.startsWith(q)) score += 60;
        // Tier 3: Name contains query
        else if (name.includes(q)) score += 40;

        // Bonus: Skill ID last segment is exact match
        const idParts = (s.id || '').toLowerCase().split('/');
        const lastPart = idParts[idParts.length - 1];
        if (lastPart === q) score += 20;

        // NOTE: Description-only matches (score < 40) are intentionally excluded.
        // SEO keyword pollution makes description matching unreliable.
        // Do NOT add score for description matches.

        return { ...s, _score: score, _stars: s.stars || 0 };
    });

    return scored
        .filter(s => s._score >= 40)  // STRICT: name must contain query
        .sort((a, b) => {
            // Primary: relevance score
            if (b._score !== a._score) return b._score - a._score;
            // Secondary: stars (real popularity, not AI-assigned qualityScore)
            return b._stars - a._stars;
        });
}

/** Extract the skill subdirectory from a skill ID (e.g. "anthropics/skills/pdf" → "pdf") */
function extractSkillSubdir(skillId: string): string | undefined {
    const parts = (skillId || '').split('/');
    if (parts.length >= 3) {
        return parts.slice(2).join('/');
    }
    return undefined;
}

/** Open URL in browser */
function openUrl(url: string) {
    const platform = os.platform();
    const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${command} "${url}"`, () => { });
}

// ─── Install from Registry ────────────────────────────────

/** Well-known official skill repositories (fallback for un-indexed skills) */
const OFFICIAL_SKILL_REPOS = [
    'anthropics/skills',       // Official Anthropic skills (68K★)
];

/**
 * Install from registry (with multi-phase fallback)
 * 
 * Phase 1: Website Search → fast, covers 350+ indexed skills
 * Phase 2: Official Repos → fallback for un-indexed skills (anthropics/skills)
 * Phase 3: GitHub Search  → broadest fallback, suggests repos
 */
async function installFromRegistry(
    skillName: string,
    targetIDEs: string[],
    scope: 'project' | 'global',
    spinner: ReturnType<typeof ora>
): Promise<InstallResult> {

    // ── Phase 1: Website Search (primary, fastest) ─────────
    spinner.text = `Searching for '${skillName}'...`;

    const rawResults = await searchWebsiteSkills(skillName);
    const ranked = scoreAndRankResults(rawResults, skillName);

    if (ranked.length > 0) {
        const exactMatches = ranked.filter(s => s._score >= 100);

        // ─ Auto-install: single exact name match ─
        if (exactMatches.length === 1) {
            const match = exactMatches[0];
            const subdir = extractSkillSubdir(match.id) || skillName;
            const ghRepo = `${match.owner}/${match.repo}`;
            spinner.text = `Found ${match.id} → installing...`;

            try {
                const result = await installFromGitHub(ghRepo, targetIDEs, scope, spinner, subdir);
                if (result.installed.length > 0) {
                    return { skillName: result.skillName, sourceType: 'github', installed: result.installed };
                }
            } catch {
                // Install failed, fall through to menu
            }
        }

        // ─ Auto-install: multiple exact matches, one clearly dominant (5x stars) ─
        if (exactMatches.length > 1) {
            const byStars = [...exactMatches].sort((a, b) => b._stars - a._stars);
            if (byStars[0]._stars > byStars[1]._stars * 5) {
                const match = byStars[0];
                const subdir = extractSkillSubdir(match.id) || skillName;
                const ghRepo = `${match.owner}/${match.repo}`;
                spinner.text = `Found ${match.id} (${match._stars.toLocaleString()}★) → installing...`;

                try {
                    const result = await installFromGitHub(ghRepo, targetIDEs, scope, spinner, subdir);
                    if (result.installed.length > 0) {
                        return { skillName: result.skillName, sourceType: 'github', installed: result.installed };
                    }
                } catch {
                    // Install failed, fall through to menu
                }
            }
        }

        // ─ Interactive menu ─
        spinner.stop();
        console.log(chalk.yellow(`\nMultiple skills match '${skillName}':\n`));

        const answer = await select({
            message: 'Select skill to install:',
            choices: [
                ...ranked.map(s => {
                    const desc = typeof s.description === 'string'
                        ? s.description
                        : (s.description?.en || '');
                    const shortDesc = desc.length > 60 ? desc.substring(0, 57) + '...' : desc;
                    const label = s.id || `${s.owner}/${s.repo}`;
                    const stars = s._stars ? ` (${s._stars.toLocaleString()}★)` : '';
                    return {
                        name: `${chalk.bold(label)}${chalk.dim(stars)} - ${chalk.dim(shortDesc)}`,
                        value: s.id
                    };
                }),
                { name: chalk.dim('─'.repeat(40)), value: 'SEP', disabled: true },
                { name: '🔍 Search GitHub broadly...', value: 'SEARCH_GITHUB' },
                { name: '❌ Cancel', value: 'CANCEL' }
            ]
        });

        if (answer === 'CANCEL') {
            console.log(chalk.dim('Installation cancelled.'));
            process.exit(0);
        }

        if (answer !== 'SEARCH_GITHUB') {
            const selectedParts = answer.split('/');
            const selOwner = selectedParts[0];
            const selRepo = selectedParts[1];
            const selSubdir = selectedParts.length >= 3 ? selectedParts.slice(2).join('/') : skillName;
            const ghRepo = `${selOwner}/${selRepo}`;

            spinner.start(`Installing ${answer}...`);
            const result = await installFromGitHub(ghRepo, targetIDEs, scope, spinner, selSubdir);

            if (result.installed.length > 0) {
                return { skillName: result.skillName, sourceType: 'github', installed: result.installed };
            } else {
                spinner.fail(chalk.red(`Failed to install ${ghRepo}`));
                process.exit(1);
            }
        }

        // User selected "Search GitHub" → fall through to Phase 3
        spinner.start(`Searching GitHub for '${skillName}'...`);
    }

    // ── Phase 2: Official Repos (un-indexed skill fallback) ─
    for (const officialRepo of OFFICIAL_SKILL_REPOS) {
        spinner.text = `Checking ${officialRepo}...`;
        try {
            const result = await installFromGitHub(officialRepo, targetIDEs, scope, spinner, skillName);
            if (result.installed.length > 0) {
                return { skillName: result.skillName, sourceType: 'github', installed: result.installed };
            }
        } catch {
            // Not found in this official repo
        }
    }

    // ── Phase 3: GitHub Broad Search ───────────────────────
    spinner.text = `Searching GitHub for '${skillName}'...`;
    try {
        const searchResults = await searchSkillsOnGitHub(skillName) as { repository: { full_name: string; description?: string } }[];

        if (searchResults.length > 0) {
            spinner.fail(chalk.yellow(`Skill '${skillName}' not found. Did you mean?`));
            console.log('');

            searchResults.slice(0, 5).forEach(item => {
                const repo = item.repository;
                console.log(`  • ${chalk.bold(repo.full_name)}`);
                if (repo.description) {
                    const desc = repo.description.length > 80
                        ? repo.description.substring(0, 77) + '...'
                        : repo.description;
                    console.log(chalk.dim(`    ${desc}`));
                }
            });

            console.log(chalk.blue('\n💡 Install with: killer install <owner/repo>'));
        } else {
            spinner.fail(chalk.yellow(`Skill '${skillName}' not found.`));
        }
    } catch {
        spinner.fail(chalk.yellow(`Skill '${skillName}' not found.`));
    }

    console.log('');
    console.log(chalk.dim('─'.repeat(45)));
    console.log(chalk.cyan('🌐 Browse all skills on our website:'));
    const searchUrl = `https://killer-skills.com/en/skills?q=${encodeURIComponent(skillName)}`;
    console.log(chalk.blue.underline(searchUrl));
    console.log(chalk.dim('─'.repeat(45)));

    process.exit(1);
}

