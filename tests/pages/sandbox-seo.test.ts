import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const readPageSource = (relativePath: string) => {
  const normalizedRelativePath = relativePath.startsWith('./')
    ? `src/pages/${relativePath.slice(2)}`
    : relativePath.startsWith('../')
      ? `src/${relativePath.slice(3)}`
      : relativePath;

  return readFileSync(new URL(`../../${normalizedRelativePath}`, import.meta.url), 'utf8');
};

describe('sandbox SEO guardrails', () => {
  it('keeps sandbox pages noindex and canonicalized back to the skill page', () => {
    const source = readPageSource('./[locale]/sandbox/[owner]/[repo].astro');

    expect(source).toContain("import { resolveSkillDetailLink } from '../../../../lib/skill-detail-link';");
    expect(source).toContain("Astro.response.headers.set('X-Robots-Tag', 'noindex, nofollow')");
    expect(source).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(source).toContain('const skillDetailLink = resolveSkillDetailLink({ owner, repo }, typedLocale);');
    expect(source).toContain('const canonicalSkillPath =');
    expect(source).toContain('skillDetailLink?.href ||');
    expect(source).toContain('<link rel="canonical" href={canonicalSkillUrl} />');
    expect(source).toContain('<a href={canonicalSkillPath} class="return-link"> ← Exit Sandbox </a>');
  });

  it('keeps robots.txt allowing sandbox crawl so page-level noindex can be seen', async () => {
    const mod = await import('../../src/pages/robots.txt');
    const response = await mod.GET({} as any);
    const body = await response.text();

    expect(body).not.toContain('Disallow: /*/sandbox/');
    expect(body).toContain('Sandbox execution pages are controlled with page-level noindex headers/meta.');
  });

  it('keeps robots.txt allowing API crawl so X-Robots-Tag can deindex historical API URLs', async () => {
    const mod = await import('../../src/pages/robots.txt');
    const response = await mod.GET({} as any);
    const body = await response.text();

    expect(body).not.toContain('Disallow: /api/');
    expect(body).toContain('API endpoints are controlled by X-Robots-Tag: noindex, nofollow.');
  });
});
