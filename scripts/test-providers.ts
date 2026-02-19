/**
 * 🔬 Systematic Provider Verification Script
 * Tests each AI provider individually with raw fetch calls.
 * No wrappers, no fallbacks — pure connectivity test.
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });

const SIMPLE_PROMPT = 'Reply with exactly: {"test":"ok"}';
const TIMEOUT_MS = 30000; // 30s per provider

interface TestResult {
    provider: string;
    status: 'OK' | 'FAIL';
    httpStatus?: number;
    latencyMs: number;
    response?: string;
    error?: string;
}

async function fetchWithAbort(url: string, options: any, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

async function testProvider(name: string, url: string, headers: Record<string, string>, body: any): Promise<TestResult> {
    const start = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Model: ${body.model || '(in URL)'}`);
    console.log(`   Body size: ${JSON.stringify(body).length} bytes`);

    try {
        const res = await fetchWithAbort(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        }, TIMEOUT_MS);

        const latency = Date.now() - start;
        const text = await res.text();

        console.log(`   HTTP Status: ${res.status}`);
        console.log(`   Latency: ${latency}ms`);
        console.log(`   Response (first 500 chars):`);
        console.log(`   ${text.slice(0, 500)}`);

        if (!res.ok) {
            return { provider: name, status: 'FAIL', httpStatus: res.status, latencyMs: latency, error: text.slice(0, 300) };
        }

        // Try to parse and extract content
        try {
            const json = JSON.parse(text);
            const content = json?.choices?.[0]?.message?.content || json?.result?.response || '(no content field)';
            console.log(`   ✅ Parsed content: ${String(content).slice(0, 200)}`);
            return { provider: name, status: 'OK', httpStatus: res.status, latencyMs: latency, response: String(content).slice(0, 200) };
        } catch {
            console.log(`   ⚠️ JSON parse failed, raw response logged above`);
            return { provider: name, status: 'OK', httpStatus: res.status, latencyMs: latency, response: text.slice(0, 200) };
        }
    } catch (e: any) {
        const latency = Date.now() - start;
        console.log(`   ❌ Error: ${e.message}`);
        console.log(`   Latency: ${latency}ms`);
        return { provider: name, status: 'FAIL', latencyMs: latency, error: e.message };
    }
}

async function main() {
    console.log('🔬 AI Provider Systematic Verification');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`   Timeout per provider: ${TIMEOUT_MS}ms`);

    // Load keys
    const nvidiaKeys = (process.env.NVIDIA_API_KEYS || '').split(',').filter(Boolean);
    const sfKey = process.env.SILICONFLOW_API_KEY || '';
    const orKeys = (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').split(',').filter(Boolean);
    const orKey = orKeys[0] || '';
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    const cfToken = process.env.CLOUDFLARE_API_TOKEN || '';

    console.log(`\n📋 Key Availability:`);
    console.log(`   NVIDIA keys: ${nvidiaKeys.length} (${nvidiaKeys.map((k, i) => `Key${i}: ${k.slice(0, 8)}...`).join(', ')})`);
    console.log(`   SiliconFlow: ${sfKey ? sfKey.slice(0, 8) + '...' : '❌ MISSING'}`);
    console.log(`   OpenRouter: ${orKey ? orKey.slice(0, 8) + '...' : '❌ MISSING'}`);
    console.log(`   Cloudflare: Account=${cfAccountId ? cfAccountId.slice(0, 8) + '...' : '❌ MISSING'}, Token=${cfToken ? cfToken.slice(0, 8) + '...' : '❌ MISSING'}`);

    const results: TestResult[] = [];

    // 1. Test ALL NVIDIA keys
    for (let i = 0; i < nvidiaKeys.length; i++) {
        const key = nvidiaKeys[i].trim();
        const result = await testProvider(
            `NVIDIA Key-${i}`,
            'https://integrate.api.nvidia.com/v1/chat/completions',
            { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            {
                model: 'deepseek-ai/deepseek-v3.1',
                messages: [{ role: 'user', content: SIMPLE_PROMPT }],
                temperature: 0.1,
                max_tokens: 50,
                stream: false
            }
        );
        results.push(result);
    }

    // 2. Test SiliconFlow
    if (sfKey) {
        const result = await testProvider(
            'SiliconFlow',
            'https://api.siliconflow.cn/v1/chat/completions',
            { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sfKey}` },
            {
                model: 'deepseek-ai/DeepSeek-V3',
                messages: [{ role: 'user', content: SIMPLE_PROMPT }],
                temperature: 0.1,
                max_tokens: 50,
                stream: false
            }
        );
        results.push(result);
    }

    // 3. Test OpenRouter
    if (orKey) {
        const result = await testProvider(
            'OpenRouter',
            'https://openrouter.ai/api/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${orKey}`,
                'HTTP-Referer': 'https://killerskills.com',
                'X-Title': 'Killer-Skills Translation'
            },
            {
                model: 'google/gemma-3-27b-it:free',
                messages: [{ role: 'user', content: SIMPLE_PROMPT }],
                temperature: 0.1,
                max_tokens: 50
            }
        );
        results.push(result);
    }

    // 4. Test Cloudflare Workers AI
    if (cfAccountId && cfToken) {
        const result = await testProvider(
            'Cloudflare Workers AI',
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
            { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfToken}` },
            {
                messages: [{ role: 'user', content: SIMPLE_PROMPT }],
                max_tokens: 50
            }
        );
        results.push(result);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(60)}`);
    for (const r of results) {
        const icon = r.status === 'OK' ? '✅' : '❌';
        console.log(`${icon} ${r.provider.padEnd(25)} | ${r.status.padEnd(4)} | ${r.latencyMs}ms | ${r.status === 'OK' ? r.response?.slice(0, 60) : r.error?.slice(0, 60)}`);
    }

    const okCount = results.filter(r => r.status === 'OK').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n🏁 Results: ${okCount} OK, ${failCount} FAIL out of ${results.length} tests`);
}

main().catch(console.error);
