#!/usr/bin/env npx tsx
/**
 * Cloudflare D1 Native Sync 脚本
 * 绕过 Wrangler CLI 的 Node 25 FileHandle bug，使用 better-sqlite3 直接写入底层存储
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import Database from 'better-sqlite3';
import type { SkillCache } from './lib/types';

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');
const D1_LOCAL_PATH = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '02cc3c83ed26a12138794a4570de1d5ac3a534f7193ab217c6b875b33b3364b0.sqlite');

async function run() {
    console.log('🚀 开始将本地数据以 Native SQLite 事务扁平化注入 D1 ...');

    if (!fs.existsSync(CACHE_FILE)) {
        console.error('❌ 找不到 skills-cache.json 数据文件');
        process.exit(1);
    }
    if (!fs.existsSync(D1_LOCAL_PATH)) {
        console.error('❌ 找不到本地 D1 数据库。请先跑: npx wrangler d1 execute killer-skills-db --local --command="SELECT 1"');
        process.exit(1);
    }

    const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(rawData);
    const skills = cache.skills as SkillCache[];

    console.log(`📚 加载了 ${skills.length} 个本地 Skill 对象`);

    const db = new Database(D1_LOCAL_PATH);
    // SQLite performance optimizations for mass inserts
    db.pragma('journal_mode = WAL');

    const insert = db.prepare(`
        INSERT OR REPLACE INTO skills 
        (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: SkillCache[]) => {
        let count = 0;
        for (const skill of items) {
            insert.run(
                skill.id,
                skill.category || 'developer',
                skill.owner,
                skill.repo,
                skill.repoPath || '',
                skill.name,
                skill.stars || 0,
                skill.forks || 0,
                skill.qualityScore || 0,
                skill.updatedAt,
                skill.lastSynced,
                skill.contentHash || '',
                JSON.stringify(skill)
            );
            count++;
        }
        return count;
    });

    console.log(`⏳ 正在通过 better-sqlite3 批量高并发写入...`);

    const startTime = Date.now();
    try {
        const totalSaved = insertMany(skills);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 极其迅速地同步完成！耗时 ${duration}秒，成功将 ${totalSaved}/${skills.length} 个技能原生索引到本地 D1！`);
    } catch (e) {
        console.error('❌ 发生了 SQLite 引擎写入错误: ', e);
    }

    db.close();
}

run().catch(console.error);
