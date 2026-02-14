/**
 * Platform Detection and Path Utilities
 * 
 * Functions for detecting IDEs and creating installation paths.
 * Converted from platform.js to TypeScript.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { IDE_CONFIG, SUPPORTED_IDES } from '../config/ides.js';

export interface PlatformInfo {
    platform: NodeJS.Platform;
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    homedir: string;
    cwd: string;
}

export interface DetectedIDE {
    ide: string;
    name: string;
    priority: number;
    path: string;
    method?: 'path' | 'env';
}

/**
 * Get current platform info
 */
export function getPlatformInfo(): PlatformInfo {
    return {
        platform: process.platform,
        isWindows: process.platform === 'win32',
        isMac: process.platform === 'darwin',
        isLinux: process.platform === 'linux',
        homedir: os.homedir(),
        cwd: process.cwd()
    };
}

/**
 * Detect which IDEs are available in the current project
 */
export function detectProjectIDEs(projectPath = process.cwd()): DetectedIDE[] {
    const detected: DetectedIDE[] = [];

    for (const ideKey of SUPPORTED_IDES) {
        const config = IDE_CONFIG[ideKey];
        if (!config.detectFiles) continue;

        for (const detectFile of config.detectFiles) {
            const checkPath = path.join(projectPath, detectFile);
            if (fs.existsSync(checkPath)) {
                detected.push({
                    ide: ideKey,
                    name: config.name,
                    priority: config.priority,
                    path: checkPath
                });
                break;
            }
        }
    }

    // Sort by priority
    return detected.sort((a, b) => a.priority - b.priority);
}

/**
 * Check if an IDE root directory was genuinely created by the IDE itself,
 * not just by our CLI's `fs.ensureDir` during installation.
 * 
 * A real IDE install has config files, extensions dirs, etc.
 * Our install only creates `skills/` or `agents/` subdirectories.
 */
function isRealIDEInstall(ideRootDir: string): boolean {
    if (!fs.existsSync(ideRootDir)) return false;

    try {
        const entries = fs.readdirSync(ideRootDir);
        // Directories/files that WE create — not evidence of a real IDE
        const ourDirs = new Set(['skills', 'agents', 'rules']);
        const realEntries = entries.filter(e => !ourDirs.has(e));
        // A real IDE install has at least one other file/dir
        // (e.g. argv.json, extensions/, config files, storage/, etc.)
        return realEntries.length > 0;
    } catch {
        return false;
    }
}

/**
 * Detect which IDEs are installed globally.
 * 
 * Uses heuristic: the IDE's home directory must contain files
 * beyond our own `skills/` subdirectory, proving the IDE itself
 * created the directory (prevents snowball effect from fs.ensureDir).
 */
export function detectGlobalIDEs(): DetectedIDE[] {
    const detected: DetectedIDE[] = [];
    const platform = getPlatformInfo();

    for (const ideKey of SUPPORTED_IDES) {
        const config = IDE_CONFIG[ideKey];
        let foundPath: string | null = null;

        // Check global path — derive IDE root from skills path
        // e.g. ~/.aider/skills → check ~/.aider for real install evidence
        if (config.paths?.global) {
            const ideRoot = path.dirname(config.paths.global);
            if (isRealIDEInstall(ideRoot)) {
                foundPath = config.paths.global;
            }
        }

        // Check platform-specific paths on Mac (with real install check)
        if (!foundPath && platform.isMac) {
            const macPaths: Record<string, string> = {
                claude: path.join(platform.homedir, '.claude'),
                antigravity: path.join(platform.homedir, '.gemini', 'antigravity'),
                cursor: path.join(platform.homedir, '.cursor'),
                vscode: path.join(platform.homedir, '.vscode'),
                windsurf: path.join(platform.homedir, '.windsurf'),
                kiro: path.join(platform.homedir, '.kiro')
            };
            if (macPaths[ideKey] && isRealIDEInstall(macPaths[ideKey])) {
                foundPath = macPaths[ideKey];
            }
        }

        // Check environment variables (always reliable)
        const envVars: Record<string, string[]> = {
            vscode: ['VSCODE_GIT_IPC_HANDLE', 'TERM_PROGRAM'],
            cursor: ['CURSOR_TRACE'],
            claude: ['CLAUDE_CODE_ENTRYPOINT']
        };

        if (envVars[ideKey]) {
            for (const envVar of envVars[ideKey]) {
                if (process.env[envVar]) {
                    foundPath = foundPath || 'runtime-detected';
                    break;
                }
            }
        }

        if (foundPath) {
            detected.push({
                ide: ideKey,
                name: config.name,
                priority: config.priority,
                path: foundPath,
                method: foundPath === 'runtime-detected' ? 'env' : 'path'
            });
        }
    }

    return detected.sort((a, b) => a.priority - b.priority);
}

/**
 * Get the best IDE for the current context
 */
export function getBestIDE(scope: 'project' | 'global' = 'project', projectPath = process.cwd()): string {
    if (scope === 'project') {
        const projectIDEs = detectProjectIDEs(projectPath);
        if (projectIDEs.length > 0) {
            return projectIDEs[0].ide;
        }
    }

    const globalIDEs = detectGlobalIDEs();
    if (globalIDEs.length > 0) {
        return globalIDEs[0].ide;
    }

    // Default to Claude Code if nothing detected
    return 'claude';
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): string {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

/**
 * Normalize path for current platform
 */
export function normalizePath(inputPath: string): string {
    return path.normalize(inputPath);
}

/**
 * Check if a path is a local path (file or directory)
 */
export function isLocalPath(source: string): boolean {
    // Starts with /, ./, ../, or ~
    return source.startsWith('/') ||
        source.startsWith('./') ||
        source.startsWith('../') ||
        source.startsWith('~') ||
        fs.existsSync(source);
}

/**
 * Expand tilde to home directory
 */
export function expandTilde(filePath: string): string {
    if (filePath.startsWith('~')) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}
