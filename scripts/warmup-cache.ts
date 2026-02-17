#!/usr/bin/env node
/**
 * 缓存预热脚本
 * 批量将所有技能的 SKILL.md 内容写入 Cloudflare KV
 * 
 * 使用方法：
 * 1. 确保已设置 CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ACCOUNT_ID 环境变量
 * 2. 运行: npx ts-node scripts/warmup-cache.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchSkillMd } from './lib/github';

// KV 命名空间 ID
const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5';

// Cloudflare API 配置
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    console.error('❌ 请设置环境变量: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID');
    process.exit(1);
}

interface Skill {
    owner: string;
    repo: string;
    skillMdContent?: string;
    description?: string;
}

/**
 * 写入单个 KV 键值
 */
async function writeToKV(key: string, value: string): Promise<boolean> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'text/plain',
            },
            body: value,
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ 写入失败 ${key}: ${error}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`❌ 网络错误 ${key}:`, error);
        return false;
    }
}

/**
 * 批量写入 KV
 */
async function batchWriteToKV(entries: Array<{ key: string; value: string }>): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;

    // Cloudflare 限制每批最多 10000 个，每个值最大 25MB
    const BATCH_SIZE = 100;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE).map(e => ({
            key: e.key,
            value: e.value,
            expiration_ttl: 60 * 60 * 24 * 7, // 7 天
        }));

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batch),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ 批量写入失败 (${i}-${i + batch.length}): ${error}`);
            } else {
                console.log(`✅ 已写入 ${i + 1} - ${i + batch.length} / ${entries.length}`);
            }
        } catch (error) {
            console.error(`❌ 批量写入网络错误:`, error);
        }

        // 避免速率限制
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}


/**
 * 主函数
 */
async function main() {
    console.log('🚀 开始缓存预热...\n');

    // 读取技能列表
    const dataDir = path.join(__dirname, '../data');
    const skillsFiles = [
        'verified-skills.json',
        'skills-cache.json',
    ];

    const allSkills: Skill[] = [];

    for (const file of skillsFiles) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                const skills = Array.isArray(data) ? data : (data.skills || []);

                for (const skill of skills) {
                    if (skill.owner && skill.repo) {
                        allSkills.push({
                            owner: skill.owner,
                            repo: skill.repo,
                        });
                    } else if (skill.repoPath) {
                        const [owner, repo] = skill.repoPath.split('/');
                        if (owner && repo) {
                            allSkills.push({ owner, repo });
                        }
                    }
                }
            } catch (error) {
                console.error(`⚠️ 无法读取 ${file}:`, error);
            }
        }
    }

    // 去重
    const uniqueSkills = Array.from(
        new Map(allSkills.map(s => [`${s.owner}/${s.repo}`, s])).values()
    );

    console.log(`📦 共发现 ${uniqueSkills.length} 个技能\n`);

    // 获取并写入每个技能的 SKILL.md
    const entries: Array<{ key: string; value: string }> = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uniqueSkills.length; i++) {
        const skill = uniqueSkills[i];
        const key = `skill:${skill.owner}/${skill.repo}`;

        process.stdout.write(`\r⏳ 处理中: ${i + 1}/${uniqueSkills.length} (${skill.owner}/${skill.repo})...`);

        const content = await fetchSkillMd(skill.owner, skill.repo, '');
        if (content) {
            entries.push({ key, value: JSON.stringify(content) });
            successCount++;
        } else {
            failCount++;
        }

        // 避免 GitHub 速率限制
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n\n📊 抓取完成: 成功 ${successCount}, 失败 ${failCount}`);

    if (entries.length > 0) {
        console.log(`\n📤 开始写入 Cloudflare KV...`);
        await batchWriteToKV(entries);
        console.log(`\n✅ 缓存预热完成!`);
    } else {
        console.log(`\n⚠️ 没有内容需要写入`);
    }
}

main().catch(console.error);
