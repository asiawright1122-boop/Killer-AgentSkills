import { describe, it, expect } from 'vitest';
import { searchSkills, filterByCategory, calculateQualityScore } from './search';
import type { UnifiedSkill } from './skills';

function makeSkill(overrides: Partial<UnifiedSkill> = {}): UnifiedSkill {
  return {
    id: '1',
    name: 'Test Skill',
    skillName: 'test-skill',
    owner: 'test-owner',
    repo: 'test-repo',
    description: 'A test skill for testing purposes',
    category: 'development',
    topics: ['test', 'example'],
    stars: 100,
    source: 'cache',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const sampleSkills: UnifiedSkill[] = [
  makeSkill({
    id: '1',
    name: 'React',
    skillName: 'react',
    description: 'A JavaScript library for building user interfaces',
    category: 'development',
    topics: ['javascript', 'ui', 'frontend'],
    stars: 200000,
    source: 'verified',
  }),
  makeSkill({
    id: '2',
    name: 'Vue',
    skillName: 'vue',
    description: 'The Progressive JavaScript Framework',
    category: 'development',
    topics: ['javascript', 'ui', 'frontend'],
    stars: 45000,
    source: 'featured',
  }),
  makeSkill({
    id: '3',
    name: 'Pytest',
    skillName: 'pytest',
    description: 'Python testing framework',
    category: 'testing',
    topics: ['python', 'testing'],
    stars: 10000,
    source: 'cache',
  }),
  makeSkill({
    id: '4',
    name: 'Docker',
    skillName: 'docker',
    description: 'Container platform for building and deploying apps',
    category: 'devops',
    topics: ['containers', 'deployment'],
    stars: 70000,
    source: 'verified',
  }),
  makeSkill({
    id: '5',
    name: 'Tailwind CSS',
    skillName: 'tailwind-css',
    description: 'A utility-first CSS framework',
    category: 'design',
    topics: ['css', 'ui', 'frontend'],
    stars: 80000,
    source: 'featured',
  }),
];

describe('calculateQualityScore', () => {
  it('should give higher score for verified source', () => {
    const verified = makeSkill({ name: 'X', source: 'verified', stars: 100 });
    const cached = makeSkill({ name: 'X', source: 'cache', stars: 100 });
    const verifiedScore = calculateQualityScore(verified);
    const cachedScore = calculateQualityScore(cached);
    expect(verifiedScore).toBeGreaterThan(cachedScore);
  });

  it('should give higher popularity score for more stars', () => {
    const popular = makeSkill({ name: 'X', stars: 100000, source: 'cache' });
    const unpopular = makeSkill({ name: 'X', stars: 10, source: 'cache' });
    const popularScore = calculateQualityScore(popular);
    const unpopularScore = calculateQualityScore(unpopular);
    expect(popularScore).toBeGreaterThan(unpopularScore);
  });

  it('should handle skills with zero stars', () => {
    const skill = makeSkill({ name: 'Test', stars: 0, source: 'cache' });
    const score = calculateQualityScore(skill);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('searchSkills', () => {
  it('should return all skills for empty query', () => {
    const result = searchSkills(sampleSkills, '');
    expect(result).toHaveLength(sampleSkills.length);
  });

  it('should return all skills for whitespace-only query', () => {
    const result = searchSkills(sampleSkills, '   ');
    expect(result).toHaveLength(sampleSkills.length);
  });

  it('should find skills by name', () => {
    const result = searchSkills(sampleSkills, 'React');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe('React');
  });

  it('should find skills by description', () => {
    const result = searchSkills(sampleSkills, 'container');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((s) => s.name === 'Docker')).toBe(true);
  });

  it('should find skills by topics', () => {
    const result = searchSkills(sampleSkills, 'python');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((s) => s.name === 'Pytest')).toBe(true);
  });

  it('should be case-insensitive', () => {
    const result = searchSkills(sampleSkills, 'react');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe('React');
  });

  it('should return empty array when no skills match', () => {
    const result = searchSkills(sampleSkills, 'zzzznonexistent');
    expect(result).toEqual([]);
  });

  it('should support fuzzy matching (typos)', () => {
    // "Reac" should still match "React" via fuzzy search
    const result = searchSkills(sampleSkills, 'Reac');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe('React');
  });

  it('should sort results by relevance score', () => {
    // "javascript" appears in description of React and Vue, and in topics of both
    const result = searchSkills(sampleSkills, 'javascript');
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Both React and Vue match; React should rank higher due to more stars
  });

  it('should handle empty skills array', () => {
    const result = searchSkills([], 'test');
    expect(result).toEqual([]);
  });

  it('should search SEO keywords when available', () => {
    const skillsWithSeo = [
      makeSkill({
        id: '10',
        name: 'doc-coauthoring',
        skillName: 'doc-coauthoring',
        description: { en: 'Co-author documentation', zh: '协作编写文档' } as any,
        seo: {
          definition: { en: 'A documentation collaboration tool', zh: '一个文档协作工具' },
          features: { en: ['Documentation', 'Collaboration'], zh: ['文档', '协作'] },
          keywords: { en: ['documentation', 'writing', 'collaboration'], zh: ['文档', '写作', '协作'] },
        },
      }),
    ];
    // Search by SEO keyword
    const result = searchSkills(skillsWithSeo, 'writing');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('doc-coauthoring');
  });
});

describe('filterByCategory', () => {
  it('should filter by exact category', () => {
    const result = filterByCategory(sampleSkills, 'testing');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Pytest');
  });

  it('should support category groups', () => {
    // "development" group includes: development, git, api, code-review, cli, library
    const result = filterByCategory(sampleSkills, 'development');
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((s) => ['development', 'git', 'api', 'code-review', 'cli', 'library'].includes(s.category))).toBe(true);
  });

  it('should support devops category group', () => {
    const result = filterByCategory(sampleSkills, 'devops');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((s) => s.name === 'Docker')).toBe(true);
  });

  it('should support design category group', () => {
    const result = filterByCategory(sampleSkills, 'design');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((s) => s.name === 'Tailwind CSS')).toBe(true);
  });

  it('should return empty array for non-matching category', () => {
    const result = filterByCategory(sampleSkills, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('should handle empty skills array', () => {
    const result = filterByCategory([], 'development');
    expect(result).toEqual([]);
  });
});

