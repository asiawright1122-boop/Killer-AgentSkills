import { describe, expect, it } from 'vitest';
import { buildBlogArticleSchema, buildBlogBreadcrumbSchema } from './blog-schema';

describe('blog-schema', () => {
  describe('buildBlogArticleSchema', () => {
    it('builds a basic article schema with required fields', () => {
      const schema = buildBlogArticleSchema({
        title: 'Test Post',
        description: 'A test description',
        author: 'John Doe',
        pubDate: '2026-03-01T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/test-post',
        locale: 'en',
        wordCount: 1500,
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('Article');
      expect(schema.headline).toBe('Test Post');
      expect(schema.description).toBe('A test description');
      expect(schema.author['@type']).toBe('Person');
      expect(schema.author.name).toBe('John Doe');
      expect(schema.author.url).toBe('https://killer-skills.com/about');
      expect(schema.url).toBe('https://killer-skills.com/en/blog/test-post');
      expect(schema.inLanguage).toBe('en');
      expect(schema.wordCount).toBe(1500);
      expect(schema.mainEntityOfPage['@type']).toBe('WebPage');
      expect(schema.mainEntityOfPage['@id']).toBe('https://killer-skills.com/en/blog/test-post');
    });

    it('uses Date object for pubDate', () => {
      const date = new Date('2026-02-15T12:00:00.000Z');
      const schema = buildBlogArticleSchema({
        title: 'Date Test',
        description: 'Description',
        author: 'Jane',
        pubDate: date,
        canonicalUrl: 'https://killer-skills.com/en/blog/date-test',
        locale: 'zh',
        wordCount: 500,
      });

      expect(schema.datePublished).toBe(date.toISOString());
    });

    it('falls back to current date when pubDate is invalid', () => {
      const before = new Date().toISOString();
      const schema = buildBlogArticleSchema({
        title: 'Invalid Date Test',
        description: 'Description',
        author: 'Jane',
        pubDate: 'not-a-date',
        canonicalUrl: 'https://killer-skills.com/en/blog/invalid',
        locale: 'en',
        wordCount: 500,
      });
      const after = new Date().toISOString();

      expect(schema.datePublished).toBeDefined();
      const parsed = Date.parse(schema.datePublished);
      expect(parsed).toBeGreaterThanOrEqual(Date.parse(before));
      expect(parsed).toBeLessThanOrEqual(Date.parse(after));
    });

    it('uses updatedDate when provided', () => {
      const schema = buildBlogArticleSchema({
        title: 'Updated Post',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-01-01T00:00:00.000Z',
        updatedDate: '2026-03-10T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/updated',
        locale: 'en',
        wordCount: 500,
      });

      expect(schema.datePublished).toBe('2026-01-01T00:00:00.000Z');
      expect(schema.dateModified).toBe('2026-03-10T00:00:00.000Z');
    });

    it('uses pubDate as dateModified when updatedDate not provided', () => {
      const schema = buildBlogArticleSchema({
        title: 'No Update Post',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-02-01T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/no-update',
        locale: 'en',
        wordCount: 500,
      });

      expect(schema.datePublished).toBe('2026-02-01T00:00:00.000Z');
      expect(schema.dateModified).toBe('2026-02-01T00:00:00.000Z');
    });

    it('includes image when heroImage is provided', () => {
      const schema = buildBlogArticleSchema({
        title: 'With Image',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-03-01T00:00:00.000Z',
        heroImage: 'https://killer-skills.com/images/hero.jpg',
        canonicalUrl: 'https://killer-skills.com/en/blog/with-image',
        locale: 'en',
        wordCount: 500,
      });

      const s = schema as typeof schema & { image: { '@type': string; url: string; width: number; height: number } };
      expect(s.image).toBeDefined();
      expect(s.image['@type']).toBe('ImageObject');
      expect(s.image.url).toBe('https://killer-skills.com/images/hero.jpg');
      expect(s.image.width).toBe(1200);
      expect(s.image.height).toBe(630);
    });

    it('omits image when heroImage is not provided', () => {
      const schema = buildBlogArticleSchema({
        title: 'No Image',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-03-01T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/no-image',
        locale: 'en',
        wordCount: 500,
      });

      expect(schema).not.toHaveProperty('image');
    });

    it('defaults tags and category to empty/optional', () => {
      const schema = buildBlogArticleSchema({
        title: 'Minimal',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-03-01T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/minimal',
        locale: 'en',
        wordCount: 500,
      });

      expect(schema).not.toHaveProperty('tags');
      expect(schema).not.toHaveProperty('category');
    });

    it('sets correct publisher fields', () => {
      const schema = buildBlogArticleSchema({
        title: 'Publisher Test',
        description: 'Description',
        author: 'Jane',
        pubDate: '2026-03-01T00:00:00.000Z',
        canonicalUrl: 'https://killer-skills.com/en/blog/publisher',
        locale: 'en',
        wordCount: 500,
      });

      expect(schema.publisher['@type']).toBe('Organization');
      expect(schema.publisher.name).toBe('Killer-Skills');
      expect(schema.publisher.url).toBe('https://killer-skills.com');
      expect(schema.publisher.logo['@type']).toBe('ImageObject');
      expect(schema.publisher.logo.url).toBe('https://killer-skills.com/og-image.webp');
    });
  });

  describe('buildBlogBreadcrumbSchema', () => {
    it('builds breadcrumb with three items for locale', () => {
      const schema = buildBlogBreadcrumbSchema('en', 'My Blog Post', 'https://killer-skills.com/en/blog/my-blog-post');

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toHaveLength(3);
    });

    it('sets correct positions and names for all items', () => {
      const schema = buildBlogBreadcrumbSchema('zh', '中文文章标题', 'https://killer-skills.com/zh/blog/zh-title');

      const [home, blog, post] = schema.itemListElement;

      expect(home['@type']).toBe('ListItem');
      expect(home.position).toBe(1);
      expect(home.name).toBe('Home');
      expect(home.item).toBe('https://killer-skills.com/zh');

      expect(blog['@type']).toBe('ListItem');
      expect(blog.position).toBe(2);
      expect(blog.name).toBe('Blog');
      expect(blog.item).toBe('https://killer-skills.com/zh/blog');

      expect(post['@type']).toBe('ListItem');
      expect(post.position).toBe(3);
      expect(post.name).toBe('中文文章标题');
      expect(post.item).toBe('https://killer-skills.com/zh/blog/zh-title');
    });

    it('passes post title and canonicalUrl correctly', () => {
      const postTitle = 'Advanced TypeScript Tips';
      const canonical = 'https://killer-skills.com/en/blog/ts-tips';

      const schema = buildBlogBreadcrumbSchema('en', postTitle, canonical);
      const postItem = schema.itemListElement[2];

      expect(postItem.name).toBe(postTitle);
      expect(postItem.item).toBe(canonical);
    });
  });
});
