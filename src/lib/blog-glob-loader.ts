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

/**
 * Get static paths for blog post pages.
 * Must be called from getStaticPaths() in a prerendered .astro page.
 */
export async function getBlogPostPaths(): Promise<Array<{ params: { locale: string; slug: string } }>> {
  const allPosts = await loadBlogPosts();
  return allPosts
    .filter((p) => !p.data.draft)
    .map((p) => ({
      params: {
        locale: p.data.lang || 'en',
        slug: p.id
          .split('/')
          .slice(1)
          .join('/')
          .replace(/\.(md|mdx)$/i, ''),
      },
    }));
}

/**
 * Load all blog posts via dynamic glob.
 * The glob pattern ensures only markdown files in the blog directory are matched.
 */
async function loadBlogPosts(): Promise<BlogGlobEntry[]> {
  try {
    // Astro.glob is only available in .astro files at build time
    // Use dynamic import pattern that Astro can resolve
    const posts = import.meta.glob<BlogGlobEntry>('/src/content/blog/**/*.{md,mdx}', { eager: false });
    const entries: BlogGlobEntry[] = [];

    for (const [path, loader] of Object.entries(posts)) {
      if (typeof loader !== 'function') continue;
      try {
        const post = await loader();
        // Derive id from path: /src/content/blog/{locale}/{slug}.md -> {locale}/{slug}
        const match = path.match(/\/src\/content\/blog\/(.+)\.(md|mdx)$/);
        if (match) {
          entries.push({
            ...post,
            id: match[1],
          });
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
    // Astro.glob is available in .astro context
    const allPostsRaw = (Astro as any).glob('/src/content/blog/**/*.{md,mdx}');
    const allPosts = await allPostsRaw;

    // Find the target post
    const targetId = `${locale}/${slug}`;
    const post = allPosts.find(
      (p: any) => p.id === targetId || p.file?.endsWith?.(`${targetId}.md`) || p.file?.endsWith?.(`${targetId}.mdx`),
    );

    if (!post) {
      return { post: null, Content: null, headings: [], availableBlogLocales: [] };
    }

    const { Content, headings } = await post.render();

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
