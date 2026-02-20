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
    let sqlContent = '';

    for (const skill of skills) {
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
        const data_json = escapeSql(JSON.stringify(skill));

        sqlContent += `INSERT OR REPLACE INTO skills (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) VALUES (${id}, ${category}, ${owner}, ${repo}, ${repo_path}, ${name}, ${stars}, ${forks}, ${quality_score}, ${updated_at}, ${last_synced}, ${content_hash}, ${data_json});\n`;
    }

    fs.writeFileSync(OUT_FILE, sqlContent, 'utf-8');

    console.log(`✅ 成功生成 db/seeds/initial.sql (${(fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`👉 您可以使用以下命令推送到线上 D1 数据库:`);
    console.log(`npx wrangler d1 execute killer-skills-db --remote --file=db/seeds/initial.sql`);
}

run().catch(console.error);
