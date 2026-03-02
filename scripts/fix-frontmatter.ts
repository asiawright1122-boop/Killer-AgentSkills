import fs from 'fs';
import path from 'path';
import { AIService } from './lib/ai';
import { robustParseJSON } from './lib/utils';
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
    console.log('🚀 Starting Frontmatter Fix Workflow...');

    const enFiles = fs.readdirSync(EN_DIR).filter(f => f.endsWith('.md'));
    const locales = fs.readdirSync(BLOG_DIR).filter(d => fs.statSync(path.join(BLOG_DIR, d)).isDirectory() && d !== 'en');

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

            const locContent = fs.readFileSync(targetPath, 'utf-8');
            const locTitleMatch = locContent.match(/title:\s*"(.*?)"/);

            // If title is already translated (not exactly english), skip it
            if (locTitleMatch && locTitleMatch[1] !== enTitle) continue;

            console.log(`  🌍 Translating Frontmatter: ${locale}/${file}`);

            const prompt = `Translate these blog metadata fields to ${locale} for SEO purposes.
Return valid JSON only: { "title": "...", "description": "..." }

Original Title: "${enTitle}"
Original Description: "${enDesc}"`;

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
        }
    }
}

fixFrontmatter().catch(console.error);
