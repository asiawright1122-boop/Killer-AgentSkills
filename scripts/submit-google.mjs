// Submit ALL URLs from the live sitemap index to Google Indexing API
// Requires: npm install google-auth-library
// usage: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/submit-google.mjs

import { JWT } from 'google-auth-library';
import fs from 'fs';

const HOST = 'killer-skills.com';
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

async function fetchXml(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.text();
    } catch {
        return null;
    }
}

function extractLocs(xml) {
    const urls = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

async function main() {
    const authPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!authPath || !fs.existsSync(authPath)) {
        console.error('❌ Error: GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to a service account JSON is required.');
        process.exit(1);
    }

    const key = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const client = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    console.log(`🚀 Starting Google Indexing submission for ${HOST}...`);

    let indexXml = await fetchXml(SITEMAP_URL);
    if (!indexXml) {
        console.error('❌ Failed to fetch sitemap index.');
        return;
    }

    const allUrls = new Set();
    const isSitemapIndex = indexXml.includes('<sitemapindex');

    if (isSitemapIndex) {
        const subSitemapUrls = extractLocs(indexXml);
        for (const subUrl of subSitemapUrls) {
            console.log(`📥 Fetching ${subUrl}...`);
            const subXml = await fetchXml(subUrl);
            if (!subXml) continue;
            extractLocs(subXml).forEach(u => allUrls.add(u));
        }
    } else {
        extractLocs(indexXml).forEach(u => allUrls.add(u));
    }

    const urlList = [...allUrls];
    console.log(`\n🔗 Total unique URLs to submit to Google: ${urlList.length}\n`);

    // Google Indexing API has a quota (typically 200/day).
    // Use for most important pages first if list is long.
    for (const url of urlList) {
        console.log(`📡 Submitting: ${url}`);
        try {
            const _res = await client.request({
                url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
                method: 'POST',
                data: {
                    url: url,
                    type: 'URL_UPDATED',
                },
            });
            console.log(`   ✅ Success`);
        } catch (err) {
            if (err.response?.status === 429) {
                console.error('❌ Error: Quota exceeded (429). Google Indexing API typically allows 200 requests/day.');
                break;
            }
            console.error(`   ❌ Failed: ${err.message}`);
        }
    }
    console.log('\n🎉 Google submission complete!');
}

main().catch(console.error);
