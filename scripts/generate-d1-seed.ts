#!/usr/bin/env npx tsx
/**
 * D1 Seed SQL 生成器
 * 用于提取 7000+ KV JSON 字典，并转换为标准的 SQL 文件，方便生产环境初始部署！
 *
 * 运行方式: npx tsx scripts/generate-d1-seed.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillCache } from './lib/types';

const MAX_STATEMENT_BYTES = 180_000;
const MAX_FILE_BYTES = 900_000;
const MAX_SEARCH_TEXT_CHARS = 4_000;

function escapeSql(str: string | undefined | null): string {
  if (str === undefined || str === null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  return String(num);
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');
const OUT_FILE = path.join(process.cwd(), 'db', 'seeds', 'initial.sql');

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function cloneSkill<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildSearchText(
  skill: SkillCache,
  id: string,
  name: string,
  owner: string,
  repo: string,
  category: string,
): string {
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
  const searchTextRaw = searchArr.filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, MAX_SEARCH_TEXT_CHARS);
  const searchText = escapeSql(searchTextRaw);
  return `DELETE FROM skills_fts WHERE id = ${id};\nINSERT INTO skills_fts (id, name, owner, repo, category, search_text) VALUES (${id}, ${name}, ${owner}, ${repo}, ${category}, ${searchText});\n`;
}

function shrinkSkillForSeed(skill: SkillCache): { json: string; reduced: boolean } {
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

async function run() {
  console.log('📦 开始生成 D1 初始化种子 SQL 文件...');

  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ 找不到 skills-cache.json 数据文件');
    process.exit(1);
  }

  // Ensure dir
  if (!fs.existsSync(path.dirname(OUT_FILE))) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  }

  const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
  const cache = JSON.parse(rawData);
  const skills = cache.skills as SkillCache[];

  console.log(`载入了 ${skills.length} 个缓存条目`);

  let chunkIndex = 0;
  let currentChunkSql = '';
  let currentChunkBytes = 0;

  // 清理旧的 sql 种子文件
  const seedsDir = path.dirname(OUT_FILE);
  fs.readdirSync(seedsDir).forEach((file) => {
    if (file.startsWith('initial_') && file.endsWith('.sql')) {
      fs.unlinkSync(path.join(seedsDir, file));
    }
  });

  const commands: string[] = [];

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const id = escapeSql(skill.id);
    const category = escapeSql(skill.category || 'developer');
    const owner = escapeSql(skill.owner);
    const repo = escapeSql(skill.repo);
    const repo_path = escapeSql(skill.repoPath || '');
    const name = escapeSql(skill.name);
    const stars = escapeNumber(skill.stars);
    const forks = escapeNumber(skill.forks);
    const quality_score = escapeNumber(skill.qualityScore);
    const updated_at = escapeSql(skill.updatedAt);
    const last_synced = escapeSql(skill.lastSynced);
    const content_hash = escapeSql(skill.contentHash);
    const { json: rawJson, reduced } = shrinkSkillForSeed(skill);
    const data_json = escapeSql(rawJson);
    const statement = `INSERT OR REPLACE INTO skills (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) VALUES (${id}, ${category}, ${owner}, ${repo}, ${repo_path}, ${name}, ${stars}, ${forks}, ${quality_score}, ${updated_at}, ${last_synced}, ${content_hash}, ${data_json});\n`;
    const ftsStatement = buildSearchText(skill, id, name, owner, repo, category);
    const combinedStatement = statement + ftsStatement;

    if (reduced) {
      console.warn(`⚠️ Reduced oversized payload for ${skill.id} (${(byteLength(rawJson) / 1024).toFixed(0)}KB JSON)`);
    }

    if (byteLength(combinedStatement) > MAX_STATEMENT_BYTES) {
      console.warn(
        `⚠️ Skipped ${skill.id} — statement still too large after reduction (${(byteLength(combinedStatement) / 1024).toFixed(0)}KB)`,
      );
      continue;
    }

    if (currentChunkSql && currentChunkBytes + byteLength(combinedStatement) > MAX_FILE_BYTES) {
      const chunkFile = path.join(seedsDir, `initial_${chunkIndex}.sql`);
      fs.writeFileSync(chunkFile, currentChunkSql, 'utf-8');
      commands.push(`npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_${chunkIndex}.sql`);
      console.log(
        `✅ 成功生成 db/seeds/initial_${chunkIndex}.sql (${(fs.statSync(chunkFile).size / 1024 / 1024).toFixed(2)} MB)`,
      );
      currentChunkSql = '';
      currentChunkBytes = 0;
      chunkIndex++;
    }

    currentChunkSql += combinedStatement;
    currentChunkBytes += byteLength(combinedStatement);

    if (i === skills.length - 1 && currentChunkSql) {
      const chunkFile = path.join(seedsDir, `initial_${chunkIndex}.sql`);
      fs.writeFileSync(chunkFile, currentChunkSql, 'utf-8');
      commands.push(`npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_${chunkIndex}.sql`);
      console.log(
        `✅ 成功生成 db/seeds/initial_${chunkIndex}.sql (${(fs.statSync(chunkFile).size / 1024 / 1024).toFixed(2)} MB)`,
      );
      currentChunkSql = '';
      currentChunkBytes = 0;
      chunkIndex++;
    }
  }

  console.log(`👉 您可以使用以下命令推送到线上 D1 数据库:`);
  const runAllScript = path.join(process.cwd(), 'scripts', 'run-d1-seeds.sh');
  // 容错模式：每个 seed 文件独立执行，一个失败不影响其他
  const seedLines = commands.map((cmd, i) => `run_seed ${i} "${cmd.replace(/"/g, '\\"')}"`).join('\n');

  const shellScriptContent = `#!/bin/bash

set -u

retryable_error() {
  local output="$1"
  [[ "$output" == *"D1_RESET_DO"* ]] || [[ "$output" == *"Not currently importing anything."* ]]
}

run_seed() {
  local index="$1"
  local cmd="$2"
  local attempt=1
  local max_attempts=3

  echo "🌀 Executing seed \${index}/\${TOTAL_SEEDS}..."

  while [ "$attempt" -le "$max_attempts" ]; do
    local output
    if output=$(eval "$cmd" 2>&1); then
      echo "$output"
      SUCCESS=$((SUCCESS + 1))
      return 0
    fi

    echo "$output"
    if retryable_error "$output" && [ "$attempt" -lt "$max_attempts" ]; then
      echo "⚠️ Seed ${'${index}'} hit a transient D1 import error on attempt ${'${attempt}'}, retrying..."
      sleep $((attempt * 5))
      attempt=$((attempt + 1))
      continue
    fi

    FAILED=$((FAILED + 1))
    echo "⚠️ Seed ${'${index}'} failed after ${'${attempt}'} attempt(s), continuing..."
    return 1
  done
}

echo "🛠️ Initializing FTS5 Virtual Table..."
npx wrangler d1 execute killer-skills-db --remote --command="CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(id UNINDEXED, name, owner, repo, category, search_text, tokenize='unicode61 remove_diacritics 1');"

SUCCESS=0
FAILED=0
TOTAL_SEEDS=${commands.length - 1}

${seedLines}

echo ""
echo "📊 D1 Seed Results: $SUCCESS succeeded, $FAILED failed (total: ${commands.length})"

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ Some seeds failed, but $SUCCESS/${commands.length} were applied successfully"
  exit 1
fi

echo "✅ All ${commands.length} seeds executed successfully!"
`;
  fs.writeFileSync(runAllScript, shellScriptContent, 'utf-8');
  fs.chmodSync(runAllScript, '755');
  console.log(`或者直接运行生成的脚本：`);
  console.log(`./scripts/run-d1-seeds.sh`);
}

run().catch(console.error);
