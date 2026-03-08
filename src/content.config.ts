import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// NOTE: The 'skills' content collection has been REMOVED.
// Loading 84MB of skills-cache.json via Astro Content Layer caused the
// Cloudflare Worker bundle to exceed the 3MiB free-tier size limit.
// All skill data is now loaded at runtime from D1/KV via src/lib/skills.ts.

const blog = defineCollection({
  // Standard content collection (files in src/content/blog)
  // If using src/content.config.ts, type: 'content' still maps to src/content/collectionName
  // But wait, Astro 5 "Content Layer" recommends 'glob' loader for file system content?
  // Let's try type: 'content' first as it's legacy-compatible.
  // Actually, checking docs: src/content.config.ts requires "loader" property for ALL collections?
  // "type" is for legacy "src/content/config.ts".
  // If I use "src/content.config.ts", I should use "glob" loader for files.
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Killer-Skills Team'),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.string().default('en'),
    featured: z.boolean().default(false),
    category: z.string().optional(),
  }),
});

const collectionsCol = defineCollection({
  loader: glob({ pattern: '**/[^_]*.json', base: './src/content/collections' }),
  schema: z.object({
    title: z.record(z.string()),
    description: z.record(z.string()),
    seoTitle: z.record(z.string()).optional(),
    seoDescription: z.record(z.string()).optional(),
    keywords: z.record(z.array(z.string())).optional(),
    skills: z.array(z.string()),
    author: z.string().default('Killer-Skills Team'),
    featured: z.boolean().default(false),
    category: z.string().optional(),
  }),
});

export const collections = {
  blog,
  collections: collectionsCol,
};
