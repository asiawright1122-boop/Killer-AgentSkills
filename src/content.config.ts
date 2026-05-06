import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// NOTE: The 'skills' content collection has been REMOVED.
// Loading 84MB of skills-cache.json via Astro Content Layer caused the
// Cloudflare Worker bundle to exceed the 3MiB free-tier size limit.
// All skill data is now loaded at runtime from D1/KV via src/lib/skills.ts.

const localizedText = z.record(z.string(), z.string());
const localizedTextArray = z.record(z.string(), z.array(z.string()));

const blog = defineCollection({
  // Standard content collection (files in src/content/blog)
  // If using src/content.config.ts, type: 'content' still maps to src/content/collectionName
  // But wait, Astro 5 "Content Layer" recommends 'glob' loader for file system content?
  // Let's try type: 'content' first as it's legacy-compatible.
  // Actually, checking docs: src/content.config.ts requires "loader" property for ALL collections?
  // "type" is for legacy "src/content/config.ts".
  // If I use "src/content.config.ts", I should use "glob" loader for files.
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/blog',
    // Keep locale folders in the content id so translated posts do not collide.
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/i, '').replaceAll('\\', '/'),
  }),
  schema: z.object({
    title: z.string(),
    // SEO: meta description 建议 120–158 字符，以在搜索结果中完整展示并提升 CTR。运行 npx tsx scripts/audit-blog-meta-descriptions.ts 审计过短条目。
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
    title: localizedText,
    description: localizedText,
    seoTitle: localizedText.optional(),
    seoDescription: localizedText.optional(),
    keywords: localizedTextArray.optional(),
    longDescription: localizedText.optional(),
    skills: z.array(z.string()),
    featuredSkillRefs: z.array(z.string()).optional(),
    canonicalSlug: z.string().optional(),
    legacySlugs: z.array(z.string()).optional(),
    author: z.string().default('Killer-Skills Team'),
    featured: z.boolean().default(false),
    category: z.string().optional(),
    editorial: z
      .object({
        reviewSummary: localizedText.optional(),
        selectionReason: localizedText.optional(),
        trustSignals: localizedTextArray.optional(),
        groupingLogic: localizedTextArray.optional(),
        maintenance: z
          .object({
            reviewedAt: z.string(),
            cadence: localizedText.optional(),
            maintainedBy: localizedText.optional(),
            verification: localizedText.optional(),
          })
          .optional(),
        executionExamples: z
          .array(
            z.object({
              title: localizedText,
              summary: localizedText,
              steps: localizedTextArray,
            }),
          )
          .optional(),
        decisionTracks: z
          .array(
            z.object({
              title: localizedText,
              summary: localizedText,
              whenToUse: localizedText.optional(),
              checkpoints: localizedTextArray.optional(),
              skillRefs: z.array(z.string()).optional(),
              nextStepHref: z.string().optional(),
              nextStepLabel: localizedText.optional(),
            }),
          )
          .optional(),
        nextSteps: z
          .array(
            z.object({
              href: z.string(),
              label: localizedText,
              description: localizedText,
            }),
          )
          .optional(),
      })
      .optional(),
  }),
});

export const collections = {
  blog,
  collections: collectionsCol,
};
