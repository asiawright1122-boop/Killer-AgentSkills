import * as fs from 'node:fs';

import { chromium } from 'playwright';

const INPUT_FILE = '/Users/kaka/DEV/Killer-Skills/probe_list_final.txt';
const OUTPUT_FILE = '/Users/kaka/DEV/Killer-Skills/valid_new_sites.json';

async function probeUrl(page: any, baseUrl: string, path: string) {
    const url = `https://${baseUrl}${path}`;
    try {
        console.log(`    Checking ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

        const formCount = await page.locator('form').count();
        if (formCount === 0) return null;

        const hasNameField = await page.locator('input[name*="name" i], input[placeholder*="name" i]').count() > 0;
        const hasUrlField = await page.locator('input[name*="url" i], input[name*="website" i], input[placeholder*="url" i]').count() > 0;
        const hasSubmitBtn = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Add")').count() > 0;

        if ((hasNameField || hasUrlField) && hasSubmitBtn) {
            return url;
        }
    } catch {
        // ignore
    }
    return null;
}

async function run() {
    const domains = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n').map(d => d.trim()).filter(Boolean);
    const validSites = [];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const domain of domains) {
        console.log(`Probing ${domain}...`);

        let foundUrl = await probeUrl(page, domain, '/submit');
        if (!foundUrl) foundUrl = await probeUrl(page, domain, '/add-tool');
        if (!foundUrl) foundUrl = await probeUrl(page, domain, '/submit-tool');
        if (!foundUrl) foundUrl = await probeUrl(page, domain, '/add');
        if (!foundUrl) foundUrl = await probeUrl(page, domain, '/list-your-tool');

        if (foundUrl) {
            console.log(`  ✅ Found valid form at ${foundUrl}`);
            validSites.push({ domain, submitUrl: foundUrl });
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validSites, null, 2));
    console.log(`\nDone! Saved ${validSites.length} sites to ${OUTPUT_FILE}`);
    await browser.close();
}

run().catch(console.error);
