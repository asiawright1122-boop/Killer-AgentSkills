/**
 * Tests for GitHub utilities
 */

import { describe, it, expect } from 'vitest';
import { parseRepoString, isGitHubRepo, normalizeGitHubUrl } from '../src/utils/github.js';

describe('parseRepoString', () => {
    it('should parse owner/repo format', () => {
        const result = parseRepoString('anthropics/skills');
        expect(result.owner).toBe('anthropics');
        expect(result.repo).toBe('skills');
        expect(result.skillPath).toBeNull();
    });

    it('should parse owner/repo/path format', () => {
        const result = parseRepoString('anthropics/skills/pdf-skill');
        expect(result.owner).toBe('anthropics');
        expect(result.repo).toBe('skills');
        expect(result.skillPath).toBe('pdf-skill');
    });

    it('should throw for invalid format', () => {
        expect(() => parseRepoString('invalid')).toThrow();
    });
});

describe('isGitHubRepo', () => {
    it('should recognize owner/repo format', () => {
        expect(isGitHubRepo('anthropics/skills')).toBe(true);
    });

    it('should recognize github.com URLs', () => {
        expect(isGitHubRepo('https://github.com/anthropics/skills')).toBe(true);
        expect(isGitHubRepo('github.com/anthropics/skills')).toBe(true);
    });

    it('should recognize git@ URLs', () => {
        expect(isGitHubRepo('git@github.com:anthropics/skills.git')).toBe(true);
    });

    it('should reject local paths', () => {
        expect(isGitHubRepo('./my-skill')).toBe(false);
        expect(isGitHubRepo('/absolute/path')).toBe(false);
        expect(isGitHubRepo('../relative')).toBe(false);
    });

    it('should reject simple names', () => {
        // Single word without slash
        expect(isGitHubRepo('pdf')).toBe(false);
    });
});

describe('normalizeGitHubUrl', () => {
    it('should extract owner/repo from URLs', () => {
        expect(normalizeGitHubUrl('https://github.com/anthropics/skills'))
            .toBe('anthropics/skills');
    });

    it('should remove .git suffix', () => {
        expect(normalizeGitHubUrl('https://github.com/anthropics/skills.git'))
            .toBe('anthropics/skills');
    });

    it('should return input if already normalized', () => {
        expect(normalizeGitHubUrl('anthropics/skills'))
            .toBe('anthropics/skills');
    });
});
