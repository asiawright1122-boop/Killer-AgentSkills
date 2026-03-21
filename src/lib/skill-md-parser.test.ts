import { describe, it, expect } from 'vitest';
import { parseSkillMd } from './skill-md-parser';

describe('parseSkillMd', () => {
  it('parses frontmatter with all fields', () => {
    const content = `---
name: test-skill
description: A test skill
version: 1.0.0
author: test-author
    tags: [ai, automation]
---
# Body content`;
    const result = parseSkillMd(content);
    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill');
    expect(result.version).toBe('1.0.0');
    expect(result.author).toBe('test-author');
    expect(result.tags).toEqual(['ai', 'automation']);
    expect(result.body).toContain('# Body content');
  });

  it('parses frontmatter with quoted values', () => {
    const content = `---
name: "quoted-name"
description: 'quoted-description'
tags: [tag1, "tag 2"]
---
body`;
    const result = parseSkillMd(content);
    expect(result.name).toBe('quoted-name');
    expect(result.description).toBe('quoted-description');
    expect(result.tags).toEqual(['tag1', 'tag 2']);
    expect(result.body).toBe('body');
  });

  it('returns body only when no frontmatter', () => {
    const content = '# Just markdown';
    const result = parseSkillMd(content);
    expect(result.name).toBeUndefined();
    expect(result.body).toBe('# Just markdown');
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\nname: crlf-test\r\n---\r\nbody';
    const result = parseSkillMd(content);
    expect(result.name).toBe('crlf-test');
    expect(result.body).toBe('body');
  });
});
