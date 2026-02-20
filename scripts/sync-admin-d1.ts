#!/usr/bin/env npx tsx
/**
 * Cloudflare D1 Serverless 单记录精准同步脚本 (Webhook Pipeline 专用)
 * 将 `data/skills-cache.json` 中单一更新的记录通过 HTTP 代理强行刷新至远端 (Production) D1
 * 
 * 使用方法：
 * npx tsx scripts/sync-admin-d1.ts --target=owner/repo
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';
import type { SkillCache } from './lib/types';

// Parse CLI args
const args = process.argv.slice(2);
let targetRepo = '';

for (const arg of args) {
    if (arg.startsWith('--target=')) {
        targetRepo = arg.split('=')[1]!.trim();
    }
}

if (!targetRepo) {
    console.error('❌ Missing --target argument');
    process.exit(1);
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');

function escapeSql(str: string | undefined | null): string {
    if (str === undefined || str === null) return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeNumber(num: number | undefined | null): string {
    if (num === undefined || num === null) return '0';
    return String(num);
}

async function run() {
    console.log(`🚀 启动极速 D1 生产同步任务: 目标 [${targetRepo}]`);

    if (!fs.existsSync(CACHE_FILE)) {
        console.error('❌ 找不到 skills-cache.json 数据文件');
        process.exit(1);
    }

    const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(rawData);
    const skills = cache.skills as SkillCache[];

    const targetSkill = skills.find(s => `${s.owner}/${s.repo}`.toLowerCase() === targetRepo.toLowerCase());

    if (!targetSkill) {
        console.warn(`⚠️ 本地字典中未找到对应的 targetRepo: ${targetRepo}，可能已删除`);
        return;
    }

    // Prepare singular SQL statement
    const d1SqlPath = path.join(process.cwd(), 'db', 'seeds', `hotfix_${targetRepo.replace('/', '_')}.sql`);

    // Ensure dir
    if (!fs.existsSync(path.dirname(d1SqlPath))) {
        fs.mkdirSync(path.dirname(d1SqlPath), { recursive: true });
    }

    const id = escapeSql(targetSkill.id);
    const category = escapeSql(targetSkill.category || 'community');
    const owner = escapeSql(targetSkill.owner);
    const repo = escapeSql(targetSkill.repo);
    const repo_path = escapeSql(targetSkill.repoPath || '');
    const name = escapeSql(targetSkill.name);
    const stars = escapeNumber(targetSkill.stars);
    const forks = escapeNumber(targetSkill.forks);
    const quality_score = escapeNumber(targetSkill.qualityScore);
    const updated_at = escapeSql(targetSkill.updatedAt);
    const last_synced = escapeSql(targetSkill.lastSynced);
    const content_hash = escapeSql(targetSkill.contentHash);
    const data_json = escapeSql(JSON.stringify(targetSkill));

    const sqlContent = `INSERT OR REPLACE INTO skills (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) VALUES (${id}, ${category}, ${owner}, ${repo}, ${repo_path}, ${name}, ${stars}, ${forks}, ${quality_score}, ${updated_at}, ${last_synced}, ${content_hash}, ${data_json});\n`;

    fs.writeFileSync(d1SqlPath, sqlContent, 'utf-8');

    console.log(`📡 正在调用 Wrangler 将配置推送至 Production Cloudflare D1...`);

    try {
        // Run remote SQL sync targeting production D1 instance securely!
        execSync(`npx wrangler d1 execute killer-skills-db --remote --file="${d1SqlPath}"`, {
            stdio: 'inherit'
        });
        console.log(`🎉 云端同步完成！生产 D1 已实时载入最新记录.`);
    } catch (e: any) {
        console.error(`❌ 远端 D1 同步失败:`);
        console.error(e.stderr?.toString() || e.message);
        process.exit(1);
    }

    // Cleanup hotfix file
    if (fs.existsSync(d1SqlPath)) {
        fs.unlinkSync(d1SqlPath);
    }
}

run().catch(console.error);
