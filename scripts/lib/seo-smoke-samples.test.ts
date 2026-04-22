import { describe, expect, it } from 'vitest';
import { compileSitemapBlocklist } from '../../src/lib/sitemap-blocklist';
import type { SitemapSkillEntry } from '../../src/lib/skill-route-paths';
import {
  buildRepoRootPath,
  pickBlocklistedSkillSample,
  pickSingleRouteRepoRedirectSample,
  pickSuppressedLocaleRedirectSample,
  readRedirectPathname,
  type SkillLocaleGovernanceRecord,
} from './seo-smoke-samples';

describe('seo smoke sample helpers', () => {
  it('builds repo-root paths with encoded owner and repo segments', () => {
    expect(buildRepoRootPath('en', 'foo bar', 'skills/repo')).toBe('/en/skills/foo%20bar/skills%2Frepo');
  });

  it('reads redirect pathnames from relative and absolute locations', () => {
    expect(readRedirectPathname('/en/skills/vercel-labs/skills/find-skills?x=1')).toBe(
      '/en/skills/vercel-labs/skills/find-skills',
    );
    expect(readRedirectPathname('https://killer-skills.com/en/skills/a/b?x=1')).toBe('/en/skills/a/b');
  });

  it('picks a repo-root redirect sample only when the repo has a single public skill route', () => {
    const sitemapSkills: SitemapSkillEntry[] = [
      { owner: 'vercel-labs', repo: 'skills', routePath: 'skills/find-skills' },
      { owner: 'huggingface', repo: 'skills', routePath: 'skills/transformers-js' },
      { owner: 'huggingface', repo: 'skills', routePath: 'skills/hugging-face-datasets' },
    ];

    const sample = pickSingleRouteRepoRedirectSample(sitemapSkills, null);
    expect(sample).toEqual({
      sourcePath: '/en/skills/vercel-labs/skills',
      expectedPath: '/en/skills/vercel-labs/skills/find-skills',
      owner: 'vercel-labs',
      repo: 'skills',
      routePath: 'skills/find-skills',
    });
  });

  it('skips blocklisted repo routes when picking a repo-root redirect sample', () => {
    const sitemapSkills: SitemapSkillEntry[] = [
      { owner: 'blocklisted-owner', repo: 'skills', routePath: 'skills/private-skill' },
      { owner: 'public-owner', repo: 'kit', routePath: 'kit/only-skill' },
    ];
    const blocklist = compileSitemapBlocklist({
      rules: {
        excludeExact: ['blocklisted-owner/skills/private-skill'],
      },
    });

    const sample = pickSingleRouteRepoRedirectSample(sitemapSkills, blocklist);
    expect(sample?.owner).toBe('public-owner');
    expect(sample?.expectedPath).toBe('/en/skills/public-owner/kit/only-skill');
  });

  it('picks a suppressed locale redirect sample only for public governed routes', () => {
    const sitemapSkills: SitemapSkillEntry[] = [
      { owner: 'addyosmani', repo: 'web-quality-skills', routePath: 'web-quality-skills/best-practices' },
    ];
    const governanceRows: SkillLocaleGovernanceRecord[] = [
      {
        owner: 'ghost',
        routePath: 'ghost/missing-public-route',
        canonicalLocale: 'en',
        publishedLocales: ['en'],
      },
      {
        owner: 'addyosmani',
        routePath: 'web-quality-skills/best-practices',
        canonicalLocale: 'en',
        publishedLocales: ['en'],
      },
    ];

    const sample = pickSuppressedLocaleRedirectSample(sitemapSkills, governanceRows, null, ['fr', 'de']);
    expect(sample).toEqual({
      sourcePath: '/fr/skills/addyosmani/web-quality-skills/best-practices',
      expectedPath: '/en/skills/addyosmani/web-quality-skills/best-practices',
      owner: 'addyosmani',
      routePath: 'web-quality-skills/best-practices',
      requestedLocale: 'fr',
      canonicalLocale: 'en',
    });
  });

  it('returns null when every probe locale is already published', () => {
    const sitemapSkills: SitemapSkillEntry[] = [
      { owner: 'addyosmani', repo: 'web-quality-skills', routePath: 'web-quality-skills/best-practices' },
    ];
    const governanceRows: SkillLocaleGovernanceRecord[] = [
      {
        owner: 'addyosmani',
        routePath: 'web-quality-skills/best-practices',
        canonicalLocale: 'en',
        publishedLocales: ['en', 'fr', 'de'],
      },
    ];

    const sample = pickSuppressedLocaleRedirectSample(sitemapSkills, governanceRows, null, ['fr', 'de']);
    expect(sample).toBeNull();
  });

  it('picks a blocklisted exact skill sample for 410 verification', () => {
    const blocklist = compileSitemapBlocklist({
      rules: {
        excludeExact: ['0xti4n/codex-cli/babysit-pr'],
      },
    });

    const sample = pickBlocklistedSkillSample(blocklist);
    expect(sample).toEqual({
      sourcePath: '/en/skills/0xti4n/codex-cli/babysit-pr',
      owner: '0xti4n',
      routePath: 'codex-cli/babysit-pr',
    });
  });
});
