#!/usr/bin/env npx tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import 'dotenv/config';
import * as dotenv from 'dotenv';
import type { CacheData, SkillCache } from './lib/types';
import { sanitizePublicAIOutputValue } from '../src/lib/public-ai-output';
import { findPublicD1SqlGuardIssues } from './public-d1-seed-guard';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');
const WRANGLER_TOML = path.join(process.cwd(), 'wrangler.toml');
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || readDatabaseIdFromWrangler();

const MAX_STATEMENT_BYTES = 180_000;
const BATCH_MAX_BYTES = 700_000;
const BATCH_MAX_STATEMENTS = 30;
const API_RETRY_COUNT = 3;

function readDatabaseIdFromWrangler(): string {
  if (!fs.existsSync(WRANGLER_TOML)) return '';
  const content = fs.readFileSync(WRANGLER_TOML, 'utf8');
  const match = content.match(/database_id\s*=\s*"([^"]+)"/);
  return match?.[1] || '';
}

function escapeSql(str: string | undefined | null): string {
  if (str === undefined || str === null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || Number.isNaN(num)) return '0';
  return String(num);
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function cloneSkill<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function toPublicSkill(skill: SkillCache): SkillCache {
  return sanitizePublicAIOutputValue(skill) as SkillCache;
}

function buildSearchText(skill: SkillCache): string {
  const searchArr = [
    skill.name,
    skill.owner,
    skill.repo,
    skill.category,
    skill.topics?.join(' '),
    typeof skill.description === 'object' ? Object.values(skill.description).join(' ') : skill.description,
    skill.seo?.keywords?.en?.join(' '),
    skill.seo?.keywords?.zh?.join(' '),
    skill.seo?.features?.en?.join(' '),
    skill.seo?.definition?.en,
  ];

  return searchArr.filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 4000);
}

function shrinkSkillForSql(skill: SkillCache): { json: string; reduced: boolean } {
  const copy = cloneSkill(skill) as Record<string, any>;
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

function normalizeContentHash(_skill: SkillCache, json: string): string {
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
}

function buildUpsertStatement(rawSkill: SkillCache): { sql: string; skipped: boolean } {
  // Skip low-quality skills — they should not be synced to D1
  // (quality_score <= 50 AND stars <= 10 are purged from search/sitemap)
  const qScore = rawSkill.qualityScore ?? 0;
  const starCount = rawSkill.stars ?? 0;
  if (qScore <= 50 && starCount <= 10) {
    return { sql: '', skipped: true };
  }

  const skill = toPublicSkill(rawSkill);
  const id = escapeSql(skill.id);
  const category = escapeSql(skill.category || 'developer');
  const owner = escapeSql(skill.owner);
  const repo = escapeSql(skill.repo);
  const repoPath = escapeSql(skill.repoPath || '');
  const name = escapeSql(skill.name || skill.repo);
  const stars = escapeNumber(skill.stars);
  const forks = escapeNumber(skill.forks);
  const qualityScore = escapeNumber(skill.qualityScore || 0);
  const updatedAt = escapeSql(skill.updatedAt || '');
  const lastSynced = escapeSql(skill.lastSynced || skill.updatedAt || '');

  const { json: rawJson, reduced } = shrinkSkillForSql(skill);
  const contentHash = escapeSql(normalizeContentHash(skill, rawJson));
  const dataJson = escapeSql(rawJson);
  const searchText = escapeSql(buildSearchText(skill));

  const sql = `INSERT OR REPLACE INTO skills (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) VALUES (${id}, ${category}, ${owner}, ${repo}, ${repoPath}, ${name}, ${stars}, ${forks}, ${qualityScore}, ${updatedAt}, ${lastSynced}, ${contentHash}, ${dataJson});\nDELETE FROM skills_fts WHERE id = ${id};\nINSERT INTO skills_fts (id, name, owner, repo, category, search_text) VALUES (${id}, ${name}, ${owner}, ${repo}, ${category}, ${searchText});`;

  if (reduced) {
    console.warn(`⚠️ Reduced oversized payload for ${skill.id}`);
  }

  if (byteLength(sql) > MAX_STATEMENT_BYTES) {
    console.warn(`⚠️ Skipped ${skill.id}: statement too large (${Math.round(byteLength(sql) / 1024)}KB)`);
    return { sql: '', skipped: true };
  }

  return { sql, skipped: false };
}

function buildDeleteStatement(id: string): string {
  const escaped = escapeSql(id);
  return `DELETE FROM skills WHERE id = ${escaped};\nDELETE FROM skills_fts WHERE id = ${escaped};`;
}

async function queryD1(sql: string): Promise<any> {
  const publicOutputIssues = findPublicD1SqlGuardIssues(sql, 'sync-d1-delta');
  if (publicOutputIssues.length > 0) {
    throw new Error(
      `Refusing to send D1 SQL with hidden reasoning markers: ${publicOutputIssues
        .map((issue) => `${issue.pattern}=${JSON.stringify(issue.match)}`)
        .join(', ')}`,
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

  let lastError = '';
  for (let attempt = 1; attempt <= API_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });

      const payload = (await response.json().catch(() => ({}))) as any;

      const statementFailures = Array.isArray(payload?.result)
        ? payload.result.filter((item: any) => item && item.success === false)
        : [];

      if (!response.ok || payload?.success === false || statementFailures.length > 0) {
        const msg =
          payload?.errors?.[0]?.message ||
          statementFailures?.[0]?.errors?.[0]?.message ||
          payload?.result?.[0]?.errors?.[0]?.message ||
          `${response.status} ${response.statusText}`;
        throw new Error(msg);
      }

      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < API_RETRY_COUNT) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }

  throw new Error(lastError || 'Unknown D1 API error');
}

function extractRows(payload: any): Array<{ id: string; content_hash?: string }> {
  if (Array.isArray(payload?.result) && payload.result.length > 0) {
    const statement = payload.result[0];
    if (Array.isArray(statement?.results)) {
      return statement.results as Array<{ id: string; content_hash?: string }>;
    }
  }
  return [];
}

function loadLocalSkills(): SkillCache[] {
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`skills cache not found: ${CACHE_FILE}`);
  }

  const raw = fs.readFileSync(CACHE_FILE, 'utf8');
  const parsed = JSON.parse(raw) as CacheData | SkillCache[];
  if (Array.isArray(parsed)) return parsed;
  return parsed.skills || [];
}

async function runBatches(sqlStatements: string[], label: string): Promise<void> {
  if (sqlStatements.length === 0) return;

  let batch: string[] = [];
  let batchBytes = 0;
  let batchIndex = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    batchIndex += 1;
    const sql = batch.join('\n');
    console.log(`📦 ${label} batch ${batchIndex}: ${batch.length} statements`);
    await queryD1(sql);
    batch = [];
    batchBytes = 0;
  };

  for (const statement of sqlStatements) {
    const statementBytes = byteLength(statement);
    const wouldOverflow = batch.length >= BATCH_MAX_STATEMENTS || batchBytes + statementBytes > BATCH_MAX_BYTES;

    if (wouldOverflow) {
      await flush();
    }

    batch.push(statement);
    batchBytes += statementBytes;
  }

  await flush();
}

async function main() {
  if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
    console.warn(
      '⚠️ Skip D1 delta sync: missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_D1_DATABASE_ID.',
    );
    process.exit(0);
  }

  const localSkills = loadLocalSkills();
  const localMap = new Map<string, SkillCache>();
  for (const rawSkill of localSkills) {
    const skill = toPublicSkill(rawSkill);
    if (skill?.id) localMap.set(skill.id, skill);
  }

  console.log(`📚 Loaded local skills: ${localMap.size}`);
  const remotePayload = await queryD1('SELECT id, content_hash FROM skills;');
  const remoteRows = extractRows(remotePayload);
  const remoteMap = new Map(remoteRows.map((row) => [row.id, row.content_hash || '']));
  console.log(`☁️ Loaded remote skills: ${remoteMap.size}`);

  const upsertStatements: string[] = [];
  const deleteStatements: string[] = [];
  let skippedOversize = 0;

  for (const [id, skill] of localMap.entries()) {
    const currentHash = remoteMap.get(id) || '';
    const { json: rawJson } = shrinkSkillForSql(skill);
    const expectedHash = normalizeContentHash(skill, rawJson);

    if (currentHash !== expectedHash) {
      const { sql, skipped } = buildUpsertStatement(skill);
      if (skipped) {
        skippedOversize += 1;
      } else {
        upsertStatements.push(sql);
      }
    }
  }

  for (const id of remoteMap.keys()) {
    if (!localMap.has(id)) {
      deleteStatements.push(buildDeleteStatement(id));
    }
  }

  console.log(`🔁 Pending upserts: ${upsertStatements.length}`);
  console.log(`🧹 Pending deletes: ${deleteStatements.length}`);
  if (skippedOversize > 0) {
    console.warn(`⚠️ Skipped oversized skills: ${skippedOversize}`);
  }

  if (upsertStatements.length === 0 && deleteStatements.length === 0) {
    console.log('✅ D1 delta sync is already up to date.');
    return;
  }

  await queryD1(
    "CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(id UNINDEXED, name, owner, repo, category, search_text, tokenize='unicode61 remove_diacritics 1');",
  );

  await runBatches(upsertStatements, 'upsert');
  await runBatches(deleteStatements, 'delete');

  console.log('✅ D1 delta sync completed successfully.');
}

main().catch((error) => {
  console.error(`❌ D1 delta sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
