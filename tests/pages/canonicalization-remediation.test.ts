import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canonicalization and Blocklist Integration in Router', () => {
  it('imports sitemap blocklist helpers and runtime loader in dynamic router', () => {
    const fileContent = readFileSync(
      resolve(process.cwd(), 'src/pages/[locale]/skills/[owner]/[...repo].astro'),
      'utf8'
    );

    // Assert imports — page now uses the runtime loader + the same check function
    expect(fileContent).toContain('isSitemapSkillBlocked');
    expect(fileContent).toContain('getSitemapBlocklist');

    // Assert runtime blocklist load and check
    expect(fileContent).toContain('const sitemapBlocklist = await getSitemapBlocklist(env);');
    expect(fileContent).toContain('const isBlocked = isSitemapSkillBlocked(');

    // Assert layoutNoindex check contains isBlocked
    expect(fileContent).toContain('isBlocked ||');
  });
});
