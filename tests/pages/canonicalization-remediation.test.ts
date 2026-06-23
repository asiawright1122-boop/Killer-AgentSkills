import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canonicalization and Blocklist Integration in Router', () => {
  it('imports sitemap blocklist helpers and blocklist JSON in dynamic router', () => {
    const fileContent = readFileSync(
      resolve(process.cwd(), 'src/pages/[locale]/skills/[owner]/[...repo].astro'),
      'utf8'
    );

    // Assert imports
    expect(fileContent).toContain('sitemapBlocklistData');
    expect(fileContent).toContain('compileSitemapBlocklist');
    expect(fileContent).toContain('isSitemapSkillBlocked');

    // Assert compile and check
    expect(fileContent).toContain('const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);');
    expect(fileContent).toContain('const isBlocked = isSitemapSkillBlocked(');

    // Assert layoutNoindex check contains isBlocked
    expect(fileContent).toContain('isBlocked ||');
  });
});
