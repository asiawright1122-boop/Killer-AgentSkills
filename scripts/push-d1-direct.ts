#!/usr/bin/env npx tsx
/**
 * D1 直接 HTTP API 推送脚本
 * 绕过 Wrangler CLI 的 Node.js v25 FileHandle Bug
 * 
 * 需要环境变量:
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_D1_TOKEN (有 D1 edit 权限的 API Token，或通过 OAuth)
 */
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import * as dotenv from 'dotenv';

// Also load .env.local
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = 'b20fd9ef-6628-4a78-abd0-59aac064b5d6';
const SQL_FILE = path.join(process.cwd(), 'db', 'seeds', 'initial.sql');

const BATCH_SIZE = 5; // small batches to avoid SQLITE_TOOBIG on large data_json rows

async function run() {
    if (!ACCOUNT_ID || !API_TOKEN) {
        console.error('❌ 需要 CLOUDFLARE_ACCOUNT_ID 和 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_D1_TOKEN');
        process.exit(1);
    }

    if (!fs.existsSync(SQL_FILE)) {
        console.error('❌ 找不到 SQL 文件:', SQL_FILE);
        process.exit(1);
    }

    const content = fs.readFileSync(SQL_FILE, 'utf-8');
    const statements = content.split('\n').filter(line => line.trim().length > 0);

    console.log(`📦 加载了 ${statements.length} 条 SQL 语句`);
    console.log(`📡 目标 D1: ${DATABASE_ID}`);
    console.log(`🔄 批次大小: ${BATCH_SIZE}\n`);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        const batch = statements.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(statements.length / BATCH_SIZE);

        process.stdout.write(`  批次 ${batchNum}/${totalBatches} (${batch.length} 条)...`);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sql: batch.join('\n'),
                }),
            });

            const result = await response.json() as any;

            if (result.success) {
                totalSuccess += batch.length;
                console.log(` ✅`);
            } else {
                totalFailed += batch.length;
                console.log(` ❌ ${result.errors?.[0]?.message || 'Unknown error'}`);
                // Don't stop on individual batch failures
            }
        } catch (err: any) {
            totalFailed += batch.length;
            console.log(` ❌ ${err.message}`);
        }

        // Small delay to avoid rate limiting
        if (i + BATCH_SIZE < statements.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log(`\n🏁 完成! 成功: ${totalSuccess}, 失败: ${totalFailed}`);

    if (totalFailed > 0) {
        process.exit(1);
    }
}

run().catch(console.error);
