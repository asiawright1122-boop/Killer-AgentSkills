import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// NOTE: The 'skills' content collection has been REMOVED.
// Loading 84MB of skills-cache.json via Astro Content Layer caused the
// Cloudflare Worker bundle to exceed the 3MiB free-tier size limit.
// All skill data is now loaded at runtime from D1/KV via src/lib/skills.ts.
//
// NOTE: The 'collections' content collection has been REMOVED.
// Collections JSON files are now loaded at runtime from KV via
// src/lib/collections-runtime.ts to avoid bloating the Worker bundle.

const blog = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/i, '').replaceAll('\\', '/'),
  }),
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

export const collections = {
  blog,
};
