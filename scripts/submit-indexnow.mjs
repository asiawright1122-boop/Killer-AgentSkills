// Submit ALL URLs from the live sitemap index + sub-sitemaps to IndexNow
// Recursively fetches sub-sitemaps referenced in the sitemap index

const HOST = 'killer-skills.com';
const KEY = '89cc8ad09dc64e58b25ccb5632573e78';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const BATCH_SIZE = 2000;
const ENDPOINTS = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://yandex.com/indexnow',
    'https://search.seznam.cz/indexnow',
    'https://searchadvisor.naver.com/indexnow',
    'https://indexnow.yep.com/indexnow'
];
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

async function fetchXml(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; IndexNowBot/1.0)',
                'Accept': 'application/xml, text/xml, */*',
            },
        });
        if (!res.ok) {
            console.error(`❌ Failed to fetch ${url}: ${res.status}`);
            return null;
        }
        return res.text();
    } catch (err) {
        console.error(`❌ Network error fetching ${url}: ${err.message}`);
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

function extractHrefs(xml) {
    const hrefs = new Set();
    const hrefRegex = /href="(https:\/\/killer-skills\.com[^"]*)"/g;
    let match;
    while ((match = hrefRegex.exec(xml)) !== null) {
        hrefs.add(match[1]);
    }
    return hrefs;
}

async function main() {
    console.log(`🚀 Starting IndexNow submission for ${HOST}...`);
    console.log(`📥 Fetching sitemap index from ${SITEMAP_URL}...\n`);

    // 1. Fetch the sitemap index
    let indexXml = await fetchXml(SITEMAP_URL);

    // Fallback: try reading from local dist if live fetch fails (e.g. Cloudflare 403 in CI)
    if (!indexXml) {
        const localPath = './dist/sitemap.xml';
        const { existsSync, readFileSync } = await import('fs');
        if (existsSync(localPath)) {
            console.log(`📂 Falling back to local sitemap: ${localPath}`);
            indexXml = readFileSync(localPath, 'utf-8');
        } else {
            console.log('⚠️ Could not fetch sitemap and no local fallback found. Skipping IndexNow.');
            process.exit(0); // Non-critical, exit gracefully
        }
    }

    // 2. Check if it's a sitemap index (contains <sitemapindex>)
    const isSitemapIndex = indexXml.includes('<sitemapindex');
    const allUrls = new Set();

    if (isSitemapIndex) {
        // Extract sub-sitemap URLs
        const subSitemapUrls = extractLocs(indexXml);
        console.log(`📑 Found ${subSitemapUrls.length} sub-sitemaps:`);
        subSitemapUrls.forEach(u => console.log(`   → ${u}`));
        console.log('');

        // 3. Fetch each sub-sitemap and extract URLs
        for (const subUrl of subSitemapUrls) {
            console.log(`📥 Fetching ${subUrl}...`);
            const subXml = await fetchXml(subUrl);
            if (!subXml) continue;

            const locs = extractLocs(subXml);
            const hrefs = extractHrefs(subXml);

            locs.forEach(u => allUrls.add(u));
            hrefs.forEach(u => allUrls.add(u));

            console.log(`   → ${locs.length} <loc> URLs, ${hrefs.size} hreflang URLs`);
        }
    } else {
        // Regular sitemap — extract directly
        const locs = extractLocs(indexXml);
        const hrefs = extractHrefs(indexXml);
        locs.forEach(u => allUrls.add(u));
        hrefs.forEach(u => allUrls.add(u));
    }

    const urlList = [...allUrls];
    console.log(`\n🔗 Total unique URLs to submit: ${urlList.length}\n`);

    if (urlList.length === 0) {
        console.log('⚠️ No URLs found. Exiting.');
        return;
    }

    // 4. Submit in batches
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urlList.length; i += BATCH_SIZE) {
        const batch = urlList.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(urlList.length / BATCH_SIZE);
        console.log(`📡 Submitting batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

        const payload = {
            host: HOST,
            key: KEY,
            keyLocation: KEY_LOCATION,
            urlList: batch,
        };

        for (const endpoint of ENDPOINTS) {
            console.log(`   ➡️  To: ${endpoint}`);
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    console.log(`      ✅ Success (${response.status})`);
                    successCount += batch.length;
                } else {
                    const _text = await response.text();
                    console.error(`      ❌ Failed: ${response.status} ${response.statusText}`);
                    failCount += batch.length;
                }
            } catch (error) {
                console.error(`      ❌ Network error: ${error.message}`);
                failCount += batch.length;
            }
        }
    }

    console.log(`\n🎉 IndexNow submission complete!`);
    console.log(`📊 Summary:`);
    console.log(`   ✅ Success: ${successCount} URLs`);
    if (failCount > 0) console.log(`   ❌ Failed: ${failCount} URLs`);
    console.log(`   📄 Total submitted: ${urlList.length} URLs`);
}

main().catch(console.error);
