#!/usr/bin/env npx tsx
/**
 * UI Translation Script
 * 
 * 自动对比 src/messages/en.json 和其他语言文件
 * 对缺失的 Key 调用 AI 进行翻译
 */

import * as fs from 'fs';
import * as path from 'path';
// import { fileURLToPath } from 'url';
import { AIService } from './lib/ai';
import { SUPPORTED_LOCALES } from './lib/constants';

// 配置
const MESSAGES_DIR = path.join(process.cwd(), 'src/messages');

// AI Service
const aiService = new AIService();

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
    const prompt = `You are an SEO Localization Expert for Killer-Skills — a directory and installation platform for AI Agent Skills. Users install skills into IDEs like Cursor, Claude Code, Windsurf, and VS Code to enhance their AI coding assistants.

Translate the following UI text from English to ${targetLang}.
Context key: ${context}

Original: "${text}"

## RULES:
1. **SEO Optimization**: Use keywords that users in ${targetLang} actually search for in the AI agent tools and developer workflow space.
2. **Site Theme**: This is for an AI Agent Skills marketplace. Keep translations relevant to: AI agents, skills, workflows, IDE integrations, MCP servers, developer tools.
3. **Length Constraint**: Keep the translation length close to the original to avoid UI breakage or SERP truncation.
4. **Tone**: Professional, technical, yet accessible.
5. **Brand Terms**: Keep "Killer-Skills", "Claude Code", "Cursor", "Windsurf", "MCP" untranslated.
6. **No Fluff**: Do not explain. Return ONLY the translated text.

Reply ONLY with the translated text.`;

    const response = await aiService.callAI(prompt);
    return response?.trim() || text;
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
