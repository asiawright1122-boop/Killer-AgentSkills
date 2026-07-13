import { describe, expect, it, vi } from 'vitest';

// Mock current blog glob loader BEFORE importing pages.
vi.mock('../../src/lib/blog-glob-loader', () => {
  return {
    loadBlogPostsFromGlob: vi.fn(async () => [
      {
        id: 'en/announcing-killer-skills',
        data: { draft: false, category: 'creative-tools', lang: 'en', pubDate: new Date() },
      },
      {
        id: 'zh/automate-word-documents-with-docx-skills',
        data: { draft: false, category: 'document-automation', lang: 'zh', pubDate: new Date() },
      },
    ]),
  };
});

// Import pages after mock setup
import { GET as getBlogSitemap } from '../../src/pages/sitemap-blog.xml';
import { GET as getCollectionsSitemap } from '../../src/pages/sitemap-collections.xml';
import { GET as getDocsSitemap } from '../../src/pages/sitemap-docs.xml';

vi.mock('../../src/lib/sitemap-blocklist', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/lib/sitemap-blocklist')>();
  return {
    ...original,
    compileSitemapBlocklist: (raw: any) => {
      const compiled = original.compileSitemapBlocklist(raw);
      // Inject mock blocklist keys to test docs/collections/blog blocklist filtering
      compiled.exactKeys.add('blog/announcing-killer-skills');
      compiled.exactKeys.add('collections/productivity');
      compiled.exactKeys.add('docs/getting-started');
      return compiled;
    },
  };
});

describe('Sitemaps Purity & Blocklist Tests', () => {
  const mockContext = {} as any;

  it('verifies sitemap-blog.xml filters empty categories and applies blocklist', async () => {
    const response = await getBlogSitemap(mockContext);
    expect(response.status).toBe(200);
    const xml = await response.text();

    // Parse all loc urls
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    // 1. Verify no Hindi locale URLs
    const hiUrls = urls.filter((url) => url.includes('/hi/'));
    expect(hiUrls).toEqual([]);

    // 2. Verify blocklisted blog post is filtered out
    const blockedPostUrls = urls.filter((url) => url.includes('/article/announcing-killer-skills'));
    expect(blockedPostUrls).toEqual([]);
    const legacyBlogDetailUrls = urls.filter((url) => /\/blog\/(?!category\/)/.test(new URL(url).pathname));
    expect(legacyBlogDetailUrls).toEqual([]);

    // 3. Verify category URLs only exist if they have content or English fallback
    const categoryUrls = urls.filter((url) => url.includes('/blog/category/'));
    expect(categoryUrls.length).toBeGreaterThan(0);

    // Check that every category in the sitemap has valid naming and doesn't leak undefined/null
    categoryUrls.forEach((url) => {
      expect(url).not.toContain('undefined');
      expect(url).not.toContain('null');
    });
  });

  it('verifies sitemap-collections.xml applies blocklist and has no Hindi URLs', async () => {
    const response = await getCollectionsSitemap(mockContext);
    expect(response.status).toBe(200);
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    // 1. Verify no Hindi locale URLs
    const hiUrls = urls.filter((url) => url.includes('/hi/'));
    expect(hiUrls).toEqual([]);

    // 2. Verify blocklisted collection 'productivity' is filtered out
    const blockedCollectionUrls = urls.filter((url) => url.includes('/collections/productivity'));
    expect(blockedCollectionUrls).toEqual([]);
  });

  it('verifies sitemap-docs.xml applies blocklist and has no Hindi URLs', async () => {
    const response = await getDocsSitemap(mockContext);
    expect(response.status).toBe(200);
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    // 1. Verify no Hindi locale URLs
    const hiUrls = urls.filter((url) => url.includes('/hi/'));
    expect(hiUrls).toEqual([]);

    // 2. Verify blocklisted doc 'getting-started' is filtered out
    const blockedDocUrls = urls.filter((url) => url.includes('/docs/getting-started'));
    expect(blockedDocUrls).toEqual([]);
  });
});
