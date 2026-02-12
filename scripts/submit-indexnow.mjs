// Submit ALL URLs from the live sitemap.xml to IndexNow
// Does NOT deduplicate - submits every <loc> URL as found

const HOST = 'killer-skills.com';
const KEY = '89cc8ad09dc64e58b25ccb5632573e78';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const BATCH_SIZE = 2000;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

async function main() {
    console.log(`🚀 Starting IndexNow submission for ${HOST}...`);
    console.log(`📥 Fetching sitemap from ${SITEMAP_URL}...`);

    // 1. Fetch live sitemap
    const res = await fetch(SITEMAP_URL);
    if (!res.ok) {
        console.error(`❌ Failed to fetch sitemap: ${res.status}`);
        process.exit(1);
    }
    const xml = await res.text();
    console.log(`📄 Sitemap size: ${(xml.length / 1024 / 1024).toFixed(2)} MB`);

    // 2. Extract every <loc> URL (no dedup — match sitemap count)
    const urls = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
        urls.push(match[1]);
    }

    // Also collect all hreflang href URLs (these are cross-locale alternates)
    const allHrefs = new Set();
    const hrefRegex = /href="(https:\/\/killer-skills\.com[^"]*)"/g;
    while ((match = hrefRegex.exec(xml)) !== null) {
        allHrefs.add(match[1]);
    }

    // Merge: start with all <loc> URLs, plus any hreflang URLs not already in loc
    const locSet = new Set(urls);
    const extraHrefs = [...allHrefs].filter(u => !locSet.has(u));
    const allUrls = [...new Set([...urls, ...extraHrefs])];

    console.log(`🔗 <loc> URLs: ${urls.length}`);
    console.log(`🔗 hreflang href URLs: ${allHrefs.size}`);
    console.log(`🔗 Extra from hreflang: ${extraHrefs.length}`);
    console.log(`🔗 Total unique URLs to submit: ${allUrls.length}`);

    // 3. Submit in batches
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
        const batch = allUrls.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allUrls.length / BATCH_SIZE);
        console.log(`📡 Submitting batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

        const payload = {
            host: HOST,
            key: KEY,
            keyLocation: KEY_LOCATION,
            urlList: batch,
        };

        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`✅ Batch ${batchNum} submitted successfully (${response.status})`);
                successCount += batch.length;
            } else {
                const text = await response.text();
                console.error(`❌ Batch ${batchNum} failed: ${response.status} ${response.statusText}`);
                console.error(text);
                failCount += batch.length;
            }
        } catch (error) {
            console.error(`❌ Network error on batch ${batchNum}:`, error.message);
            failCount += batch.length;
        }
    }

    console.log(`\n🎉 IndexNow submission complete!`);
    console.log(`📊 Summary:`);
    console.log(`   ✅ Success: ${successCount} URLs`);
    if (failCount > 0) console.log(`   ❌ Failed: ${failCount} URLs`);
    console.log(`   📄 Total submitted: ${allUrls.length} URLs`);
}

main().catch(console.error);
