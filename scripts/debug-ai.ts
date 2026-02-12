
import * as dotenv from 'dotenv';
import * as path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath });

const nvidiaApiKeys = (process.env.NVIDIA_API_KEYS || '').split(',').filter(k => k.trim() !== '');
console.log(`NVIDIA Keys: ${nvidiaApiKeys.length}`);

const MODELS_TO_TEST = [
    'qwen/qwen3-235b-a22b',
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-405b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'deepseek-ai/deepseek-r1',
];

const TRANSLATION_PROMPT = `Translate the following text to Chinese (zh), Japanese (ja), and Korean (ko). Return ONLY a valid JSON object.

Text: "Streamline collaborative document creation with a structured workflow."

Output format:
{"zh": "...", "ja": "...", "ko": "..."}`;

async function testModel(model: string, apiKey: string) {
    console.log(`\n--- Testing ${model} ---`);
    try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: TRANSLATION_PROMPT }],
                temperature: 0.3,
                max_tokens: 200
            })
        });
        console.log(`Status: ${res.status} ${res.statusText}`);
        if (res.ok) {
            const data: any = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            console.log(`Response: ${content}`);
            // Check if Chinese is actually present
            const hasZh = content && /[\u4e00-\u9fff]/.test(content);
            console.log(`✅ Contains Chinese: ${hasZh}`);
        } else {
            const text = await res.text();
            console.log(`❌ Error: ${text.slice(0, 200)}`);
        }
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
}

(async () => {
    const apiKey = nvidiaApiKeys[nvidiaApiKeys.length - 1]; // Use the newest key
    console.log(`Using key ending in: ...${apiKey.slice(-6)}`);

    for (const model of MODELS_TO_TEST) {
        await testModel(model, apiKey);
    }
})();
