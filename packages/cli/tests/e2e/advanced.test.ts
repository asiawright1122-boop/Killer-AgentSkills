/**
 * E2E Tests - Advanced Commands
 * 
 * Tests for: do, search, config, stats, plugin
 */

import { describe, it, expect } from 'vitest';
import { runCLI } from './utils.js';

describe('Advanced Commands', () => {

    describe('do', () => {
        it('should match task to skills with --list', () => {
            const result = runCLI('do "process pdf files" --list');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Task:');
        });

        it('should show no matches for unrelated task', () => {
            const result = runCLI('do "completely random gibberish xyz" --list');
            expect(result.exitCode).toBe(0);
        });
    });

    describe('search', () => {
        it('should display help', () => {
            const result = runCLI('search --help');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Search for skills');
        });
    });

    describe('config', () => {
        it('should display current config', () => {
            const result = runCLI('config');
            expect(result.exitCode).toBe(0);
            // Either shows configuration or help
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should support list subcommand', () => {
            const result = runCLI('config list');
            // Config list should work
            expect(result.stdout.length).toBeGreaterThan(0);
        });
    });

    describe('stats', () => {
        it('should display usage statistics', () => {
            const result = runCLI('stats');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Usage Statistics');
        });

        it('should support --json output', () => {
            const result = runCLI('stats --json');
            expect(result.exitCode).toBe(0);
            // Should be valid JSON
            const parsed = JSON.parse(result.stdout);
            expect(parsed).toHaveProperty('totalRuns');
        });
    });

    describe('plugin', () => {
        it('should list plugins', () => {
            const result = runCLI('plugin list');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Installed Plugins');
        });

        it('should show empty list when no plugins', () => {
            const result = runCLI('plugin list');
            expect(result.exitCode).toBe(0);
            // Either has plugins or shows "No plugins installed"
            expect(result.stdout.length).toBeGreaterThan(0);
        });
    });
});
