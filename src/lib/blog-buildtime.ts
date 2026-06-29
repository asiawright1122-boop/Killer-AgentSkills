/**
 * Blog build-time loader.
 *
 * Reads blog markdown files at build time and provides metadata + rendered HTML.
 * This prevents the Content Layer from inlining all blog body content (~3 MiB)
 * into the Worker bundle.
 *
 * NOTE: This module uses Node.js built-in modules (fs, path) and is ONLY safe
 * to import at build time (prerendering). Do NOT import in SSR pages.
 * The Node.js imports are done lazily inside functions to avoid static analysis
 * by the bundler when this module is imported by SSR pages.
 */

import { SUPPORTED_LOCALES, type Locale } from '../i18n';

// Type for blog post frontmatter
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

// Type for processed blog post
export interface ProcessedBlogPost {
  id: string;
  slug: string;
  locale: Locale;
  data: BlogPostData;
  body: string; // raw markdown body
  content: string; // rendered HTML
  headings: Array<{ depth: number; text: string; slug: string }>;
}

// Lazy-loaded Node.js modules - only available at build time (prerendering)
async function getNodeFs() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  return { fs, path, fileURLToPath };
}

function parseFrontmatter(content: string): { data: Partial<BlogPostData>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { data: {}, body: content };
  }

  const frontmatter = match[1];
  const body = content.slice(match[0].length).trim();
  const data: Partial<BlogPostData> = {
    title: '',
    description: '',
    pubDate: new Date(),
    author: 'Killer-Skills Team',
    tags: [],
    draft: false,
    lang: 'en',
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

  return { data, body };
}

function extractHeadings(body: string): Array<{ depth: number; text: string; slug: string }> {
  const headings: Array<{ depth: number; text: string; slug: string }> = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      headings.push({ depth, text, slug });
    }
  }

  return headings;
}

function renderMarkdown(body: string): string {
  // Simple markdown to HTML conversion for build-time sitemap generation
  // This doesn't need to be perfect, just good enough for sitemap
  return body
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>');
}

let _blogCache: ProcessedBlogPost[] | null = null;

export async function loadAllBlogPosts(): Promise<ProcessedBlogPost[]> {
  if (_blogCache) return _blogCache;

  const { fs, path, fileURLToPath } = await getNodeFs();

  // Use import.meta.url if available (Node.js), fallback to process.cwd() for Cloudflare Pages
  const baseUrl = import.meta.url || `file://${process.cwd()}/`;
  const __filename = fileURLToPath(baseUrl);
  const __dirname = path.dirname(__filename);
  const BLOG_DIR = path.resolve(__dirname, '../../content/blog');

  const posts: ProcessedBlogPost[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    const localeDir = path.join(BLOG_DIR, locale);
    if (!fs.statSync(localeDir, { throwIfNoEntry: false })?.isDirectory()) continue;

    const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, body } = parseFrontmatter(content);
      const slug = file.replace(/\.(md|mdx)$/i, '');

      if (data.draft) continue;

      const headings = extractHeadings(body);
      const renderedContent = renderMarkdown(body);

      posts.push({
        id: `${locale}/${slug}`,
        slug,
        locale,
        data: {
          title: data.title || slug,
          description: data.description || '',
          pubDate: data.pubDate || new Date(),
          updatedDate: data.updatedDate,
          author: data.author || 'Killer-Skills Team',
          heroImage: data.heroImage,
          tags: data.tags || [],
          draft: data.draft || false,
          lang: data.lang || locale,
          featured: data.featured || false,
          category: data.category,
        },
        body,
        content: renderedContent,
        headings,
      });
    }
  }

  _blogCache = posts;
  return posts;
}

export async function getBlogPost(slug: string, locale: Locale): Promise<ProcessedBlogPost | null> {
  const posts = await loadAllBlogPosts();
  return posts.find((p) => p.slug === slug && p.locale === locale) || null;
}

export async function getBlogPostsByLocale(locale: Locale, includeDrafts = false): Promise<ProcessedBlogPost[]> {
  const posts = await loadAllBlogPosts();
  return posts.filter((p) => p.locale === locale && (includeDrafts || !p.data.draft));
}

export async function getAllBlogPosts(includeDrafts = false): Promise<ProcessedBlogPost[]> {
  const posts = await loadAllBlogPosts();
  return includeDrafts ? posts : posts.filter((p) => !p.data.draft);
}

export function clearBlogCache(): void {
  _blogCache = null;
}
