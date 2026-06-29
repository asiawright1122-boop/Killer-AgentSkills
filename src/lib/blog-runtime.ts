/**
 * Blog runtime loader.
 *
 * Loads blog post bodies at runtime from KV at runtime (production) or from
 * local markdown files in dev mode. This prevents the Content Layer from
 * inlining all blog content (body text) into the Worker bundle.
 */

import { SUPPORTED_LOCALES, type Locale } from '../i18n';

export type { Env } from './kv';

export interface BlogPostData {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  author: string;
  heroImage?: string;
  tags: string[];
  draft: boolean;
  lang: string;
  featured: boolean;
  category?: string;
}

export interface BlogPostEntry {
  id: string;
  slug: string;
  locale: Locale;
  data: BlogPostData;
  body: string;
}

let _blogCache: BlogPostEntry[] | null = null;
let _blogCacheTime = 0;

async function readLocalBlogPosts(): Promise<BlogPostEntry[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const baseDir = path.resolve(process.cwd(), 'src/content/blog');

  if (!fs.existsSync(baseDir)) return [];

  const entries: BlogPostEntry[] = [];

  const localeDirs = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const locale of localeDirs) {
    if (!SUPPORTED_LOCALES.includes(locale as Locale)) continue;

    const localeDir = path.join(baseDir, locale);
    const files = fs
      .readdirSync(localeDir, { withFileTypes: true })
      .filter((f) => f.isFile() && (f.name.endsWith('.md') || f.name.endsWith('.mdx')));

    for (const file of files) {
      try {
        const filePath = path.join(localeDir, file.name);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;

        const frontmatter = frontmatterMatch[1];
        const body = content.slice(frontmatterMatch[0].length).trim();

        // Simple frontmatter parsing
        const data: Partial<BlogPostData> = {
          title: '',
          description: '',
          pubDate: new Date(),
          author: 'Killer-Skills Team',
          tags: [],
          draft: false,
          lang: locale,
          featured: false,
        };

        for (const line of frontmatter.split('\n')) {
          const colonIndex = line.indexOf(':');
          if (colonIndex === -1) continue;
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();

          switch (key) {
            case 'title':
              data.title = value.replace(/^["']|["']$/g, '');
              break;
            case 'description':
              data.description = value.replace(/^["']|["']$/g, '');
              break;
            case 'pubDate':
              data.pubDate = new Date(value);
              break;
            case 'updatedDate':
              data.updatedDate = new Date(value);
              break;
            case 'author':
              data.author = value.replace(/^["']|["']$/g, '');
              break;
            case 'heroImage':
              data.heroImage = value.replace(/^["']|["']$/g, '');
              break;
            case 'tags':
              try {
                data.tags = JSON.parse(value);
              } catch {
                data.tags = value.split(',').map((t) => t.trim().replace(/^["']|["']$/g, ''));
              }
              break;
            case 'draft':
              data.draft = value === 'true';
              break;
            case 'lang':
              data.lang = value.replace(/^["']|["']$/g, '');
              break;
            case 'featured':
              data.featured = value === 'true';
              break;
            case 'category':
              data.category = value.replace(/^["']|["']$/g, '');
              break;
          }
        }

        const slug = file.name.replace(/\.(md|mdx)$/i, '');
        entries.push({
          id: `${locale}/${slug}`,
          slug,
          locale: locale as Locale,
          data: data as BlogPostData,
          body,
        });
      } catch {
        // Ignore malformed files
      }
    }
  }

  return entries;
}

export async function getBlogPosts(env?: { SKILLS_CACHE?: KVNamespace }): Promise<BlogPostEntry[]> {
  if (_blogCache && Date.now() - _blogCacheTime < 30000) {
    return _blogCache;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('blog-posts');
      if (raw) {
        _blogCache = JSON.parse(raw);
        _blogCacheTime = Date.now();
        return _blogCache;
      }
    } catch {
      // Ignore KV errors, fall through to local
    }
  }

  // Fallback: local files (dev mode)
  if (import.meta.env.DEV) {
    try {
      _blogCache = await readLocalBlogPosts();
      _blogCacheTime = Date.now();
      return _blogCache;
    } catch {
      // Ignore errors
    }
  }

  return [];
}

export async function getBlogPost(
  slug: string,
  locale: string,
  env?: { SKILLS_CACHE?: KVNamespace },
): Promise<BlogPostEntry | null> {
  const posts = await getBlogPosts(env);
  return posts.find((p) => p.slug === slug && p.locale === locale) || null;
}

export function clearBlogCache(): void {
  _blogCache = null;
  _blogCacheTime = 0;
}
