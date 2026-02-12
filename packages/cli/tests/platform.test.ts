/**
 * Tests for platform utilities
 */

import { describe, it, expect } from 'vitest';
import { isLocalPath, expandTilde } from '../src/utils/platform.js';
import os from 'os';
import path from 'path';

describe('isLocalPath', () => {
    it('should recognize absolute paths', () => {
        expect(isLocalPath('/usr/local/bin')).toBe(true);
        expect(isLocalPath('/home/user/skills')).toBe(true);
    });

    it('should recognize relative paths starting with ./', () => {
        expect(isLocalPath('./my-skill')).toBe(true);
        expect(isLocalPath('./skills/pdf')).toBe(true);
    });

    it('should recognize relative paths starting with ../', () => {
        expect(isLocalPath('../my-skill')).toBe(true);
        expect(isLocalPath('../../skills')).toBe(true);
    });

    it('should recognize home directory paths', () => {
        expect(isLocalPath('~/skills')).toBe(true);
        expect(isLocalPath('~/.claude/skills')).toBe(true);
    });

    it('should reject owner/repo format', () => {
        // Note: this test might fail if the path happens to exist
        // The function also checks fs.existsSync
        expect(isLocalPath('not-a-real-path-that-exists')).toBe(false);
    });
});

describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
        const result = expandTilde('~/skills');
        expect(result).toBe(path.join(os.homedir(), 'skills'));
    });

    it('should expand paths with multiple components', () => {
        const result = expandTilde('~/.claude/skills/pdf');
        expect(result).toBe(path.join(os.homedir(), '.claude/skills/pdf'));
    });

    it('should not modify paths without tilde', () => {
        expect(expandTilde('/usr/local')).toBe('/usr/local');
        expect(expandTilde('./relative')).toBe('./relative');
    });
});
