/**
 * E2E Tests - Create and Init Commands
 * 
 * Tests for: create, init, submit (dry-run)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { runCLI, createTempDir, cleanupTempDir, createMockSkill } from './utils.js';

let tempDir: string;

describe('Create and Init Commands', () => {

    afterEach(async () => {
        if (tempDir) {
            await cleanupTempDir(tempDir);
        }
    });

    describe('create --help', () => {
        it('should display help', () => {
            const result = runCLI('create --help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Create a new skill');
        });
    });

    describe('init --help', () => {
        it('should display help', () => {
            const result = runCLI('init --help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Initialize skills configuration');
        });
    });

    describe('submit --dry-run', () => {
        it('should validate skill structure', async () => {
            tempDir = await createTempDir();
            const skillPath = await createMockSkill(tempDir, 'test-skill');

            const result = runCLI(`submit --dry-run ${skillPath}`);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Skill Information');
            expect(result.stdout).toContain('test-skill');
        });

        it('should error when SKILL.md missing', async () => {
            tempDir = await createTempDir();

            const result = runCLI(`submit --dry-run ${tempDir}`);
            expect(result.exitCode).not.toBe(0);
            expect(result.stdout + result.stderr).toContain('SKILL.md not found');
        });
    });
});
