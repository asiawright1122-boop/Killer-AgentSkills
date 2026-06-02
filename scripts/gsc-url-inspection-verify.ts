#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

dotenv.config();
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

type InspectionVerdict = 'PASS' | 'FAIL' | 'NEUTRAL' | 'PARTIAL' | 'UNSPECIFIED';
type IndexingState = 'INDEXING_ALLOWED' | 'BLOCKED_BY_META_TAG' | 'BLOCKED_BY_HTTP_ROBOTS_TXT' | 'BLOCKED_BY_ROBOTS_TXT' | 'BLOCKED_FOR_UNAUTHORIZED_ACCESS' | 'UNSPECIFIED';

type IndexStatusResult = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  referringUrls?: string[];
  sitemap?: string[];
};

type UrlInspectionResult = {
  inspectionResult?: {
    indexStatusResult?: IndexStatusResult;
  };
};

type InspectionRecord = {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime: string | null;
  pageFetchState: string;
  googleCanonical: string | null;
  robotsTxtState: string;
  inspectedAt: string;
  error?: string;
};

type VerificationReport = {
  generatedAt: string;
  sourceArchive: string;
  sampleSize: number;
  totalArchivedUrls: number;
  passCount: number;
  neutralCount: number;
  failCount: number;
  errorCount: number;
  verdictBreakdown: Record<string, number>;
  coverageStateBreakdown: Record<string, number>;
  fetchStateBreakdown: Record<string, number>;
  indexingStateBreakdown: Record<string, number>;
  patternBreakdown: {
    doubledPath: number;
    queryString: number;
    trailingSlash: number;
    other: number;
  };
  records: InspectionRecord[];
};

function getConfig() {
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const siteUrl = (process.env.GSC_SITE_URL || '').trim();

  if (!clientEmail || !privateKey || !siteUrl) {
    console.error('Missing GSC credentials. Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL in .env.local');
    process.exit(1);
  }

  return { clientEmail, privateKey, siteUrl };
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function fetchAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch Google OAuth token (${response.status}): ${text}`);
  }

  let data: { access_token?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Google OAuth token response was not valid JSON: ${text.slice(0, 200)}`);
  }

  if (!data.access_token) {
    throw new Error(`Google OAuth token response did not include access_token. Response keys: ${Object.keys(data).join(', ')}`);
  }

  return data.access_token;
}

async function inspectUrl(
  url: string,
  siteUrl: string,
  accessToken: string,
): Promise<UrlInspectionResult> {
  const endpoint = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: url,
      siteUrl,
      languageCode: 'en-US',
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`URL Inspection API failed for ${url} (${response.status}): ${details}`);
  }

  const raw = await response.json();
  if (process.env.DEBUG_INSPECT === '1') {
    console.log('RAW RESPONSE:', JSON.stringify(raw, null, 2).slice(0, 500));
  }
  return raw as UrlInspectionResult;
}

function classifyUrlPattern(url: string): 'doubledPath' | 'queryString' | 'trailingSlash' | 'other' {
  if (/\/(references|rules|roles|skills)\/\1/i.test(url)) return 'doubledPath';
  if (url.includes('?')) return 'queryString';
  if (url.endsWith('/')) return 'trailingSlash';
  return 'other';
}

function readArchivedUrls(archiveDir: string): string[] {
  const tablePath = resolve(archiveDir, 'table.csv');
  if (!existsSync(tablePath)) return [];

  const content = readFileSync(tablePath, 'utf8').replace(/^\ufeff/, '');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const urls: string[] = [];
  for (const line of lines.slice(1)) {
    let url: string;
    if (line.startsWith('"')) {
      const endQuote = line.indexOf('",');
      if (endQuote >= 0) {
        url = line.slice(1, endQuote);
      } else {
        url = line.replace(/^"|"$/g, '');
      }
    } else {
      const commaIdx = line.indexOf(',');
      url = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
    }
    url = url.trim();
    if (url && url.startsWith('http')) {
      urls.push(url);
    }
  }
  return urls;
}

function selectSample(urls: string[], maxSample: number): string[] {
  if (urls.length <= maxSample) return urls;

  const byPattern = new Map<string, string[]>();
  for (const url of urls) {
    const pattern = classifyUrlPattern(url);
    const list = byPattern.get(pattern) || [];
    list.push(url);
    byPattern.set(pattern, list);
  }

  const sample: string[] = [];
  const patternKeys = Array.from(byPattern.keys()).sort();
  const perPattern = Math.max(3, Math.floor(maxSample / patternKeys.length));

  for (const key of patternKeys) {
    const list = byPattern.get(key) || [];
    const count = Math.min(perPattern, list.length);
    for (let i = 0; i < count; i++) {
      sample.push(list[i]);
    }
  }

  return sample.slice(0, maxSample);
}

const SLEEP_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const config = getConfig();
  const archiveDir = resolve(process.cwd(), 'data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-16');
  const reportDir = resolve(process.cwd(), 'reports/seo');

  const allUrls = readArchivedUrls(archiveDir);
  if (allUrls.length === 0) {
    console.error('No URLs found in archived table.csv');
    process.exit(1);
  }

  const maxSample = Number(process.env.INSPECT_SAMPLE_SIZE || 30);
  const sample = selectSample(allUrls, maxSample);

  console.log(`Total archived 404 URLs: ${allUrls.length}`);
  console.log(`Sample size: ${sample.length}`);
  console.log('Fetching access token...');

  const accessToken = await fetchAccessToken(config.clientEmail, config.privateKey);
  console.log('Access token obtained. Starting URL inspections...');

  const records: InspectionRecord[] = [];
  const verdictBreakdown: Record<string, number> = {};
  const coverageStateBreakdown: Record<string, number> = {};
  const fetchStateBreakdown: Record<string, number> = {};
  const indexingStateBreakdown: Record<string, number> = {};
  const patternBreakdown = { doubledPath: 0, queryString: 0, trailingSlash: 0, other: 0 };

  for (let i = 0; i < sample.length; i++) {
    const url = sample[i];
    const pattern = classifyUrlPattern(url);
    patternBreakdown[pattern]++;

    console.log(`[${i + 1}/${sample.length}] Inspecting: ${url}`);

    try {
      const result = await inspectUrl(url, config.siteUrl, accessToken);
      const indexStatus = result.inspectionResult?.indexStatusResult;

      const verdict = indexStatus?.verdict || 'UNSPECIFIED';
      const coverageState = indexStatus?.coverageState || 'UNSPECIFIED';
      const indexingState = indexStatus?.indexingState || 'UNSPECIFIED';
      const lastCrawlTime = indexStatus?.lastCrawlTime || null;
      const pageFetchState = indexStatus?.pageFetchState || 'UNSPECIFIED';
      const googleCanonical = indexStatus?.googleCanonical || null;
      const robotsTxtState = indexStatus?.robotsTxtState || 'UNSPECIFIED';

      const record: InspectionRecord = {
        url,
        verdict,
        coverageState,
        indexingState,
        lastCrawlTime,
        pageFetchState,
        googleCanonical,
        robotsTxtState,
        inspectedAt: new Date().toISOString(),
      };

      records.push(record);
      verdictBreakdown[verdict] = (verdictBreakdown[verdict] || 0) + 1;
      coverageStateBreakdown[coverageState] = (coverageStateBreakdown[coverageState] || 0) + 1;
      fetchStateBreakdown[pageFetchState] = (fetchStateBreakdown[pageFetchState] || 0) + 1;
      indexingStateBreakdown[indexingState] = (indexingStateBreakdown[indexingState] || 0) + 1;

      console.log(`  → verdict=${verdict} | coverage=${coverageState} | fetchState=${pageFetchState}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  → ERROR: ${errMsg}`);

      records.push({
        url,
        verdict: 'ERROR',
        coverageState: 'ERROR',
        indexingState: 'ERROR',
        lastCrawlTime: null,
        pageFetchState: 'ERROR',
        googleCanonical: null,
        robotsTxtState: 'ERROR',
        inspectedAt: new Date().toISOString(),
        error: errMsg,
      });

      verdictBreakdown['ERROR'] = (verdictBreakdown['ERROR'] || 0) + 1;
    }

    if (i < sample.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  const passCount = records.filter((r) => r.verdict === 'PASS').length;
  const neutralCount = records.filter((r) => r.verdict === 'NEUTRAL').length;
  const failCount = records.filter((r) => r.verdict === 'FAIL').length;
  const errorCount = records.filter((r) => r.verdict === 'ERROR').length;

  const report: VerificationReport = {
    generatedAt: new Date().toISOString(),
    sourceArchive: archiveDir,
    sampleSize: sample.length,
    totalArchivedUrls: allUrls.length,
    passCount,
    neutralCount,
    failCount,
    errorCount,
    verdictBreakdown,
    coverageStateBreakdown,
    fetchStateBreakdown,
    indexingStateBreakdown,
    patternBreakdown,
    records,
  };

  mkdirSync(reportDir, { recursive: true });

  const jsonPath = resolve(reportDir, 'url-inspection-verify.json');
  const mdPath = resolve(reportDir, 'url-inspection-verify.md');

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const mdLines = [
    '# URL Inspection Verification Report',
    '',
    `## Summary`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Source archive: ${report.sourceArchive}`,
    `- Total archived 404 URLs: ${report.totalArchivedUrls}`,
    `- Sample inspected: ${report.sampleSize}`,
    `- PASS (indexed): ${passCount}`,
    `- NEUTRAL (excluded/error): ${neutralCount}`,
    `- FAIL (not indexed): ${failCount}`,
    `- ERROR (API failure): ${errorCount}`,
    '',
    `## Verdict Breakdown`,
    '',
    ...Object.entries(verdictBreakdown).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Coverage State Breakdown`,
    '',
    ...Object.entries(coverageStateBreakdown).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Page Fetch State Breakdown`,
    '',
    ...Object.entries(fetchStateBreakdown).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Indexing State Breakdown`,
    '',
    ...Object.entries(indexingStateBreakdown).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## URL Pattern Breakdown (sample)`,
    '',
    `- Doubled path (e.g. /references/references): ${patternBreakdown.doubledPath}`,
    `- Query string (e.g. ?q=...): ${patternBreakdown.queryString}`,
    `- Trailing slash: ${patternBreakdown.trailingSlash}`,
    `- Other: ${patternBreakdown.other}`,
    '',
    `## Inspection Details`,
    '',
    ...records.map((r) => {
      const lines = [
        `### ${r.url}`,
        `- Verdict: **${r.verdict}**`,
        `- Coverage state: ${r.coverageState}`,
        `- Indexing state: ${r.indexingState}`,
        `- Page fetch state: ${r.pageFetchState}`,
        `- Robots.txt state: ${r.robotsTxtState}`,
        `- Last crawl time: ${r.lastCrawlTime || 'never'}`,
        `- Google canonical: ${r.googleCanonical || 'none'}`,
      ];
      if (r.error) lines.push(`- Error: ${r.error}`);
      return lines.join('\n');
    }),
    '',
  ];

  writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  console.log(`\nVerification complete.`);
  console.log(`PASS: ${passCount} | NEUTRAL: ${neutralCount} | FAIL: ${failCount} | ERROR: ${errorCount}`);
  console.log(`Report: ${mdPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
