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
            console.log(`[DEBUG] skills-cache.json start: ${fileContent.substring(0, 100)}...`);

            let data;
            if (fileContent.startsWith('version https://git-lfs.github.com/spec/v1')) {
                throw new Error('Detected Git LFS pointer file instead of actual JSON. Please run "git lfs pull" manually to download the real file.');
            } else {
                data = JSON.parse(fileContent);
            }
            let skillsStart = [];

            if (Array.isArray(data)) {
                skillsStart = data;
            } else if (data && Array.isArray(data.skills)) {
                skillsStart = data.skills;
            } else if (data && data.version) {
                // It's likely the cached object with version
                if (Array.isArray(data.skills)) {
                    skillsStart = data.skills;
                } else {
                    console.warn('[WARN] Found version but no skills array:', data);
                }
            } else {
                throw new Error(`Invalid skills cache format. Expected array or object with 'skills' array. Found type: ${typeof data}`);
            }

            logger.info(`Found ${skillsStart.length} skills`);

            for (const skill of skillsStart) {
                try {
                    // Determine ID (owner/repo)
                    const id = skill.skillId || `${skill.owner}/${skill.repo}`;

                    // Strip large fields to reduce worker bundle size.
                    const slimSkill = { ...skill };
                    if (slimSkill.skillMd) {
                        slimSkill.skillMd = { ...slimSkill.skillMd };
                        delete slimSkill.skillMd.body;
                    }

                    store.set({
                        id,
                        data: slimSkill,
                        rendered: { html: "" } // No markdown content yet
                    });
                } catch (err) {
                    console.error(`[ERROR] Failed to process skill: ${JSON.stringify(skill).substring(0, 100)}...`, err);
                }
            }
        } catch (error) {
            logger.error(`Error loading skills: ${(error as any).message}`);
            if ((error as any).name === 'ZodError') {
                console.error('Zod Validation Errors:', JSON.stringify((error as any).issues, null, 2));
            }
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
