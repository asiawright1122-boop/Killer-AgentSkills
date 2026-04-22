import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv, createMockKV } from '../../../src/lib/api-test-utils';

function buildContext(
  body: unknown,
  env?: ReturnType<typeof createMockEnv> & Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return createAPIContext({
    url: 'http://localhost/api/translate',
    body,
    env,
    headers,
  });
}

function streamingProviderResponse(parts: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: part } }],
              })}\n\n`,
            ),
          );
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

function jsonProviderResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text } }],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function readResponseStream(res: Response): Promise<string> {
  if (!res.body) return '';

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(decoder.decode(result.value));
  }

  return chunks.join('');
}

describe('POST /api/translate', () => {
  let POST: any;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('../../../src/pages/api/translate');
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 429 when rate limited', async () => {
    const ctx = buildContext({ text: 'Hello', targetLang: 'zh' });
    for (let i = 0; i < 10; i += 1) {
      await POST(ctx);
    }

    const res = await POST(ctx);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when text is missing', async () => {
    const ctx = buildContext({});
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/text/i);
  });

  it('returns 400 when text is empty', async () => {
    const ctx = buildContext({ text: '' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when text exceeds 10000 characters', async () => {
    const longText = 'a'.repeat(10_001);
    const ctx = buildContext({ text: longText, targetLang: 'zh' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too long/i);
  });

  it('returns cached stream on KV cache hit', async () => {
    const cachedContent = '你好世界';
    const store = new Map<string, unknown>([['trans:v4:zh:text:098f6bcd4621d373cade4e832627b4f6', cachedContent]]);

    const ctx = buildContext(
      { text: 'test', targetLang: 'zh' },
      createMockEnv({ TRANSLATIONS: createMockKV(store) }) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await readResponseStream(res)).toContain(cachedContent);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams NVIDIA translation on cache miss and writes the final result to KV', async () => {
    const translations = createMockKV();
    fetchMock.mockResolvedValueOnce(streamingProviderResponse(['你', '好', '世界']));

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({
        TRANSLATIONS: translations,
        NVIDIA_API_KEY: 'nvidia-key',
      }) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);

    const body = await readResponseStream(res);
    expect(body).toContain('"你"');
    expect(body).toContain('"好"');
    expect(body).toContain('"世界"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(translations.put).toHaveBeenCalledWith(
      'trans:v4:zh:text:5eb63bbbe01eeed093cb22bb8f5acdc3',
      '你好世界',
      expect.anything(),
    );
  });

  it('keeps using the healthier NVIDIA key before opening fallback providers', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    fetchMock.mockResolvedValueOnce(streamingProviderResponse(['二号', 'Key']));

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({
        AI_FALLBACK_POLICY: 'guarded',
        NVIDIA_API_KEYS: 'nvidia-key-0,nvidia-key-1',
        OPENROUTER_API_KEY: 'openrouter-key',
      } as any) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);

    const body = await readResponseStream(res);
    expect(body).toContain('"二号"');
    expect(body).toContain('"Key"');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-0',
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-1',
    });
  });

  it('falls back to OpenRouter after NVIDIA 429 when guarded fallback is enabled', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream overloaded', { status: 429 }));
    fetchMock.mockResolvedValueOnce(jsonProviderResponse('guarded backup output'));

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({
        AI_FALLBACK_POLICY: 'guarded',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      } as any) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);

    const body = await readResponseStream(res);
    expect(body).toContain('guarded backup output');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('keeps backups parked when fallback policy is cold', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream overloaded', { status: 429 }));

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({
        AI_FALLBACK_POLICY: 'cold',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      } as any) as any,
    );

    const res = await POST(ctx);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Translation failed');
    expect(String(body.details || '')).toMatch(/fallback policy|nvidia/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('still prefers NVIDIA first when fallback policy is always and primary is healthy', async () => {
    fetchMock.mockResolvedValueOnce(streamingProviderResponse(['primary output']));

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({
        AI_FALLBACK_POLICY: 'always',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      } as any) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(await readResponseStream(res)).toContain('primary output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('falls back to prompt when text is not provided', async () => {
    fetchMock.mockResolvedValueOnce(streamingProviderResponse(['translated']));

    const ctx = buildContext(
      { prompt: 'hello from prompt', targetLang: 'zh' },
      createMockEnv({
        NVIDIA_API_KEY: 'nvidia-key',
      }) as any,
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(await readResponseStream(res)).toContain('translated');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns error for invalid JSON body', async () => {
    const ctx = {
      ...createAPIContext({ url: 'http://localhost/api/translate' }),
      request: new Request('http://localhost/api/translate', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
    };

    const res = await POST(ctx);
    expect([400, 500]).toContain(res.status);
  });
});
