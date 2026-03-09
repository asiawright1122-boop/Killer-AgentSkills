import fs from 'fs';
import path from 'path';
import { AIService } from './lib/ai';
import { robustParseJSON, pLimit } from './lib/utils';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aiService = new AIService();
const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const EN_DIR = path.join(BLOG_DIR, 'en');

function parseMarkdown(content: string) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) return { frontmatter: '', body: content };
    const frontmatter = match[0];
    const body = content.slice(frontmatter.length).trim();
    return { frontmatter, body };
}

async function fixFrontmatter() {
    console.log('🚀 Starting Frontmatter Fix Workflow (Strict Translation Force-Run)...');

    const enFiles = fs.readdirSync(EN_DIR).filter(f => f.endsWith('.md'));
    const locales = fs.readdirSync(BLOG_DIR).filter(d => fs.statSync(path.join(BLOG_DIR, d)).isDirectory() && d !== 'en');
    const limit = pLimit(10); // Run up to 10 concurrent AI requests
    const tasks: Promise<void>[] = [];

    for (const file of enFiles) {
        const enPath = path.join(EN_DIR, file);
        const enContent = fs.readFileSync(enPath, 'utf-8');
        const enTitleMatch = enContent.match(/title:\s*"(.*?)"/);
        const enDescMatch = enContent.match(/description:\s*"(.*?)"/);

        if (!enTitleMatch || !enDescMatch) continue;
        const enTitle = enTitleMatch[1];
        const enDesc = enDescMatch[1];

        for (const locale of locales) {
            const targetPath = path.join(BLOG_DIR, locale, file);
            if (!fs.existsSync(targetPath)) continue;

            tasks.push(limit(async () => {
                const locContent = fs.readFileSync(targetPath, 'utf-8');
                const locTitleMatch = locContent.match(/title:\s*"(.*?)"/);
                const locDescMatch = locContent.match(/description:\s*"(.*?)"/);

                // FORCE RETRANSLATE IF:
                // 1. Title is identical to english (wasn't translated)
                // 2. Title length is suspiciously short (< 40% of english length AND english length > 15)
                // 3. Description is suspiciously short
                let needsFix = false;
                if (!locTitleMatch || !locDescMatch) {
                    needsFix = true;
                } else {
                    const locTitle = locTitleMatch[1];
                    const locDesc = locDescMatch[1];
                    if (locTitle === enTitle) needsFix = true;
                    if (enTitle.length > 15 && locTitle.length < Math.max(8, enTitle.length * 0.4)) needsFix = true;
                    if (enDesc.length > 15 && locDesc.length < Math.max(12, enDesc.length * 0.4)) needsFix = true;
                }

                if (!needsFix) return;

                console.log(`  🌍 Translating Frontmatter: ${locale}/${file}`);

                const prompt = `You are a professional technical translator and strict SEO expert.
Translate the following ONE blog post's title and description from English to ${locale}.

IMPORTANT SEO REQUIREMENTS:
- Meta description MUST be between 40-200 characters (for CJK) or 120-158 characters (for Latin-based languages)
- Include a clear Call-to-Action (CTA) like "Learn now", "Read more", "Get started"
- Use power words: proven, essential, complete, master, discover, learn, etc.

## Rules:
1. Translate word-for-word accurately. DO NOT summarize. DO NOT extract keywords.
2. The translated text must have a similar length to the original English text.
3. Keep technical terms like "AI", "PDF", "Claude", "Cursor", "Windsurf" intact.
4. Output MUST be ONLY valid JSON matching this schema: { "title": "...", "description": "..." }

Original Title: "${enTitle}"
Original Description: "${enDesc}" (${enDesc.length} characters)`;

                try {
                    const result = await aiService.callAI(prompt, true);
                    let newTitle = enTitle;
                    let newDesc = enDesc;

                    if (result) {
                        const parsed = robustParseJSON(result);
                        if (parsed && typeof parsed === 'object') {
                            if (parsed.title) newTitle = parsed.title;
                            if (parsed.description) newDesc = parsed.description;
                        }
                    }

                    // Determine character limits based on language
                    const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff]/.test(locale);
                    const minLen = isCJK ? 40 : 120;
                    const maxLen = isCJK ? 200 : 158;
                    
                    // Post-process: Ensure description meets SEO length requirements
                    if (newDesc.length > maxLen) {
                        console.log(`     ⚠️ Description too long (${newDesc.length} chars), truncating...`);
                        newDesc = newDesc.slice(0, maxLen - 3).trim() + '...';
                    }
                    
                    if (newDesc.length < minLen) {
                        console.log(`     ⚠️ Description too short (${newDesc.length} chars), using original`);
                        newDesc = enDesc; // Fallback to English
                    }

                    if (newTitle !== enTitle) {
                        const { frontmatter, body } = parseMarkdown(locContent);
                        const newFrontmatter = frontmatter
                            .replace(/title:\s*".*?"/, `title: "${newTitle.replace(/"/g, '\\"')}"`)
                            .replace(/description:\s*".*?"/, `description: "${newDesc.replace(/"/g, '\\"')}"`);

                        fs.writeFileSync(targetPath, `${newFrontmatter}\n\n${body}`);
                        console.log(`     ✅ Fixed frontmatter: ${targetPath}`);
                    } else {
                        console.error(`     ❌ Failed to translate frontmatter: ${targetPath}`);
                    }
                } catch (e) {
                    console.error(`     ❌ Error formatting ${targetPath}:`, e);
                }
            }));
        }
    }

    await Promise.all(tasks);
    console.log('🎉 All frontmatter fixes applied successfully.');
}

fixFrontmatter().catch(console.error);
