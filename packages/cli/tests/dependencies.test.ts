/**
 * Tests for dependency utilities
 */

import { describe, it, expect } from 'vitest';
import { parseDependencies } from '../src/utils/dependencies.js';

describe('parseDependencies', () => {
    it('should parse required dependencies', () => {
        const content = `---
name: test-skill
requires:
  - pdf
  - docx
---

# Test Skill
`;
        const deps = parseDependencies(content);
        expect(deps.requires).toHaveLength(2);
        expect(deps.requires[0].name).toBe('pdf');
        expect(deps.requires[1].name).toBe('docx');
    });

    it('should parse optional dependencies', () => {
        const content = `---
name: test-skill
optional:
  - xlsx
  - pptx
---

# Test Skill
`;
        const deps = parseDependencies(content);
        expect(deps.optional).toHaveLength(2);
        expect(deps.optional[0].name).toBe('xlsx');
        expect(deps.optional[0].optional).toBe(true);
    });

    it('should parse versioned dependencies', () => {
        const content = `---
name: test-skill
requires:
  - pdf@1.0.0
---

# Test Skill
`;
        const deps = parseDependencies(content);
        expect(deps.requires[0].name).toBe('pdf');
        expect(deps.requires[0].version).toBe('1.0.0');
    });

    it('should return empty arrays for skills without dependencies', () => {
        const content = `---
name: test-skill
description: A simple skill
---

# Test Skill
`;
        const deps = parseDependencies(content);
        expect(deps.requires).toHaveLength(0);
        expect(deps.optional).toHaveLength(0);
    });

    it('should return empty arrays for content without frontmatter', () => {
        const content = `# Test Skill

Some content here.
`;
        const deps = parseDependencies(content);
        expect(deps.requires).toHaveLength(0);
        expect(deps.optional).toHaveLength(0);
    });
});
