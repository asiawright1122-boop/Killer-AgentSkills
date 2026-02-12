import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import fs from 'node:fs/promises';
import path from 'node:path';

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
    load: async ({ store, logger, parseData }) => {
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
            logger.error(`Error loading skills: ${error.message}`);
        }
    }
};

const skills = defineCollection({
    loader: skillsLoader,
    schema: skillSchema
});

export const collections = {
    skills
};
