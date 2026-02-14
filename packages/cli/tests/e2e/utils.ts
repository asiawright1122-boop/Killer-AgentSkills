/**
 * E2E Test Utilities
 * 
 * Shared helpers for CLI end-to-end tests.
 */

import { execSync, ExecSyncOptions } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '..', '..', 'dist', 'index.js');

/**
 * Execute CLI command and return output
 */
export function runCLI(
    args: string,
    options: ExecSyncOptions = {}
): { stdout: string; stderr: string; exitCode: number } {
    const cmd = `node ${CLI_PATH} ${args}`;

    try {
        const output = execSync(cmd, {
            encoding: 'utf-8',
            timeout: 30000,
            env: { ...process.env, NO_COLOR: '1', KILLER_SKILLS_TEST: '1' },
            ...options
        });
        return { stdout: String(output), stderr: '', exitCode: 0 };
    } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        return {
            stdout: execError.stdout || '',
            stderr: execError.stderr || '',
            exitCode: execError.status || 1
        };
    }
}

/**
 * Create a temporary test directory
 */
export async function createTempDir(prefix = 'killer-skills-test'): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
    await fs.ensureDir(tempDir);
    return tempDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
    try {
        await fs.remove(dir);
    } catch {
        // Ignore cleanup errors
    }
}

/**
 * Create a mock skill for testing
 */
export async function createMockSkill(dir: string, name: string): Promise<string> {
    const skillDir = path.join(dir, name);
    await fs.ensureDir(skillDir);

    const skillContent = `---
name: ${name}
description: A test skill for E2E testing
author: Test Author
version: 1.0.0
tags:
  - test
  - e2e
---

# ${name}

This is a test skill created for E2E testing.

## Usage

Use this skill for testing purposes.
`;

    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);
    return skillDir;
}

/**
 * Get skills directory for testing
 */
export function getTestSkillsDir(): string {
    return path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
}
