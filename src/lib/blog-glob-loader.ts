/**
 * Blog glob loader — replaces Astro Content Layer for blog posts.
 *
 * Uses Astro.glob() to load markdown files at build time for prerendered pages.
 * This avoids the Content Layer inlining all blog body content (~5.5 MiB)
 * into the SSR Worker bundle.
 *
 * IMPORTANT: This module can only be used in .astro files (Astro.glob is
 * a build-time API). For SSR pages, use blog-runtime.ts instead.
 */

import type { Locale } from '../i18n';
import { SUPPORTED_LOCALES } from '../i18n';

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

export interface BlogGlobEntry {
  id: string;
  body: string;
  data: BlogPostData;
  render(): Promise<{ Content: any; headings: Array<{ depth: number; text: string; slug: string }> }>;
}

function normalizeBlogGlobEntry(rawPost: any, path?: string): BlogGlobEntry | null {
  const data = rawPost?.data || rawPost?.frontmatter;
  if (!data) return null;

  const pathId = path?.match(/\/src\/content\/blog\/(.+)\.(md|mdx)$/)?.[1] || '';
  const fileId =
    typeof rawPost?.file === 'string' ? rawPost.file.match(/\/src\/content\/blog\/(.+)\.(md|mdx)$/)?.[1] || '' : '';
  const rawId = typeof rawPost?.id === 'string' ? rawPost.id.replace(/\.(md|mdx)$/i, '') : '';
  const id = rawId || fileId || pathId;
  if (!id) return null;

  return {
    ...rawPost,
    id,
    data: {
      ...data,
      pubDate: data.pubDate instanceof Date ? data.pubDate : new Date(data.pubDate),
      updatedDate: data.updatedDate
        ? data.updatedDate instanceof Date
          ? data.updatedDate
          : new Date(data.updatedDate)
        : undefined,
    },
    body: rawPost?.body || '',
  } as BlogGlobEntry;
}

/**
 * Get static paths for blog post pages.
 * Must be called from getStaticPaths() in a prerendered .astro page.
 */
export async function getBlogPostPaths(): Promise<Array<{ params: { locale: string; slug: string } }>> {
  const allPosts = await loadBlogPostsFromGlob();
  const seen = new Set<string>();
  return allPosts
    .filter((p) => !p.data?.draft)
    .map((p) => {
      const locale = p.id.split('/')[0] || p.data.lang || 'en';
      const slug = p.id
        .split('/')
        .slice(1)
        .join('/')
        .replace(/\.(md|mdx)$/i, '');
      return { params: { locale, slug } };
    })
    .filter(({ params }) => {
      const key = `${params.locale}/${params.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Load all blog posts via dynamic glob.
 * The glob pattern ensures only markdown files in the blog directory are matched.
 */
export async function loadBlogPostsFromGlob(Astro?: any): Promise<BlogGlobEntry[]> {
  try {
    const posts = Astro?.glob
      ? await Astro.glob('/src/content/blog/**/*.{md,mdx}')
      : import.meta.glob<BlogGlobEntry>('/src/content/blog/**/*.{md,mdx}', { eager: false });
    const entries: BlogGlobEntry[] = [];

    if (Array.isArray(posts)) {
      return posts
        .map((post: any) => normalizeBlogGlobEntry(post))
        .filter((post): post is BlogGlobEntry => Boolean(post && !post.data?.draft));
    }

    for (const [path, loader] of Object.entries(posts)) {
      if (typeof loader !== 'function') continue;
      try {
        const post = await loader();
        // Derive id from path: /src/content/blog/{locale}/{slug}.md -> {locale}/{slug}
        const match = path.match(/\/src\/content\/blog\/(.+)\.(md|mdx)$/);
        if (match) {
          const normalized = normalizeBlogGlobEntry(post, path);
          if (normalized) entries.push(normalized);
        }
      } catch {
        // Skip files that fail to load
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Get a single blog post and its rendered content for a specific locale/slug.
 * Used by blog detail page ([...slug].astro).
 */
export async function getBlogPostFromGlob(
  locale: string,
  slug: string,
  Astro: any,
): Promise<{
  post: BlogGlobEntry | null;
  Content: any;
  headings: Array<{ depth: number; text: string; slug: string }>;
  availableBlogLocales: Locale[];
}> {
  try {
    const allPosts = await loadBlogPostsFromGlob(Astro);

    // Find the target post
    const targetId = `${locale}/${slug}`;
    const post = allPosts.find(
      (p: any) => p.id === targetId || p.file?.endsWith?.(`${targetId}.md`) || p.file?.endsWith?.(`${targetId}.mdx`),
    );

    if (!post) {
      return { post: null, Content: null, headings: [], availableBlogLocales: [] };
    }

    const postModule = post as any;
    const rendered =
      typeof postModule.render === 'function'
        ? await post.render()
        : {
            Content: postModule.Content || postModule.default,
            headings: typeof postModule.getHeadings === 'function' ? postModule.getHeadings() : [],
          };
    const { Content, headings } = rendered;

    if (!Content) {
      return { post: null, Content: null, headings: [], availableBlogLocales: [] };
    }

    // Find sibling posts for hreflang alternates
    const siblingPosts = allPosts.filter((p: any) => {
      const postId = p.id || '';
      const parts = postId.split('/');
      if (parts.length < 2) return false;
      const postSlug = parts.slice(1).join('/');
      return postSlug === slug && !p.data?.draft;
    });

    const localeCandidates = siblingPosts
      .map((p: any) => {
        const parts = (p.id || '').split('/');
        return parts[0];
      })
      .filter((candidate: string): candidate is Locale => SUPPORTED_LOCALES.includes(candidate as Locale));
    const availableBlogLocales = [...new Set<Locale>(localeCandidates)];

    return { post, Content, headings, availableBlogLocales };
  } catch (e) {
    console.error('[blog-glob-loader] Error loading blog post:', e);
    return { post: null, Content: null, headings: [], availableBlogLocales: [] };
  }
}
