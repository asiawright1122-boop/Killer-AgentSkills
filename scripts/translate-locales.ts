#!/usr/bin/env npx tsx
/**
 * UI Translation Script
 * 
 * 自动对比 src/messages/en.json 和其他语言文件
 * 对缺失的 Key 调用 AI 进行翻译
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 配置
const MESSAGES_DIR = path.join(process.cwd(), 'src/messages');
const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

// AI 配置
const NVIDIA_API_KEYS = (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || '').split(',').filter(Boolean);
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface Messages {
    [key: string]: string | Messages;
}

// 扁平化 JSON 对象以便比较 keys
function flattenKeys(obj: Messages, prefix = ''): Record<string, string> {
    let result: Record<string, string> = {};
    for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
            Object.assign(result, flattenKeys(value, newKey));
        } else {
            result[newKey] = value as string;
        }
    }
    return result;
}

// 还原扁平化的 Key 到嵌套对象
function unflattenKeys(flatObj: Record<string, string>): Messages {
    const result: any = {};
    for (const key in flatObj) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;

            if (isLast) {
                current[part] = flatObj[key];
            } else {
                const nextPart = parts[i + 1];
                const isArray = /^\d+$/.test(nextPart);

                if (!current[part]) {
                    current[part] = isArray ? [] : {};
                }

                current = current[part];
            }
        }
    }
    return result;
}

// 调用 AI 翻译
async function translateText(text: string, targetLang: string, context: string): Promise<string> {
    const prompt = `Translate the following UI text from English to ${targetLang}.
Context: ${context}
Original: "${text}"

Reply ONLY with the translated text. Do not include quotes or explanations.`;

    // 1. 尝试 NVIDIA
    for (const key of NVIDIA_API_KEYS) {
        try {
            const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: 'meta/llama-3.1-70b-instruct',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 1024
                })
            });
            if (response.ok) {
                const data = await response.json() as any;
                return data.choices[0]?.message?.content?.trim() || text;
            }
        } catch (e) {
            continue;
        }
    }

    // 2. 尝试 Cloudflare Workers AI
    if (CF_ACCOUNT_ID && CF_API_TOKEN) {
        try {
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            if (response.ok) {
                const data = await response.json() as any;
                return data.result?.response?.trim() || text;
            }
        } catch (e) {
            console.error('Cloudflare AI failed:', e);
        }
    }

    // 3. 失败返回原文
    console.warn(`Translation failed for "${text}" to ${targetLang}`);
    return text;
}

async function main() {
    console.log('🚀 Starting UI Translation...');

    // 1. 读取基准 (English)
    const enPath = path.join(MESSAGES_DIR, 'en.json');
    if (!fs.existsSync(enPath)) {
        console.error('❌ Base locale (en.json) not found!');
        process.exit(1);
    }
    const enMessages = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const flatEn = flattenKeys(enMessages);

    // 2. 遍历其他语言
    for (const locale of SUPPORTED_LOCALES) {
        if (locale === 'en') continue;

        console.log(`\nChecking locale: ${locale}...`);
        const localePath = path.join(MESSAGES_DIR, `${locale}.json`);

        let existingMessages = {};
        if (fs.existsSync(localePath)) {
            existingMessages = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
        }

        const flatExisting = flattenKeys(existingMessages);
        const missingKeys: string[] = [];

        // 找出缺失的 Key
        for (const key in flatEn) {
            if (!flatExisting[key]) {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length === 0) {
            console.log(`✅ ${locale} is up to date.`);
            continue;
        }

        console.log(`📝 Found ${missingKeys.length} missing keys in ${locale}. Translating...`);

        // 逐个翻译
        let translatedCount = 0;
        for (const key of missingKeys) {
            const originalText = flatEn[key];
            const translatedText = await translateText(originalText, locale, key);

            flatExisting[key] = translatedText;
            process.stdout.write('.');
            translatedCount++;
        }

        // 保存文件
        const newMessages = unflattenKeys(flatExisting);
        fs.writeFileSync(localePath, JSON.stringify(newMessages, null, 2));
        console.log(`\n🎉 Updated ${locale}.json`);
    }

    console.log('\n✨ All translations updated!');
}

main().catch(console.error);
