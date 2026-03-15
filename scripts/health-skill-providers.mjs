import fs from 'node:fs';
import dotenv from 'dotenv';

if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });

const TIMEOUT_MS = 20_000;
const PROMPT = 'Reply with exactly: {"health":"ok"}';

function splitKeys(raw = '') {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function timeoutFetch(url, options, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function testProvider(name, url, headers, body) {
  const startedAt = Date.now();
  try {
    const response = await timeoutFetch(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      TIMEOUT_MS,
    );
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      return {
        provider: name,
        ok: false,
        status: response.status,
        latencyMs,
        error: text.slice(0, 240),
      };
    }

    return {
      provider: name,
      ok: true,
      status: response.status,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      provider: name,
      ok: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const nvidiaKeys = splitKeys(
    [process.env.NVIDIA_API_KEYS, process.env.NVIDIA_API_KEY, process.env.NVIDIA_API_KEYS_2, process.env.NVIDIA_API_KEYS_3]
      .filter(Boolean)
      .join(','),
  );
  const siliconFlowKey = process.env.SILICONFLOW_API_KEY || '';
  const openRouterKey = splitKeys(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '')[0] || '';

  const checks = [];

  if (nvidiaKeys.length > 0) {
    checks.push(
      testProvider(
        'NVIDIA',
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nvidiaKeys[0]}`,
        },
        {
          model: 'deepseek-ai/deepseek-v3.1',
          messages: [{ role: 'user', content: PROMPT }],
          temperature: 0.1,
          max_tokens: 40,
          stream: false,
        },
      ),
    );
  }

  if (siliconFlowKey) {
    checks.push(
      testProvider(
        'SiliconFlow',
        'https://api.siliconflow.cn/v1/chat/completions',
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${siliconFlowKey}`,
        },
        {
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [{ role: 'user', content: PROMPT }],
          temperature: 0.1,
          max_tokens: 40,
          stream: false,
        },
      ),
    );
  }

  if (openRouterKey) {
    checks.push(
      testProvider(
        'OpenRouter',
        'https://openrouter.ai/api/v1/chat/completions',
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://killer-skills.com',
          'X-Title': 'Killer-Skills Provider Health',
        },
        {
          model: 'google/gemma-3-27b-it:free',
          messages: [{ role: 'user', content: PROMPT }],
          temperature: 0.1,
          max_tokens: 40,
        },
      ),
    );
  }

  if (checks.length === 0) {
    console.error('No provider key configured. Set NVIDIA/SILICONFLOW/OPENROUTER keys first.');
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(checks);
  const successCount = results.filter((item) => item.ok).length;

  console.log('\nProvider Health Check');
  for (const result of results) {
    const icon = result.ok ? 'OK ' : 'ERR';
    console.log(`${icon} ${result.provider.padEnd(11)} status=${result.status || '-'} latency=${result.latencyMs}ms`);
    if (!result.ok && result.error) {
      console.log(`    ${result.error}`);
    }
  }

  if (successCount === 0) {
    console.error('\nNo provider is healthy. Block deploy.');
    process.exitCode = 1;
    return;
  }

  if (successCount < results.length) {
    console.warn('\nPartial success: at least one provider is healthy, but some providers failed.');
  } else {
    console.log('\nAll configured providers are healthy.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
