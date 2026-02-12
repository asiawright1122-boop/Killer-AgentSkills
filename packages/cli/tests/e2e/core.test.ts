/**
 * E2E Tests - Core Commands
 * 
 * Tests for: list, version, help
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runCLI } from './utils.js';

describe('CLI Core Commands', () => {

    describe('--version', () => {
        it('should display version number', () => {
            const result = runCLI('--version');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/1\.\d+\.\d+/);
        });
    });

    describe('--help', () => {
        it('should display help message', () => {
            const result = runCLI('--help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Killer-Skills CLI');
            expect(result.stdout).toContain('Commands:');
        });

        it('should list all commands', () => {
            const result = runCLI('--help');
            const commands = [
                'install', 'list', 'create', 'sync', 'read', 'update',
                'manage', 'search', 'publish', 'init', 'config', 'completion',
                'do', 'outdated', 'deps', 'submit', 'stats', 'plugin'
            ];

            for (const cmd of commands) {
                expect(result.stdout).toContain(cmd);
            }
        });
    });

    describe('list', () => {
        it('should list installed skills', () => {
            const result = runCLI('list');
            expect(result.exitCode).toBe(0);
            // Should show some output (skills or "no skills" message)
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should support --verbose option', () => {
            const result = runCLI('list --verbose');
            expect(result.exitCode).toBe(0);
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should display help', () => {
            const result = runCLI('list --help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('List all installed skills');
        });
    });
});
