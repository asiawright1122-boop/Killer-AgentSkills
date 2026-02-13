import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LoaderContext } from 'astro/loaders';

// Define the schema for a skill
const skillSchema = z.object({
    id: z.string().optional(),
    skillId: z.string().optional(),
    name: z.string(),
    repoPath: z.string(),
    repo: z.string().optional(),
    owner: z.string(),
    description: z.string().or(z.record(z.string())).optional(),
    stars: z.number().default(0),
    forks: z.number().default(0),
    language: z.string().optional(),
    topics: z.array(z.string()).default([]),
    updatedAt: z.string().optional(),
    avatarUrl: z.string().optional(),
    homepage: z.string().optional().nullable(),
    license: z.string().optional().nullable(),
    // Add other fields as needed based on UnifiedSkill
}).passthrough(); // Allow extra fields for now

// Custom loader to read the local JSON file
const skillsLoader = {
    name: "skills-json-loader",
    load: async ({ store, logger, parseData }: LoaderContext) => {
        logger.info("Loading skills from data/skills-cache.json");

        try {
            const filePath = path.resolve('./data/skills-cache.json');
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            const skillsStart = data.skills; // Access the array property

            logger.info(`Found ${skillsStart.length} skills`);

            for (const skill of skillsStart) {
                // Determine ID (owner/repo)
                const id = skill.skillId || `${skill.owner}/${skill.repo}`;

                // Parse and validate data
                // We skip parseData for speed if we trust the JSON, but using it validates schema
                // For 10k items, manual store.set is faster than parseData for each if we are careful.
                // But let's use validations.

                store.set({
                    id,
                    data: skill,
                    rendered: { html: "" } // No markdown content yet
                });
            }
        } catch (error) {
            logger.error(`Error loading skills: ${(error as any).message}`);
        }
    }
};

const skills = defineCollection({
    loader: skillsLoader,
    schema: skillSchema
});

const blog = defineCollection({
    // Standard content collection (files in src/content/blog)
    // If using src/content.config.ts, type: 'content' still maps to src/content/collectionName
    // But wait, Astro 5 "Content Layer" recommends 'glob' loader for file system content?
    // Let's try type: 'content' first as it's legacy-compatible.
    // Actually, checking docs: src/content.config.ts requires "loader" property for ALL collections?
    // "type" is for legacy "src/content/config.ts".
    // If I use "src/content.config.ts", I should use "glob" loader for files.
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/blog" }),
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
    skills,
    blog
};
