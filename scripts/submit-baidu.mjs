// Submit ALL URLs from the live sitemap index to Baidu Link Submission API
// usage: BAIDU_TOKEN=your_token node scripts/submit-baidu.mjs

const HOST = 'killer-skills.com';
const TOKEN = process.env.BAIDU_TOKEN;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const BATCH_SIZE = 2000;

if (!TOKEN) {
    console.error('❌ Error: BAIDU_TOKEN environment variable is required.');
    process.exit(1);
}

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
    console.log(`🚀 Starting Baidu submission for ${HOST}...`);

    let indexXml = await fetchXml(SITEMAP_URL);
    if (!indexXml) {
        console.error('❌ Failed to fetch sitemap index.');
        return;
    }

    const isSitemapIndex = indexXml.includes('<sitemapindex');
    const allUrls = new Set();

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
    console.log(`\n🔗 Total unique URLs to submit to Baidu: ${urlList.length}\n`);

    for (let i = 0; i < urlList.length; i += BATCH_SIZE) {
        const batch = urlList.slice(i, i + BATCH_SIZE);
        const endpoint = `http://data.zz.baidu.com/urls?site=https://${HOST}&token=${TOKEN}`;

        console.log(`📡 Submitting batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: batch.join('\n'),
            });
            const result = await res.json();
            console.log(`   ✅ Success: ${result.success}, Remaining today: ${result.remain}`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }
    }
    console.log('\n🎉 Baidu submission complete!');
}

main().catch(console.error);
