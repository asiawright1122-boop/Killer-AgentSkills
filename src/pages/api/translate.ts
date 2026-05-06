import type { APIRoute } from 'astro';
import { translateTextStream } from '../../lib/nvidia';
import { getKV, setKV, type Env } from '../../lib/kv';
import crypto from 'node:crypto';
import { createRateLimiter, getClientIP, rateLimitResponse } from '../../lib/rate-limit';
import { getRuntimeEnv } from '../../lib/runtime-env';

// Use strict dynamic since it relies on POST body and streams
export const prerender = false;

// Stricter limit for translation (uses expensive AI API)
const translateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

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
  // Rate limit check
  const clientIP = getClientIP(request);
  if (translateLimiter.isLimited(clientIP)) {
    return rateLimitResponse();
  }

  try {
    const body = (await request.json()) as { text?: string; prompt?: string; targetLang?: string; type?: string };
    const text = body.text || body.prompt;
    const { targetLang, type = 'text' } = body;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent abuse with excessively long input
    const MAX_TEXT_LENGTH = 10_000;
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: `Text too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lang = targetLang || 'zh';
    const cacheKey = generateKey(text, lang, type);
    const env = (await getRuntimeEnv<Env>(locals)) as Env;

    // 1. Check KV
    const cached = await getKV(env, cacheKey);
    if (cached) {
      const stream = new ReadableStream({
        start(controller) {
          const chunk = `0:${JSON.stringify(cached)}\n`;
          controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      });
      return new Response(stream, { headers: STREAM_HEADERS });
    }

    // 2. Call NVIDIA API Streaming
    // We pass 'env' to help it find keys
    const response = translateTextStream(text, lang, type as 'text' | 'markdown', env);
    const iterator = response[Symbol.asyncIterator]();
    const firstChunk = await iterator.next();

    if (firstChunk.done) {
      throw new Error('Translation stream returned no content');
    }

    // 3. Transform Stream & Cache
    let fullContent = '';
    const enqueueChunk = (controller: ReadableStreamDefaultController<Uint8Array>, chunk: any) => {
      const content = chunk?.choices?.[0]?.delta?.content || '';
      if (!content) return;
      fullContent += content;
      const streamChunk = `0:${JSON.stringify(content)}\n`;
      controller.enqueue(new TextEncoder().encode(streamChunk));
    };

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          enqueueChunk(controller, firstChunk.value);

          while (true) {
            const nextChunk = await iterator.next();
            if (nextChunk.done) break;
            enqueueChunk(controller, nextChunk.value);
          }

          controller.close();

          if (fullContent) {
            console.log(`[API] Stream completed, caching to KV: ${cacheKey}`);
            await setKV(env, cacheKey, fullContent);
          }
        } catch (err) {
          console.error('Stream processing error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, { headers: STREAM_HEADERS });
  } catch (error) {
    console.error('Translation API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
