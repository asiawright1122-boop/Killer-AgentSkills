#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './lib/ai';
import { SUPPORTED_LOCALES } from './lib/constants';

// CLI Args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_SLUG = args.find(arg => arg.startsWith('--slug='))?.split('=')[1];

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const EN_DIR = path.join(BLOG_DIR, 'en');

const aiService = new AIService();

// Helper to reliably split frontmatter and body
function parseMarkdown(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: '', body: content };
    return { frontmatter: match[1], body: match[2] };
}

// Helper to escape special chars for regex
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function translateBlogBody(body: string, targetLang: string): Promise<string> {
    // Strategy: Split by H2 headers to avoid context window limits
    // But for now, let's try a single pass for typical blog posts (< 2000 tokens)
    // If it's too long, we might need chunking. 

    // Simple chunking by H2 if body is very long (> 4000 chars)
    if (body.length > 15000) {
        console.warn('⚠️ Article is very long, translation might be truncated. Consider implementing chunking.');
    }

    const prompt = `You are a professional technical translator and SEO expert. 
Translate the following Markdown blog post from English to ${targetLang}.

## Rules:
1. **Preserve Markdown**: Keep all headers, bullets, code blocks, links, and formatting exactly as is.
2. **Translate Text**: Only translate the human-readable text. Do NOT translate code blocks, file paths, or technical terms that should remain in English (e.g., "React", "API", "JSON").
3. **SEO Optimization**: Use natural, search-friendly phrasing in ${targetLang}.
4. **Internal Links**: Keep link paths identical for now (we will fix them programmatically).
5. **Images**: Keep image syntax \`![alt](url)\` but translate the alt text.
6. **No Fluff**: Do not add introductory text. Return ONLY the translated Markdown.

## Original Content:
${body}`;

    // Use AI Service (race strategy)
    // We request a longer token limit for blog posts
    const result = await aiService.callAI(prompt, false);
    return result || body; // Fallback to original if failed
}

async function translateFrontmatter(frontmatter: string, targetLang: string): Promise<string> {
    // Simple key-value translation for title and description
    const titleMatch = frontmatter.match(/title:\s*"(.*?)"/);
    const descMatch = frontmatter.match(/description:\s*"(.*?)"/);

    if (!titleMatch || !descMatch) return frontmatter;

    const title = titleMatch[1];
    const desc = descMatch[1];

    const prompt = `Translate these blog metadata fields to ${targetLang} for SEO purposes.
Return valid JSON only: { "title": "...", "description": "..." }

Original Title: "${title}"
Original Description: "${desc}"`;

    const result = await aiService.callAI(prompt, true);
    let newTitle = title;
    let newDesc = desc;

    if (result) {
        try {
            // Loose JSON parsing
            const cleanJson = result.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.title) newTitle = parsed.title;
            if (parsed.description) newDesc = parsed.description;
        } catch (e) {
            console.error('Failed to parse frontmatter translation JSON', e);
        }
    }

    // Reconstruct frontmatter
    let newFrontmatter = frontmatter
        .replace(/title:\s*".*?"/, `title: "${newTitle}"`)
        .replace(/description:\s*".*?"/, `description: "${newDesc}"`)
        .replace(/lang:\s*"en"/, `lang: "${targetLang}"`);

    return newFrontmatter;
}

async function main() {
    console.log('🚀 Starting Blog Translation Workflow...');
    if (DRY_RUN) console.log('👀 DRY RUN MODE: No files will be written.');
    if (SPECIFIC_SLUG) console.log(`Tiargeting single slug: ${SPECIFIC_SLUG}`);

    // 1. Get English posts
    const enFiles = fs.readdirSync(EN_DIR).filter(f => f.endsWith('.md'));

    for (const file of enFiles) {
        const slug = file.replace('.md', '');

        if (SPECIFIC_SLUG && slug !== SPECIFIC_SLUG) continue;

        console.log(`\n📄 Processing: ${slug}`);

        // Read English content
        const enPath = path.join(EN_DIR, file);
        const content = fs.readFileSync(enPath, 'utf-8');
        const { frontmatter, body } = parseMarkdown(content);

        // 2. Iterate locales
        for (const locale of SUPPORTED_LOCALES) {
            const targetDir = path.join(BLOG_DIR, locale);
            const targetPath = path.join(targetDir, file);

            // Create dir if missing
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            // Skip if exists (Incremental build)
            if (fs.existsSync(targetPath) && !process.env.FORCE_TRANSLATE) {
                // console.log(`  ✅ ${locale}: Already exists. Skipping.`);
                continue;
            }

            console.log(`  🌍 Translating to ${locale}...`);

            if (DRY_RUN) {
                console.log(`     [Dry Run] Would translate and write to ${targetPath}`);
                continue;
            }

            // 3. Translate
            try {
                // Frontmatter
                const newFrontmatter = await translateFrontmatter(frontmatter, locale);

                // Body
                const newBody = await translateBlogBody(body, locale);

                // 4. Post-processing: Internal Links
                // Replace /en/blog/ with /{locale}/blog/
                // Also handles relative links like (./other-post) if any, but usually we use absolute paths in Astro content
                const locBody = newBody
                    .replace(/\/en\/blog\//g, `/${locale}/blog/`)
                    .replace(/https:\/\/killer-skills\.com\/en\//g, `https://killer-skills.com/${locale}/`);

                // 5. Write file
                const newContent = `---\n${newFrontmatter}\n---\n${locBody}`;
                fs.writeFileSync(targetPath, newContent);
                console.log(`     ✅ Written to ${targetPath}`);

            } catch (error) {
                console.error(`     ❌ Failed to translate to ${locale}:`, error);
            }
        }
    }

    console.log('\n✨ Blog translation complete!');
    if (!DRY_RUN) {
        console.log('👉 Next: Run `npx tsx scripts/sync-blog-everything.ts` to sync metadata and images.');
    }
}

main().catch(console.error);
