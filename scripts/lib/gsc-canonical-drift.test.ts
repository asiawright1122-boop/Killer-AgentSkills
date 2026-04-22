import { describe, expect, it } from 'vitest';
import { buildGscCanonicalDriftContext, classifyGscPageUrl } from './gsc-canonical-drift';

const context = buildGscCanonicalDriftContext({
  skills: [
    { owner: 'github', repo: 'awesome-copilot', routePath: 'awesome-copilot/gh-cli' },
    { owner: 'Thomascountz', repo: 'claude_skills', routePath: 'claude_skills/github' },
    { owner: 'agents-infrastructure', repo: 'licell', routePath: 'licell/alicloud-redis' },
    { owner: 'huggingface', repo: 'skills', routePath: 'skills/transformers-js' },
    { owner: 'huggingface', repo: 'skills', routePath: 'skills/hugging-face-datasets' },
    { owner: '0boluan0', repo: 'Notes_on_Economic_Statistics', routePath: 'Notes_on_Economic_Statistics/today' },
  ],
  localeGovernanceRecords: [
    {
      owner: '0boluan0',
      routePath: 'Notes_on_Economic_Statistics/today',
      eligibleLocales: ['en'],
      canonicalLocale: 'en',
    },
  ],
  blocklistData: {
    rules: {
      excludeRepo: ['pockfojoh/alumnos'],
    },
  },
  collections: [
    {
      id: 'top-agentic-ai-platforms-orchestration-tools.json',
      data: {
        canonicalSlug: 'top-agentic-ai-platforms-orchestration-tools',
        legacySlugs: ['top-agents-mcp-servers'],
      },
    },
  ],
});

const metrics = { entity: '', clicks: 0, impressions: 10, ctr: 0, position: 5 };

describe('gsc canonical drift classification', () => {
  it('classifies canonical skill trailing-slash URLs as canonicalization work', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/skills/github/awesome-copilot/gh-cli/',
      { ...metrics, entity: 'https://killer-skills.com/en/skills/github/awesome-copilot/gh-cli/' },
      context,
    );

    expect(result.kind).toBe('legacy_trailing_slash');
    expect(result.action).toBe('canonicalize');
    expect(result.targetUrl).toBe('https://killer-skills.com/en/skills/github/awesome-copilot/gh-cli');
  });

  it('classifies repo-root single-target skills as canonical redirects', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/skills/Thomascountz/claude_skills',
      { ...metrics, entity: 'https://killer-skills.com/en/skills/Thomascountz/claude_skills' },
      context,
    );

    expect(result.kind).toBe('skill_repo_root_single_target');
    expect(result.action).toBe('canonicalize');
    expect(result.targetUrl).toBe('https://killer-skills.com/en/skills/Thomascountz/claude_skills/github');
  });

  it('keeps blocklisted repo-root skills at 410', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/ja/skills/pockfojoh/alumnos/',
      { ...metrics, entity: 'https://killer-skills.com/ja/skills/pockfojoh/alumnos/' },
      context,
    );

    expect(result.kind).toBe('skill_blocklisted');
    expect(result.action).toBe('keep410');
    expect(result.targetUrl).toBeNull();
  });

  it('classifies suppressed locales as locale canonical drift', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/ja/skills/0boluan0/Notes_on_Economic_Statistics/today',
      { ...metrics, entity: 'https://killer-skills.com/ja/skills/0boluan0/Notes_on_Economic_Statistics/today' },
      context,
    );

    expect(result.kind).toBe('skill_noncanonical_locale');
    expect(result.action).toBe('canonicalize');
    expect(result.targetUrl).toBe('https://killer-skills.com/en/skills/0boluan0/Notes_on_Economic_Statistics/today');
  });

  it('classifies legacy collection slugs before trailing slash cleanup', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/collections/top-agents-mcp-servers/',
      { ...metrics, entity: 'https://killer-skills.com/en/collections/top-agents-mcp-servers/' },
      context,
    );

    expect(result.kind).toBe('collection_legacy_slug');
    expect(result.action).toBe('canonicalize');
    expect(result.targetUrl).toBe('https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools');
  });

  it('classifies legacy docs slugs as canonical redirects', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/docs/development/create-skill',
      { ...metrics, entity: 'https://killer-skills.com/en/docs/development/create-skill' },
      context,
    );

    expect(result.kind).toBe('docs_legacy_slug');
    expect(result.action).toBe('canonicalize');
    expect(result.targetUrl).toBe('https://killer-skills.com/en/docs/creating-skills');
  });

  it('classifies source-file paths as keep410', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/ar/skills/barateza/mcp-plesk-extension-guide/references/implement.md',
      {
        ...metrics,
        entity: 'https://killer-skills.com/ar/skills/barateza/mcp-plesk-extension-guide/references/implement.md',
      },
      context,
    );

    expect(result.kind).toBe('skill_source_file_path');
    expect(result.action).toBe('keep410');
  });

  it('classifies parameterized listing pages as noindex work', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/ja/skills?category=documentation',
      { ...metrics, entity: 'https://killer-skills.com/ja/skills?category=documentation' },
      context,
    );

    expect(result.kind).toBe('listing_parameter_page');
    expect(result.action).toBe('noindex');
    expect(result.targetUrl).toBe('https://killer-skills.com/ja/skills');
  });

  it('keeps multi-target repo roots on 410 because they have no safe canonical target', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/skills/huggingface/skills',
      { ...metrics, entity: 'https://killer-skills.com/en/skills/huggingface/skills' },
      context,
    );

    expect(result.kind).toBe('skill_repo_root_multi_target');
    expect(result.action).toBe('keep410');
  });

  it('classifies repo roots missing from the public corpus as keep410', () => {
    const result = classifyGscPageUrl(
      'https://killer-skills.com/en/skills/Dynokostya/just-works',
      { ...metrics, entity: 'https://killer-skills.com/en/skills/Dynokostya/just-works' },
      context,
    );

    expect(result.kind).toBe('skill_missing_or_unpublished');
    expect(result.action).toBe('keep410');
  });
});
