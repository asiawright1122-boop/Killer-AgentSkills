import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = './src/content/blog';
const LOCALES = ['zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

interface Baseline {
    heroImage: string;
    featured: boolean;
    category: string;
    blogLinks: string[];
}

async function syncBlogEverything() {
    const enDir = path.join(BLOG_DIR, 'en');
    const enFiles = await fs.readdir(enDir);

    const articleMap: Record<string, Baseline> = {};

    console.log('--- Phase 1: Extracting Source of Truth (English) ---');
    for (const file of enFiles) {
        if (!file.endsWith('.md')) continue;

        const content = await fs.readFile(path.join(enDir, file), 'utf-8');

        const heroImageMatch = content.match(/heroImage: "(.*?)"/);
        const featuredMatch = content.match(/featured: (true|false)/);
        const categoryMatch = content.match(/category: "(.*?)"/);

        const blogLinks: string[] = [];
        const linkRegex = /\[.*?\]\(https:\/\/killer-skills\.com\/en\/blog\/([a-zA-Z0-9\-_]+)\)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            blogLinks.push(match[1]);
        }

        articleMap[file] = {
            heroImage: heroImageMatch ? heroImageMatch[1] : '',
            featured: featuredMatch ? featuredMatch[1] === 'true' : false,
            category: categoryMatch ? categoryMatch[1] : '',
            blogLinks
        };

        console.log(`Audited ${file}: Featured=${articleMap[file].featured}, Category=${articleMap[file].category}`);
    }

    console.log('\n--- Phase 2: Global Metadata & Link Sync ---');
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

                // 1. Sync heroImage
                if (content.includes('heroImage:')) {
                    const currentHero = content.match(/heroImage: "(.*?)"/)?.[1];
                    if (currentHero !== baseline.heroImage) {
                        content = content.replace(/heroImage: ".*?"/, `heroImage: "${baseline.heroImage}"`);
                        updated = true;
                    }
                }

                // 2. Sync featured
                if (content.includes('featured:')) {
                    const currentFeatured = content.match(/featured: (true|false)/)?.[1] === 'true';
                    if (currentFeatured !== baseline.featured) {
                        content = content.replace(/featured: (true|false)/, `featured: ${baseline.featured}`);
                        updated = true;
                    }
                }

                // 3. Sync category
                if (content.includes('category:')) {
                    const currentCategory = content.match(/category: "(.*?)"/)?.[1];
                    if (currentCategory !== baseline.category) {
                        content = content.replace(/category: ".*?"/, `category: "${baseline.category}"`);
                        updated = true;
                    }
                }

                // 4. Positional Link Replacement
                const universalLinkRegex = /\[(.*?)\]\(https:\/\/killer-skills\.com\/(?:en|[a-z]{2})\/blog\/([a-zA-Z0-9\-_]+)\)/g;
                let linkIndex = 0;
                content = content.replace(universalLinkRegex, (match, text, oldSlug) => {
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

                if (updated) {
                    await fs.writeFile(path.join(localeDir, file), content, 'utf-8');
                    console.log(`  - Synchronized ${file}`);
                }
            }
        } catch (err) {
            console.error(`  [ERROR] Failed locale ${locale}:`, err);
        }
    }

    console.log('\n--- Global Synchronization Complete ---');
}

syncBlogEverything().catch(console.error);
