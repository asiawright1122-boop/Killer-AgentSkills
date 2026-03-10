#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './lib/ai';
import { SUPPORTED_LOCALES } from './lib/constants';
import { robustParseJSON } from './lib/utils';

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
function _escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function translateBlogBody(body: string, targetLang: string): Promise<string> {
    // Strategy: Split by H2 headers to handle long articles without hitting response limits
    const chunks = body.split(/(?=\n## )/);

    if (chunks.length <= 1 && body.length < 4000) {
        // Short article, single pass
        return await translateChunk(body, targetLang);
    }

    console.log(`     📦 Article split into ${chunks.length} chunks for reliable translation...`);
    let translatedBody = '';
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim()) {
            process.stdout.write(`       [Chunk ${i + 1}/${chunks.length}] `);
            const translatedChunk = await translateChunk(chunk, targetLang);
            translatedBody += translatedChunk + "\n";
        }
    }
    return translatedBody.trim();
}

async function translateChunk(chunk: string, targetLang: string): Promise<string> {
    const prompt = `You are a professional technical translator and SEO expert. 
Translate the following Markdown content from English to ${targetLang}.

## Rules:
1. **Preserve Markdown**: Keep all headers, bullets, code blocks, links, and formatting exactly as is.
2. **Translate Text**: Only translate the human-readable text. Do NOT translate code blocks, file paths, or technical terms that should remain in English (e.g., "React", "API", "JSON").
3. **SEO Optimization**: Use natural, search-friendly phrasing in ${targetLang}.
4. **Internal Links**: Keep link paths identical for now (we will fix them programmatically).
5. **Images**: Keep image syntax \`![alt](url)\` but translate the alt text.
6. **No Fluff**: Do not add introductory text. Return ONLY the translated Markdown.

## Content to Translate:
${chunk}`;

    const result = await aiService.callAI(prompt, false);
    if (!result) {
        throw new Error(`AI Translation failed for chunk (no response from any provider)`);
    }
    return result;
}

async function translateFrontmatter(frontmatter: string, targetLang: string): Promise<string> {
    // Simple key-value translation for title and description
    const titleMatch = frontmatter.match(/title:\s*"(.*?)"/);
    const descMatch = frontmatter.match(/description:\s*"(.*?)"/);

    if (!titleMatch || !descMatch) return frontmatter;

    const title = titleMatch[1];
    const desc = descMatch[1];

    // Determine character limits based on language
    // CJK (Chinese, Japanese, Korean, Arabic) characters are more dense
    const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff]/.test(targetLang);
    const minLen = isCJK ? 40 : 120;
    const maxLen = isCJK ? 200 : 158;

    const prompt = `Translate these blog metadata fields to ${targetLang} for SEO purposes.

IMPORTANT SEO REQUIREMENTS:
- Meta description MUST be between ${minLen}-${maxLen} characters
- Include a clear Call-to-Action (CTA) like "Learn now", "Read more", "Get started"
- Use power words: proven, essential, complete, master, discover, learn, etc.
- Front-load keywords for better visibility

Return valid JSON only: { "title": "...", "description": "..." }

Original Title: "${title}"
Original Description: "${desc}" (currently ${desc.length} characters)`;

    const result = await aiService.callAI(prompt, true);
    let newTitle = title;
    let newDesc = desc;

    if (!result) {
        throw new Error(`AI Translation failed for metadata (no response from any provider)`);
    }

    if (result) {
        try {
            const parsed = robustParseJSON(result);
            if (parsed && typeof parsed === 'object') {
                if (parsed.title) newTitle = parsed.title;
                if (parsed.description) newDesc = parsed.description;
            }
        } catch (e) {
            console.error('⚠️ Failed to parse frontmatter translation JSON, using English fallback.', e);
        }
    }

    // Post-process: Ensure description meets SEO length requirements
    // CJK languages need different character limits
    const finalMinLen = isCJK ? 40 : 120;
    const finalMaxLen = isCJK ? 200 : 158;
    
    // If too long, truncate with "..."
    if (newDesc.length > finalMaxLen) {
        console.log(`     ⚠️ Description too long (${newDesc.length} chars), truncating to ${finalMaxLen}...`);
        newDesc = newDesc.slice(0, finalMaxLen - 3).trim() + '...';
    }
    
    // If too short, try to expand (or keep original if AI can't help)
    if (newDesc.length < finalMinLen) {
        console.log(`     ⚠️ Description too short (${newDesc.length} chars, min: ${finalMinLen}), keeping original`);
        // Don't overwrite with short translation - keep original or try to extend
        if (desc.length >= finalMinLen) {
            newDesc = desc; // Fall back to English if it's longer
            console.log(`     💡 Using English description as fallback (${desc.length} chars)`);
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

            let shouldTranslate = false;
            if (process.env.FORCE_TRANSLATE === 'true') {
                shouldTranslate = true;
            } else if (!fs.existsSync(targetPath)) {
                shouldTranslate = true;
            } else {
                const locContent = fs.readFileSync(targetPath, 'utf-8');
                const locTitleMatch = locContent.match(/title:\s*"(.*?)"/);
                const enTitleMatch = content.match(/title:\s*"(.*?)"/);
                if (locTitleMatch && enTitleMatch && locTitleMatch[1] === enTitleMatch[1]) {
                    shouldTranslate = true;
                }
            }

            if (!shouldTranslate) {
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
