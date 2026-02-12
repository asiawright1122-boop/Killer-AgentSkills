/**
 * E2E Tests - Shell Completion
 * 
 * Tests for: completion
 */

import { describe, it, expect } from 'vitest';
import { runCLI } from './utils.js';

describe('Completion Command', () => {

    describe('completion bash', () => {
        it('should generate bash completion script', () => {
            const result = runCLI('completion bash');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('_killer_completion');
            expect(result.stdout).toContain('complete');
        });
    });

    describe('completion zsh', () => {
        it('should generate zsh completion script', () => {
            const result = runCLI('completion zsh');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('compdef');
            expect(result.stdout).toContain('_killer');
        });
    });

    describe('completion fish', () => {
        it('should generate fish completion script', () => {
            const result = runCLI('completion fish');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('complete');
            expect(result.stdout).toContain('killer');
        });
    });

    describe('completion invalid', () => {
        it('should error for unsupported shell', () => {
            const result = runCLI('completion invalid-shell');
            // Should either error or show warning
            expect(result.stdout + result.stderr).toMatch(/unsupported|error|not supported|invalid/i);
        });
    });
});
