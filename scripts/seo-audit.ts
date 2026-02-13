#!/usr/bin/env npx tsx

/**
 * KILLER-SKILLS SEO AUDIT
 * Zero-dependency automated SEO check for Astro static builds or live servers.
 * 
 * Usage: 
 *   npx tsx scripts/seo-audit.ts [base_url]
 *   Default base_url: http://localhost:4321
 */

import { fetch } from 'undici'; // Built-in in Node 18+, but explicit import if needed. Or just global fetch.

const BASE_URL = process.argv[2] || 'http://localhost:4321';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface AuditResult {
    url: string;
    score: number;
    errors: string[];
    warnings: string[];
    passed: string[];
}

const TARGETS = [
    '/en',
    '/zh',
    '/en/skills',
    '/en/cli',
    '/en/skills/anthropics/skills/side-project-personality-quiz', // Representative skill
];

async function auditPage(path: string): Promise<AuditResult> {
    const url = `${BASE_URL}${path}`;
    const result: AuditResult = {
        url,
        score: 100,
        errors: [],
        warnings: [],
        passed: []
    };

    try {
        const start = performance.now();
        const res = await fetch(url);
        const duration = Math.round(performance.now() - start);

        if (!res.ok) {
            result.errors.push(`HTTP ${res.status}`);
            result.score = 0;
            return result;
        }

        const html = await res.text();

        // --- 1. Meta Tags ---
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1] : '';

        if (!title) {
            result.errors.push('Missing <title>');
            result.score -= 20;
        } else {
            if (title.length < 10) {
                result.warnings.push(`Title too short: ${title.length} chars ("${title}")`);
                result.score -= 5;
            } else if (title.length > 70) {
                result.warnings.push(`Title too long: ${title.length} chars`);
                result.score -= 5;
            } else {
                result.passed.push(`Title length: ${title.length}`);
            }
        }

        const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
        const description = descMatch ? descMatch[1] : '';

        if (!description) {
            result.errors.push('Missing meta description');
            result.score -= 20;
        } else {
            if (description.length < 50) {
                result.warnings.push(`Description too short: ${description.length} chars`);
                result.score -= 5;
            } else if (description.length > 180) {
                result.warnings.push(`Description too long: ${description.length} chars`);
                result.score -= 5;
            } else {
                result.passed.push(`Description length: ${description.length}`);
            }
        }

        const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="(.*?)"/i);
        if (canonicalMatch) {
            result.passed.push(`Canonical: ${canonicalMatch[1]}`);
        } else {
            result.errors.push('Missing canonical tag');
            result.score -= 10;
        }

        // --- 2. Heading Structure ---
        const h1Matches = html.match(/<h1/g);
        const h1Count = h1Matches ? h1Matches.length : 0;

        if (h1Count === 0) {
            result.errors.push('Missing <h1>');
            result.score -= 15;
        } else if (h1Count > 1) {
            result.errors.push(`Multiple <h1> tags found (${h1Count})`);
            result.score -= 10;
        } else {
            result.passed.push('Single <h1> check');
        }

        // --- 3. Open Graph ---
        const ogFields = ['title', 'description', 'image', 'url', 'type', 'locale'];
        let ogMissing = [];
        for (const field of ogFields) {
            if (!new RegExp(`<meta\\s+property="og:${field}"`, 'i').test(html)) {
                ogMissing.push(field);
            }
        }

        if (ogMissing.length > 0) {
            result.errors.push(`Missing OG tags: ${ogMissing.join(', ')}`);
            result.score -= (ogMissing.length * 5);
        } else {
            result.passed.push('Basic OG tags present');
        }

        // Check OG Image URL (New IP check)
        if (html.includes('http://146.235.234.248:3000')) {
            result.passed.push('OG Image using new IP Server');
        } else {
            // Only warn if we expect it (e.g. on skill pages)
            if (url.includes('/skills/')) {
                result.warnings.push('OG Image NOT using new IP Server (or could be static image)');
            }
        }

        // --- 4. JSON-LD ---
        if (html.includes('application/ld+json')) {
            result.passed.push('Structured Data (JSON-LD) detected');
        } else {
            // Only strictly required on detail pages
            if (url.includes('/skills/') && !url.endsWith('/skills')) {
                result.warnings.push('No JSON-LD found');
            }
        }

        // --- 5. Images (CLS & Alt) ---
        const imgTags = html.match(/<img\s+[^>]*>/g) || [];
        let missingAlt = 0;
        let missingDims = 0;

        imgTags.forEach(img => {
            if (!img.includes('alt=')) missingAlt++;
            if (!img.includes('width=') || !img.includes('height=')) missingDims++;
        });

        if (missingAlt > 0) {
            result.warnings.push(`${missingAlt} images missing alt text`);
            result.score -= (missingAlt * 1); // Small penalty
        }
        if (missingDims > 0) {
            result.errors.push(`${missingDims} images missing width/height (CLS Risk)`);
            result.score -= (missingDims * 2);
        } else {
            result.passed.push('All images have width/height');
        }

        // --- Performance/Tech ---
        result.passed.push(`Response time: ${duration}ms`);

    } catch (e) {
        result.errors.push(`Fetch failed: ${e}`);
        result.score = 0;
    }

    return result;
}

async function run() {
    console.log(`${BOLD}🚀 STARTING SEO AUDIT on ${BASE_URL}${RESET}\n`);

    let totalErrors = 0;

    for (const path of TARGETS) {
        console.log(`Analyzing: ${path}...`);
        const result = await auditPage(path);

        // Print Report
        const color = result.score >= 90 ? GREEN : (result.score >= 70 ? YELLOW : RED);
        console.log(`  Score: ${color}${result.score}/100${RESET}`);

        if (result.errors.length > 0) {
            console.log(`  ${RED}✖ Errors:${RESET}`);
            result.errors.forEach(e => console.log(`    - ${e}`));
            totalErrors += result.errors.length;
        }

        if (result.warnings.length > 0) {
            console.log(`  ${YELLOW}⚠ Warnings:${RESET}`);
            result.warnings.forEach(w => console.log(`    - ${w}`));
        }

        console.log(`  ${GREEN}✔ Passed checks: ${result.passed.length}${RESET}`);
        console.log('');
    }

    if (totalErrors > 0) {
        console.log(`\n${RED}❌ Audit completed with ${totalErrors} errors.${RESET}`);
        process.exit(1);
    } else {
        console.log(`\n${GREEN}✅ Audit completed successfully! No critical errors.${RESET}`);
        process.exit(0);
    }
}

run();
