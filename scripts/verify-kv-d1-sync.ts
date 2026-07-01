#!/usr/bin/env npx tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import * as dotenv from 'dotenv';
import { KV_NAMESPACE_ID } from './lib/constants';
import { sanitizePublicAIOutputValue } from '../src/lib/public-ai-output';

dotenv.config({ quiet: true });
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', quiet: true });
}

// Environment Config
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || readDatabaseIdFromWrangler();

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');
const REPORT_FILE = path.join(process.cwd(), 'reports/seo', 'sync-health.json');

// --- Helper Functions ---

function readDatabaseIdFromWrangler(): string {
  const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) return '';
  const content = fs.readFileSync(wranglerPath, 'utf8');
  const match = content.match(/database_id\s*=\s*"([^"]+)"/);
  return match?.[1] || '';
}

function cloneSkill<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

const MAX_STATEMENT_BYTES = 180_000;

export function shrinkSkillForSql(skill: any): { json: string; reduced: boolean } {
  const copy = cloneSkill(sanitizePublicAIOutputValue(skill)) as Record<string, any>;
  let reduced = false;

  const reducers: Array<() => void> = [
    () => {
      if (typeof copy.skillMd?.body === 'string') {
        copy.skillMd.body = copy.skillMd.bodyPreview || copy.skillMd.body.slice(0, 800);
        reduced = true;
      }
    },
    () => {
      if (typeof copy.skillMd?.bodyPreview === 'string' && copy.skillMd.bodyPreview.length > 400) {
        copy.skillMd.bodyPreview = copy.skillMd.bodyPreview.slice(0, 400);
        reduced = true;
      }
    },
    () => {
      if ('repositoryContext' in copy) {
        delete copy.repositoryContext;
        reduced = true;
      }
    },
    () => {
      if ('agentAnalysis' in copy) {
        delete copy.agentAnalysis;
        reduced = true;
      }
    },
    () => {
      if (copy.skillMd && typeof copy.skillMd === 'object') {
        delete copy.skillMd.body;
        reduced = true;
      }
    },
    () => {
      if (copy.skillMd && typeof copy.skillMd === 'object') {
        delete copy.skillMd.bodyPreview;
        reduced = true;
      }
    },
  ];

  let rawJson = JSON.stringify(copy);
  for (const reduce of reducers) {
    if (byteLength(rawJson) <= MAX_STATEMENT_BYTES / 2) break;
    reduce();
    rawJson = JSON.stringify(copy);
  }

  return { json: rawJson, reduced };
}

export function normalizeContentHash(_skill: any, json: string): string {
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
}

export function computeExpectedHash(skill: any): string {
  const { json } = shrinkSkillForSql(skill);
  return normalizeContentHash(skill, json);
}

// --- Verification core logics (for unit testing) ---

export type ComparisonResult = {
  isHealthy: boolean;
  d1: {
    isHealthy: boolean;
    totalLocal: number;
    totalRemote: number;
    missing: string[];
    extra: string[];
    mismatch: Array<{ id: string; expected: string; got: string }>;
  };
  kv: {
    isHealthy: boolean;
    totalLocal: number;
    totalRemote: number;
    missing: string[];
    extra: string[];
  };
};

export function compareDatabaseState(
  localSkills: any[],
  remoteD1Rows: Array<{ id: string; content_hash?: string }>,
  remoteKvKeys: string[],
  options: { strict?: boolean } = {},
): ComparisonResult {
  const localMap = new Map<string, string>();
  for (const skill of localSkills) {
    if (skill?.id) {
      localMap.set(skill.id, computeExpectedHash(skill));
    }
  }

  const remoteD1Map = new Map<string, string>();
  for (const row of remoteD1Rows) {
    if (row?.id) {
      remoteD1Map.set(row.id, row.content_hash || '');
    }
  }

  const remoteKvSet = new Set(remoteKvKeys);

  const d1Missing: string[] = [];
  const d1Extra: string[] = [];
  const d1Mismatch: ComparisonResult['d1']['mismatch'] = [];

  const kvMissing: string[] = [];
  const kvExtra: string[] = [];

  // 1. D1 Checks
  for (const [id, expectedHash] of localMap.entries()) {
    if (!remoteD1Map.has(id)) {
      d1Missing.push(id);
    } else {
      const gotHash = remoteD1Map.get(id) || '';
      if (gotHash !== expectedHash) {
        d1Mismatch.push({ id, expected: expectedHash, got: gotHash });
      }
    }
  }

  for (const id of remoteD1Map.keys()) {
    if (!localMap.has(id)) {
      d1Extra.push(id);
    }
  }

  // 2. KV Checks
  for (const id of localMap.keys()) {
    if (!remoteKvSet.has(id)) {
      kvMissing.push(id);
    }
  }

  if (options.strict) {
    for (const key of remoteKvKeys) {
      const isSkillKey = !key.startsWith('sitemap:') && !key.startsWith('blog:') && !key.startsWith('collection:');
      if (isSkillKey && !localMap.has(key)) {
        kvExtra.push(key);
      }
    }
  }

  const d1Healthy = d1Missing.length === 0 && d1Extra.length === 0 && d1Mismatch.length === 0;
  const kvHealthy = kvMissing.length === 0 && (options.strict ? kvExtra.length === 0 : true);

  return {
    isHealthy: d1Healthy && kvHealthy,
    d1: {
      isHealthy: d1Healthy,
      totalLocal: localMap.size,
      totalRemote: remoteD1Map.size,
      missing: d1Missing,
      extra: d1Extra,
      mismatch: d1Mismatch,
    },
    kv: {
      isHealthy: kvHealthy,
      totalLocal: localMap.size,
      totalRemote: remoteKvKeys.length,
      missing: kvMissing,
      extra: kvExtra,
    },
  };
}

// --- Cloudflare API Request Helpers ---

async function fetchRemoteD1Rows(): Promise<Array<{ id: string; content_hash?: string }>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: 'SELECT id, content_hash FROM skills;' }),
  });

  if (!response.ok) {
    throw new Error(`D1 Query failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as any;
  if (payload?.success === false) {
    const errorMsg = payload?.errors?.[0]?.message || 'Unknown D1 API error';
    throw new Error(`D1 Query API error: ${errorMsg}`);
  }

  if (Array.isArray(payload?.result) && payload.result.length > 0) {
    const statement = payload.result[0];
    if (Array.isArray(statement?.results)) {
      return statement.results;
    }
  }
  return [];
}

async function fetchRemoteKvKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?limit=1000${cursor ? `&cursor=${cursor}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`KV keys list failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      const errorMsg = data?.errors?.[0]?.message || 'Unknown KV API error';
      throw new Error(`KV API error: ${errorMsg}`);
    }

    const chunk = data.result.map((item: any) => item.name);
    keys.push(...chunk);
    const info = data.result_info || {};
    cursor = info.cursor || '';
    hasMore = !!cursor;
  }

  return keys;
}

// --- CLI Runner ---

async function run() {
  const args = process.argv.slice(2);
  const isStrict = args.includes('--strict');
  const d1Only = args.includes('--d1-only');
  const kvOnly = args.includes('--kv-only');
  const isCi = process.env.GITHUB_ACTIONS === 'true' || args.includes('--fail-on-missing-vars');

  if (!ACCOUNT_ID || !API_TOKEN) {
    const msg = '⚠️ Database sync check skipped: missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN.';
    console.warn(msg);
    if (isCi) {
      console.error('❌ CI Environment requires valid Cloudflare credentials!');
      process.exit(1);
    }
    process.exit(0);
  }

  if (d1Only && !DATABASE_ID) {
    const msg = '⚠️ D1 check skipped: missing CLOUDFLARE_D1_DATABASE_ID.';
    console.warn(msg);
    if (isCi) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`❌ Authorities cache file not found: ${CACHE_FILE}`);
    process.exit(1);
  }

  console.log('🔍 Load local authoritative cache...');
  const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const localSkills = Array.isArray(cacheData) ? cacheData : cacheData.skills || [];

  let remoteD1Rows: Array<{ id: string; content_hash?: string }> = [];
  let remoteKvKeys: string[] = [];

  // D1 fetching
  if (!kvOnly) {
    if (!DATABASE_ID) {
      console.warn('⚠️ Missing CLOUDFLARE_D1_DATABASE_ID. D1 checking skipped.');
    } else {
      console.log('☁️ Fetching remote D1 schema records...');
      try {
        remoteD1Rows = await fetchRemoteD1Rows();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Failed to fetch D1 records: ${errorMsg}`);
        if (isCi) {
          process.exit(1);
        } else {
          console.warn('⚠️ Non-CI environment: skipping D1 connection check and exiting successfully.');
          process.exit(0);
        }
      }
    }
  }

  // KV fetching
  if (!d1Only) {
    console.log('☁️ Fetching remote KV keys...');
    try {
      remoteKvKeys = await fetchRemoteKvKeys();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed to fetch KV keys: ${errorMsg}`);
      if (isCi) {
        process.exit(1);
      } else {
        console.warn('⚠️ Non-CI environment: skipping KV connection check and exiting successfully.');
        process.exit(0);
      }
    }
  }

  console.log('⚖️ Comparing state...');
  const report = compareDatabaseState(localSkills, d1Only ? [] : remoteD1Rows, kvOnly ? [] : remoteKvKeys, {
    strict: isStrict,
  });

  const reportWrapper = {
    generatedAt: new Date().toISOString(),
    status: report.isHealthy ? 'healthy' : 'unhealthy',
    options: { strict: isStrict, d1Only, kvOnly },
    d1: d1Only ? null : report.d1,
    kv: kvOnly ? null : report.kv,
  };

  // Write Report
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(reportWrapper, null, 2), 'utf8');
  console.log(`📝 Wrote health check report to ${REPORT_FILE}`);

  // Display results
  if (report.isHealthy) {
    console.log('✅ Synchronization check passed! D1 database and KV space are healthy.');
    process.exit(0);
  }

  console.error('❌ Synchronization check failed! Detected drifts:');

  if (!kvOnly && !report.d1.isHealthy) {
    console.error(`\n[D1 database has issues]`);
    if (report.d1.missing.length > 0) {
      console.error(`- Missing in D1 (${report.d1.missing.length}):`);
      report.d1.missing.slice(0, 10).forEach((id) => console.error(`    * ${id}`));
      if (report.d1.missing.length > 10) console.error(`    ...and ${report.d1.missing.length - 10} more`);
    }
    if (report.d1.extra.length > 0) {
      console.error(`- Extra in D1 (${report.d1.extra.length}):`);
      report.d1.extra.slice(0, 10).forEach((id) => console.error(`    * ${id}`));
      if (report.d1.extra.length > 10) console.error(`    ...and ${report.d1.extra.length - 10} more`);
    }
    if (report.d1.mismatch.length > 0) {
      console.error(`- Content Hash Mismatches (${report.d1.mismatch.length}):`);
      report.d1.mismatch
        .slice(0, 10)
        .forEach((m) => console.error(`    * ${m.id} (Expected: ${m.expected}, got: ${m.got})`));
      if (report.d1.mismatch.length > 10) console.error(`    ...and ${report.d1.mismatch.length - 10} more`);
    }
  }

  if (!d1Only && !report.kv.isHealthy) {
    console.error(`\n[KV space has issues]`);
    if (report.kv.missing.length > 0) {
      console.error(`- Missing in KV (${report.kv.missing.length}):`);
      report.kv.missing.slice(0, 10).forEach((id) => console.error(`    * ${id}`));
      if (report.kv.missing.length > 10) console.error(`    ...and ${report.kv.missing.length - 10} more`);
    }
    if (isStrict && report.kv.extra.length > 0) {
      console.error(`- Extra in KV (${report.kv.extra.length}):`);
      report.kv.extra.slice(0, 10).forEach((key) => console.error(`    * ${key}`));
      if (report.kv.extra.length > 10) console.error(`    ...and ${report.kv.extra.length - 10} more`);
    }
  }

  process.exit(1);
}

// Only execute runner if file is called directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith('verify-kv-d1-sync.ts') || process.argv[1].endsWith('verify-kv-d1-sync.js'))
) {
  run().catch((err) => {
    console.error('❌ Verification script crashed:', err);
    process.exit(1);
  });
}
