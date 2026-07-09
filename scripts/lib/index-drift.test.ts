import { describe, expect, it } from 'vitest';
import { buildIndexDriftSnapshot, buildIndexDriftSnapshotFromIndexability } from './index-drift';
import type { SkillCache } from './types';

function buildIndexableSkill(overrides: Partial<SkillCache> = {}): SkillCache {
  return {
    id: 'demo/repo/skill-a',
    owner: 'demo',
    repo: 'repo',
    name: 'Skill A',
    description: { en: 'A strong skill description for testing governed sitemap drift alignment.' },
    qualityScore: 72,
    verified: false,
    agentAnalysis: {
      suitability:
        'Best for repository-aware workflows that need a structured decision before taking action in production systems.',
      recommendation:
        'Killer-Skills recommends this skill when operators need a repeatable high-signal workflow that can be indexed with strong first-party judgment and clear execution guidance.',
      useCases: ['Route governance', 'Indexability validation'],
      limitations: ['Does not crawl external systems directly'],
    },
    seo: {
      features: {
        en: ['Route governance', 'Indexability validation', 'Sitemap alignment'],
      },
    },
    skillMd: {
      body: '# Skill A\n\nThis test fixture contains enough source material to pass the governed indexability threshold and behave like a real public skill with useful operating guidance for search.',
    },
    ...overrides,
  } as SkillCache;
}

describe('index drift', () => {
  it('ignores blocklisted repos when comparing governed routes with sitemap routes', () => {
    const skills = [
      buildIndexableSkill({
        id: 'openai/codex/babysit-pr',
        owner: 'openai',
        repo: 'codex',
      }),
    ];
    const localeGovernance = [
      {
        id: 'openai/codex/babysit-pr',
        owner: 'openai',
        repo: 'codex',
        routePath: 'codex/babysit-pr',
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
        eligibleLocales: ['en'],
      },
    ];

    const snapshot = buildIndexDriftSnapshot({
      skills,
      localeGovernance,
      sitemapSkills: [],
      blocklistData: {
        rules: {
          excludeRepo: ['openai/codex'],
        },
      },
    });

    expect(snapshot.counts.onlyInIndexableCache).toBe(0);
    expect(snapshot.onlyInIndexableCache).toEqual([]);
  });

  it('compares at owner/routePath granularity instead of collapsing to repo-only keys', () => {
    const skills = [
      buildIndexableSkill({
        id: 'google-labs-code/stitch-skills/design-md',
        owner: 'google-labs-code',
        repo: 'stitch-skills',
      }),
    ];
    const localeGovernance = [
      {
        id: 'google-labs-code/stitch-skills/design-md',
        owner: 'google-labs-code',
        repo: 'stitch-skills',
        routePath: 'stitch-skills/design-md',
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
        eligibleLocales: ['en'],
      },
    ];
    const sitemapSkills = [
      {
        owner: 'google-labs-code',
        repo: 'stitch-skills',
        routePath: 'stitch-skills/design-md',
      },
    ];

    const snapshot = buildIndexDriftSnapshot({
      skills,
      localeGovernance,
      sitemapSkills,
      blocklistData: {},
    });

    expect(snapshot.counts.onlyInSitemap).toBe(0);
    expect(snapshot.counts.onlyInIndexableCache).toBe(0);
  });

  it('surfaces real governed-route drift when an indexable route is missing from sitemap', () => {
    const skills = [buildIndexableSkill()];
    const localeGovernance = [
      {
        id: 'demo/repo/skill-a',
        owner: 'demo',
        repo: 'repo',
        routePath: 'repo/skill-a',
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
        eligibleLocales: ['en'],
      },
    ];

    const snapshot = buildIndexDriftSnapshot({
      skills,
      localeGovernance,
      sitemapSkills: [],
      blocklistData: {},
    });

    expect(snapshot.counts.onlyInIndexableCache).toBe(1);
    expect(snapshot.onlyInIndexableCache).toEqual(['demo/repo/skill-a']);
  });

  it('uses indexability-report route keys as the generated sitemap projection when skills-cache is unavailable', () => {
    const snapshot = buildIndexDriftSnapshotFromIndexability({
      sitemapSkills: [
        { owner: 'demo', repo: 'repo', routePath: 'repo/skill-a' },
        { owner: 'demo', repo: 'repo', routePath: 'repo/skill-b' },
      ],
      indexabilityReport: {
        skills: [
          { owner: 'demo', routePath: 'repo/skill-a', isIndexable: true },
          { owner: 'demo', routePath: 'repo/skill-c', isIndexable: true },
          { owner: 'demo', routePath: 'repo/skill-b', isIndexable: false },
        ],
      },
      blocklistData: {},
    });

    expect(snapshot.counts.onlyInSitemap).toBe(0);
    expect(snapshot.counts.onlyInIndexableCache).toBe(0);
    expect(snapshot.onlyInSitemap).toEqual([]);
    expect(snapshot.onlyInIndexableCache).toEqual([]);
  });

  it('applies blocklist rules to indexability-report fallback candidates', () => {
    const snapshot = buildIndexDriftSnapshotFromIndexability({
      sitemapSkills: [],
      indexabilityReport: {
        skills: [
          { owner: 'demo', routePath: 'blocked-repo/skill-a', isIndexable: true },
          { owner: 'demo', routePath: 'repo/blocked-skill', isIndexable: true },
          { owner: 'demo', routePath: 'repo/skill-c', isIndexable: true },
        ],
      },
      blocklistData: {
        rules: {
          excludeRepo: ['demo/blocked-repo'],
          excludeExact: ['demo/repo/blocked-skill'],
        },
      },
    });

    expect(snapshot.counts.onlyInSitemap).toBe(0);
    expect(snapshot.counts.onlyInIndexableCache).toBe(0);
    expect(snapshot.onlyInSitemap).toEqual([]);
    expect(snapshot.onlyInIndexableCache).toEqual([]);
  });

  it('excludes non-target sitemap themes from governed drift candidates', () => {
    const skills = [
      buildIndexableSkill({
        id: 'demo/repo/tailored-resume-generator',
        name: 'Tailored Resume Generator',
        description: { en: 'Create resumes and portfolio content for job applications.' },
      }),
    ];
    const localeGovernance = [
      {
        id: 'demo/repo/tailored-resume-generator',
        owner: 'demo',
        repo: 'repo',
        routePath: 'repo/tailored-resume-generator',
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
        eligibleLocales: ['en'],
      },
    ];

    const snapshot = buildIndexDriftSnapshot({
      skills,
      localeGovernance,
      sitemapSkills: [],
      blocklistData: {},
    });

    expect(snapshot.counts.onlyInIndexableCache).toBe(0);
    expect(snapshot.onlyInIndexableCache).toEqual([]);
  });
});
