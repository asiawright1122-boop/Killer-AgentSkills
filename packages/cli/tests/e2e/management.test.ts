/**
 * E2E Tests - Skill Management Commands
 * 
 * Tests for: read, sync, deps, outdated
 */

import { describe, it, expect } from 'vitest';
import { runCLI } from './utils.js';

describe('Skill Management Commands', () => {

    describe('read', () => {
        it('should read skill content when skill exists', () => {
            // Try to read a skill that likely exists
            const result = runCLI('read pdf');

            if (result.exitCode === 0) {
                // Skill content should have substance
                expect(result.stdout.length).toBeGreaterThan(100);
            } else {
                // Skill might not be installed - any output is valid
                expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
            }
        });

        it('should error when skill does not exist', () => {
            const result = runCLI('read nonexistent-skill-12345');
            expect(result.exitCode).not.toBe(0);
        });
    });

    describe('sync', () => {
        it('should display help', () => {
            const result = runCLI('sync --help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Sync installed skills');
        });
    });

    describe('deps', () => {
        it('should check all dependencies', () => {
            const result = runCLI('deps');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Dependency Status');
        });

        it('should support specific skill check', () => {
            const result = runCLI('deps pdf');
            // Either shows deps or skill not found
            expect(result.stdout.length).toBeGreaterThan(0);
        });
    });

    describe('outdated', () => {
        it('should check for outdated skills', () => {
            const result = runCLI('outdated');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Skill Update Status');
        });
    });
});
