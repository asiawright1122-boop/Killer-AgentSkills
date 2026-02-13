import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = './src/content/blog';
const LOCALES = ['zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

async function syncBlogAssetsAggressive() {
    const enDir = path.join(BLOG_DIR, 'en');
    const enFiles = await fs.readdir(enDir);

    const articleMap: Record<string, { heroImage: string, blogLinks: string[] }> = {};

    console.log('--- Phase 1: Extracting Source of Truth (English) ---');
    for (const file of enFiles) {
        if (!file.endsWith('.md')) continue;

        const content = await fs.readFile(path.join(enDir, file), 'utf-8');

        // Extract heroImage
        const heroImageMatch = content.match(/heroImage: "(.*?)"/);
        const heroImage = heroImageMatch ? heroImageMatch[1] : '';

        // Extract ordered list of internal blog slugs
        // Match both relative and absolute links to /blog/
        // Pattern: [text](.../blog/[slug])
        const blogLinks: string[] = [];
        const linkRegex = /\[.*?\]\(https:\/\/killer-skills\.com\/en\/blog\/([a-zA-Z0-9\-_]+)\)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            blogLinks.push(match[1]);
        }

        articleMap[file] = { heroImage, blogLinks };
        console.log(`Audited ${file}: Image=${heroImage.substring(0, 40)}..., Links=[${blogLinks.join(', ')}]`);
    }

    console.log('\n--- Phase 2: Aggressive Synchronization ---');
    for (const locale of LOCALES) {
        console.log(`\nProcessing locale: [${locale}]`);
        const localeDir = path.join(BLOG_DIR, locale);

        try {
            const files = await fs.readdir(localeDir);
            for (const file of files) {
                if (!file.endsWith('.md')) continue;
                const baseline = articleMap[file];
                if (!baseline) continue;

                let content = await fs.readFile(path.join(localeDir, file), 'utf-8');
                let updated = false;

                // 1. Force Sync heroImage
                const currentHeroMatch = content.match(/heroImage: "(.*?)"/);
                if (currentHeroMatch && currentHeroMatch[1] !== baseline.heroImage) {
                    content = content.replace(/heroImage: ".*?"/, `heroImage: "${baseline.heroImage}"`);
                    updated = true;
                    console.log(`  - Fixed heroImage for ${file}`);
                } else if (!currentHeroMatch && baseline.heroImage) {
                    // If heroImage is missing in frontmatter (unlikely but safe)
                    content = content.replace(/(description: ".*?")/, `$1\nheroImage: "${baseline.heroImage}"`);
                    updated = true;
                    console.log(`  - Added missing heroImage for ${file}`);
                }

                // 2. Positional Link Replacement
                // This regex matches ANY internal blog link regardless of locale prefix
                const universalLinkRegex = /\[(.*?)\]\(https:\/\/killer-skills\.com\/(?:en|[a-z]{2})\/blog\/([a-zA-Z0-9\-_]+)\)/g;

                let linkIndex = 0;
                const newContent = content.replace(universalLinkRegex, (match, text, oldSlug) => {
                    const correctSlug = baseline.blogLinks[linkIndex];
                    linkIndex++;

                    if (correctSlug) {
                        const localizedLink = `[${text}](https://killer-skills.com/${locale}/blog/${correctSlug})`;
                        if (match !== localizedLink) {
                            updated = true;
                            return localizedLink;
                        }
                    }
                    return match;
                });

                content = newContent;

                if (updated) {
                    await fs.writeFile(path.join(localeDir, file), content, 'utf-8');
                    console.log(`  - Synced assets and links for ${file}`);
                }
            }
        } catch (err) {
            console.error(`  [ERROR] Failed locale ${locale}:`, err);
        }
    }

    console.log('\n--- Aggressive Synchronization Complete ---');
}

syncBlogAssetsAggressive().catch(console.error);
