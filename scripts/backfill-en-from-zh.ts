#!/usr/bin/env npx tsx
/**
 * Backfill EN from ZH
 * 
 * Scans src/content/blog/zh/ for posts that do NOT exist in src/content/blog/en/.
 * Translates them to English so that the normal EN→all flow can pick them up.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './lib/ai';
import { robustParseJSON } from './lib/utils';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const ZH_DIR = path.join(BLOG_DIR, 'zh');
const EN_DIR = path.join(BLOG_DIR, 'en');

const aiService = new AIService();

function parseMarkdown(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: '', body: content };
    return { frontmatter: match[1], body: match[2] };
}

async function translateChunk(chunk: string): Promise<string> {
    const prompt = `You are a professional technical translator and SEO expert. 
Translate the following Markdown content from Chinese to English.

## Rules:
1. **Preserve Markdown**: Keep all headers, bullets, code blocks, links, and formatting exactly as is.
2. **Translate Text**: Only translate the human-readable text. Do NOT translate code blocks, file paths, or technical terms that should remain in English (e.g., "React", "API", "JSON", "Killer-Skills", "OpenClaw").
3. **SEO Optimization**: Use natural, search-friendly phrasing in English.
4. **Internal Links**: Keep link paths identical (we will fix them programmatically).
5. **Images**: Keep image syntax \`![alt](url)\` but translate the alt text.
6. **No Fluff**: Do not add introductory text. Return ONLY the translated Markdown.

## Content to Translate:
${chunk}`;

    const result = await aiService.callAI(prompt, false);
    if (!result) {
        throw new Error('AI Translation failed (no response from any provider)');
    }
    return result;
}

async function translateBody(body: string): Promise<string> {
    const chunks = body.split(/(?=\n## )/);

    if (chunks.length <= 1 && body.length < 4000) {
        return await translateChunk(body);
    }

    console.log(`     📦 Article split into ${chunks.length} chunks...`);
    let translatedBody = '';
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim()) {
            process.stdout.write(`       [Chunk ${i + 1}/${chunks.length}] `);
            const translatedChunk = await translateChunk(chunk);
            translatedBody += translatedChunk + "\n";
        }
    }
    return translatedBody.trim();
}

async function translateFrontmatter(frontmatter: string): Promise<string> {
    const titleMatch = frontmatter.match(/title:\s*"(.*?)"/);
    const descMatch = frontmatter.match(/description:\s*"(.*?)"/);

    if (!titleMatch || !descMatch) return frontmatter;

    const title = titleMatch[1];
    const desc = descMatch[1];

    const prompt = `Translate these blog metadata fields from Chinese to English for SEO purposes.

IMPORTANT SEO REQUIREMENTS:
- Meta description MUST be between 120-158 characters
- Include a clear Call-to-Action (CTA) like "Learn now", "Read more", "Get started"
- Use power words: proven, essential, complete, master, discover, learn, etc.
- Front-load keywords for better visibility

Return valid JSON only: { "title": "...", "description": "..." }

Original Title: "${title}"
Original Description: "${desc}" (currently ${desc.length} characters)`;

    const result = await aiService.callAI(prompt, true);
    let newTitle = title;
    let newDesc = desc;

    if (result) {
        try {
            const parsed = robustParseJSON(result);
            if (parsed && typeof parsed === 'object') {
                if (parsed.title) newTitle = parsed.title;
                if (parsed.description) newDesc = parsed.description;
            }
        } catch (e) {
            console.error('⚠️ Failed to parse frontmatter translation JSON, using original.', e);
        }
    }

    // Post-process: Ensure description meets SEO length requirements (120-158 for English)
    const minLen = 120;
    const maxLen = 158;
    
    // If too long, truncate with "..."
    if (newDesc.length > maxLen) {
        console.log(`     ⚠️ Description too long (${newDesc.length} chars), truncating to ${maxLen}...`);
        newDesc = newDesc.slice(0, maxLen - 3).trim() + '...';
    }
    
    // If too short, keep original Chinese description as fallback
    if (newDesc.length < minLen) {
        console.log(`     ⚠️ Description too short (${newDesc.length} chars, min: ${minLen}), keeping original`);
        if (desc.length >= minLen) {
            newDesc = desc;
            console.log(`     💡 Using Chinese description as fallback (${desc.length} chars)`);
        }
    }

    let newFrontmatter = frontmatter
        .replace(/title:\s*".*?"/, `title: "${newTitle}"`)
        .replace(/description:\s*".*?"/, `description: "${newDesc}"`)
        .replace(/lang:\s*"zh"/, `lang: "en"`);

    return newFrontmatter;
}

async function main() {
    console.log('🔄 Backfill: Checking for zh-only blog posts...');

    if (!fs.existsSync(ZH_DIR)) {
        console.log('ℹ️ No zh blog directory found, skipping.');
        return;
    }

    const zhFiles = fs.readdirSync(ZH_DIR).filter(f => f.endsWith('.md'));
    let backfilled = 0;

    for (const file of zhFiles) {
        const enPath = path.join(EN_DIR, file);

        if (fs.existsSync(enPath)) {
            continue; // Already has an English version
        }

        console.log(`\n📄 Found zh-only post: ${file}`);

        const zhContent = fs.readFileSync(path.join(ZH_DIR, file), 'utf-8');
        const { frontmatter, body } = parseMarkdown(zhContent);

        try {
            // Translate frontmatter
            const newFrontmatter = await translateFrontmatter(frontmatter);

            // Translate body
            const newBody = await translateBody(body);

            // Post-processing: fix internal links
            const enBody = newBody
                .replace(/\/zh\/blog\//g, '/en/blog/')
                .replace(/https:\/\/killer-skills\.com\/zh\//g, 'https://killer-skills.com/en/');

            // Write English version
            if (!fs.existsSync(EN_DIR)) fs.mkdirSync(EN_DIR, { recursive: true });
            const newContent = `---\n${newFrontmatter}\n---\n${enBody}`;
            fs.writeFileSync(enPath, newContent);
            console.log(`  ✅ Backfilled to ${enPath}`);
            backfilled++;
        } catch (error) {
            console.error(`  ❌ Failed to backfill ${file}:`, error);
        }
    }

    if (backfilled === 0) {
        console.log('✅ No zh-only posts found. All posts already have English versions.');
    } else {
        console.log(`\n🎉 Backfilled ${backfilled} post(s) from zh to en.`);
    }
}

main().catch(console.error);
