import type { APIRoute } from 'astro';
import { translateTextStream } from '../../lib/nvidia';
import { getKV, setKV } from '../../lib/kv';
import crypto from 'node:crypto';

// Use strict dynamic since it relies on POST body and streams
export const prerender = false;

const STREAM_HEADERS = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Content-Type-Options': 'nosniff',
};

function generateKey(text: string, lang: string, type: string): string {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `trans:v4:${lang}:${type}:${hash}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const body = await request.json() as { text?: string; prompt?: string; targetLang?: string; type?: string };
        const text = body.text || body.prompt;
        const { targetLang, type = 'text' } = body;

        if (!text) {
            return new Response(JSON.stringify({ error: "Text is required" }), { status: 400 });
        }

        const lang = targetLang || 'zh';
        const cacheKey = generateKey(text, lang, type);
        const env = locals.runtime.env; // Astro Cloudflare adapter exposes bindings here

        // 1. Check KV
        const cached = await getKV(env, cacheKey);
        if (cached) {
            const stream = new ReadableStream({
                start(controller) {
                    const chunk = `0:${JSON.stringify(cached)}\n`;
                    controller.enqueue(new TextEncoder().encode(chunk));
                    controller.close();
                }
            });
            return new Response(stream, { headers: STREAM_HEADERS });
        }

        // 2. Call NVIDIA API Streaming
        // We pass 'env' to help it find keys
        const response = await translateTextStream(text, lang, type as 'text' | 'markdown', env);

        // 3. Transform Stream & Cache
        let fullContent = '';
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of response) {
                        const content = chunk.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullContent += content;
                            const streamChunk = `0:${JSON.stringify(content)}\n`;
                            controller.enqueue(new TextEncoder().encode(streamChunk));
                        }
                    }
                    controller.close();

                    // Cache to KV on completion
                    if (fullContent) {
                        console.log(`[API] Stream completed, caching to KV: ${cacheKey}`);
                        await setKV(env, cacheKey, fullContent);
                    }
                } catch (err) {
                    // controller.error(err); // Astro/Cloudflare stream might not support explicit error downstream?
                    console.error('Stream processing error:', err);
                    controller.close();
                }
            }
        });

        return new Response(readableStream, { headers: STREAM_HEADERS });

    } catch (error: any) {
        console.error("Translation API error:", error);
        return new Response(JSON.stringify({
            error: "Translation failed",
            details: error?.message || "Unknown error"
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
