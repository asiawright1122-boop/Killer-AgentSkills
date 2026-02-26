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

    // We can chunk them if we want, but D1 remote execute accepts batch files
    // Wait, D1 execute --remote will fail if the file is too large (e.g. 50MB) with D1_RESET_DO error.
    // So we definitely need to chunk it.
    let chunkIndex = 0;
    let currentChunkSql = '';
    const CHUNK_SIZE = 200; // 200 records per file (~5MB each)

    // 清理旧的 sql 种子文件
    const seedsDir = path.dirname(OUT_FILE);
    fs.readdirSync(seedsDir).forEach(file => {
        if (file.startsWith('initial_') && file.endsWith('.sql')) {
            fs.unlinkSync(path.join(seedsDir, file));
        }
    });

    const commands: string[] = [];

    for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const id = escapeSql(skill.id);
        const category = escapeSql(skill.category || 'community');
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
        // D1 per-statement limit is ~1MB. Truncate skillMd.body for oversized rows.
        const MAX_STATEMENT_BYTES = 900_000; // 900KB safety margin
        let skillCopy = skill;
        let rawJson = JSON.stringify(skill);

        if (rawJson.length > MAX_STATEMENT_BYTES && skill.skillMd?.body) {
            skillCopy = { ...skill, skillMd: { ...skill.skillMd, body: skill.skillMd.bodyPreview || skill.skillMd.body.slice(0, 500) } };
            rawJson = JSON.stringify(skillCopy);
            console.warn(`⚠️ Truncated body for ${skill.id} (${(rawJson.length / 1024).toFixed(0)}KB)`);
        }

        const data_json = escapeSql(rawJson);
        const statement = `INSERT OR REPLACE INTO skills (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) VALUES (${id}, ${category}, ${owner}, ${repo}, ${repo_path}, ${name}, ${stars}, ${forks}, ${quality_score}, ${updated_at}, ${last_synced}, ${content_hash}, ${data_json});\n`;

        if (statement.length > MAX_STATEMENT_BYTES) {
            console.warn(`⚠️ Skipped ${skill.id} — still too large after truncation (${(statement.length / 1024).toFixed(0)}KB)`);
            continue;
        }

        currentChunkSql += statement;

        if ((i + 1) % CHUNK_SIZE === 0 || i === skills.length - 1) {
            const chunkFile = path.join(seedsDir, `initial_${chunkIndex}.sql`);
            fs.writeFileSync(chunkFile, currentChunkSql, 'utf-8');
            commands.push(`npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial_${chunkIndex}.sql`);
            console.log(`✅ 成功生成 db/seeds/initial_${chunkIndex}.sql (${(fs.statSync(chunkFile).size / 1024 / 1024).toFixed(2)} MB)`);
            currentChunkSql = '';
            chunkIndex++;
        }
    }

    console.log(`👉 您可以使用以下命令推送到线上 D1 数据库:`);
    const runAllScript = path.join(process.cwd(), 'scripts', 'run-d1-seeds.sh');
    // 容错模式：每个 seed 文件独立执行，一个失败不影响其他
    const seedLines = commands.map((cmd, i) =>
        `echo "🌀 Executing seed ${i}/${commands.length - 1}..."\nif ${cmd}; then\n  SUCCESS=$((SUCCESS + 1))\nelse\n  FAILED=$((FAILED + 1))\n  echo "⚠️ Seed ${i} failed, continuing..."\nfi`
    ).join('\n\n');
    const shellScriptContent = `#!/bin/bash\n\nSUCCESS=0\nFAILED=0\n\n${seedLines}\n\necho ""\necho "📊 D1 Seed Results: $SUCCESS succeeded, $FAILED failed (total: ${commands.length})"\n\nif [ "$FAILED" -gt 0 ]; then\n  echo "⚠️ Some seeds failed, but $SUCCESS/${commands.length} were applied successfully"\n  exit 1\nfi\n\necho "✅ All ${commands.length} seeds executed successfully!"\n`;
    fs.writeFileSync(runAllScript, shellScriptContent, 'utf-8');
    fs.chmodSync(runAllScript, '755');
    console.log(`或者直接运行生成的脚本：`);
    console.log(`./scripts/run-d1-seeds.sh`);
}

run().catch(console.error);
