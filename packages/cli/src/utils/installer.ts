
/**
 * Headless Installer Utilities
 * 
 * Provides function to install skills programmatically without CLI prompts.
 * Used by MCP server and potentially other tools.
 */

import path from 'path';
import fs from 'fs-extra';
import { IDE_CONFIG, SUPPORTED_IDES, getInstallPath } from '../config/ides.js';
import { fetchSkillMeta } from '../registry.js';
import { writeSkillMetadata, buildRegistryMetadata, buildGitMetadata } from '../utils/skill-metadata.js';
import { isGitHubRepo, parseRepoString, normalizeGitHubUrl, findSkillFile, downloadSkillFiles } from '../utils/github.js';
import { detectGlobalIDEs } from '../utils/platform.js';
import { injectSkill } from '../utils/adapters.js';

export interface InstallOptions {
    ide?: string;
    scope?: 'project' | 'global';
}

export interface InstallResult {
    success: boolean;
    skillName: string;
    sourceType: 'registry' | 'github';
    installed: string[];
    error?: string;
}

/**
 * Install a skill (headless)
 */
export async function installSkill(source: string, options: InstallOptions = {}): Promise<InstallResult> {
    try {
        // Determine target IDEs
        let targetIDEs: string[] = [];
        if (options.ide) {
            if (!SUPPORTED_IDES.includes(options.ide)) {
                throw new Error(`Unknown IDE: ${options.ide}`);
            }
            targetIDEs = [options.ide];
        } else {
            // Auto-detect global IDEs for headless install
            const detected = detectGlobalIDEs();
            if (detected.length === 0) {
                targetIDEs = ['cursor']; // Default fallback
            } else {
                targetIDEs = detected.map(d => d.ide);
            }
        }

        const scope = options.scope || 'global';

        if (isGitHubRepo(source)) {
            return await installFromGitHubHeadless(source, targetIDEs, scope);
        } else {
            return await installFromRegistryHeadless(source, targetIDEs, scope);
        }
    } catch (error) {
        return {
            success: false,
            skillName: source,
            sourceType: 'registry', // fallback
            installed: [],
            error: (error as Error).message
        };
    }
}

async function installFromGitHubHeadless(
    source: string,
    targetIDEs: string[],
    scope: 'project' | 'global'
): Promise<InstallResult> {
    const normalizedSource = normalizeGitHubUrl(source);
    const { owner, repo } = parseRepoString(normalizedSource);

    const skillFile = await findSkillFile(owner, repo);
    const skillDir = path.dirname(skillFile.path);
    const skillName = skillDir === '.' ? repo : path.basename(skillDir);
    const basePath = skillDir === '.' ? '' : skillDir;

    // Download files
    const files = await downloadSkillFiles(owner, repo, basePath);
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
            // ignore
        }
    }

    return { success: true, skillName, sourceType: 'github', installed };
}

async function installFromRegistryHeadless(
    skillName: string,
    targetIDEs: string[],
    scope: 'project' | 'global'
): Promise<InstallResult> {
    const meta = await fetchSkillMeta(skillName);

    if (meta && meta.repo) {
        const result = await installFromGitHubHeadless(meta.repo, targetIDEs, scope);
        // Patch metadata source
        return { ...result, sourceType: 'registry' };
    } else {
        // Placeholder creation
        const installed: string[] = [];
        const skillContent = `---
name: ${skillName}
description: Installed via Killer-Skills MCP
---

# ${skillName}

This skill was installed via MCP.
`;

        for (const ide of targetIDEs) {
            const config = IDE_CONFIG[ide];
            try {
                const installPath = getInstallPath(ide, scope, skillName);
                await fs.ensureDir(installPath);
                await fs.writeFile(path.join(installPath, 'SKILL.md'), skillContent);

                const metadata = buildRegistryMetadata(skillName, '');
                writeSkillMetadata(installPath, metadata);

                await injectSkill(ide, skillName, installPath, installPath);
                installed.push(config.name);
            } catch {
                // ignore
            }
        }
        return { success: true, skillName, sourceType: 'registry', installed };
    }
}
