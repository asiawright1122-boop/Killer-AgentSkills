import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockKV, createAPIContext } from '../../lib/api-test-utils';

function buildContext(body: unknown, env?: ReturnType<typeof createMockEnv>) {
  return createAPIContext({
    url: 'http://localhost/api/translate',
    body,
    env,
  });
}

describe('POST /api/translate', () => {
  let POST: any;
  let mockTranslateStream: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    mockTranslateStream = vi.fn();

    vi.mock('../../../lib/nvidia', () => ({
      translateTextStream: mockTranslateStream,
    }));

    const mod = await import('./translate');
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 429 when rate limited', async () => {
    const ctx = buildContext({ text: 'Hello', targetLang: 'zh' });
    for (let i = 0; i < 10; i++) {
      await POST(ctx);
    }
    const res = await POST(ctx);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
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
    const store = new Map<string, unknown>([
      // md5('test') = 098f6bcd4621d373cade4e832627b4f6
      ['trans:v4:zh:text:098f6bcd4621d373cade4e832627b4f6', cachedContent],
    ]);

    const ctx = buildContext({ text: 'test', targetLang: 'zh' }, createMockEnv({ TRANSLATIONS: createMockKV(store) }));

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

    const chunks: string[] = [];
    if (res.body) {
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let result;
      while (!(result = await reader.read()).done) {
        chunks.push(decoder.decode(result.value));
      }
    }
    expect(chunks.join('')).toContain(cachedContent);
    expect(mockTranslateStream).not.toHaveBeenCalled();
  });

  it.skip('calls NVIDIA API on cache miss', async () => {
    async function* mockGen() {
      yield { choices: [{ delta: { content: 'H' } }] };
      yield { choices: [{ delta: { content: 'ello' } }] };
      yield { choices: [{ delta: { content: ' world' } }] };
    }
    mockTranslateStream.mockImplementation(mockGen);

    const ctx = buildContext(
      { text: 'hello world', targetLang: 'zh' },
      createMockEnv({ TRANSLATIONS: createMockKV() }),
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(mockTranslateStream).toHaveBeenCalledOnce();
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

  it.skip('uses text field when prompt is not provided', async () => {
    async function* mockGen() {
      yield { choices: [{ delta: { content: 'translated' } }] };
    }
    mockTranslateStream.mockImplementation(mockGen);

    const ctx = buildContext({ text: 'hello' }, createMockEnv());
    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(mockTranslateStream).toHaveBeenCalledWith('hello', 'zh', 'text', expect.anything());
  });

  it.skip('falls back to prompt when text is not provided', async () => {
    async function* mockGen() {
      yield { choices: [{ delta: { content: 'translated' } }] };
    }
    mockTranslateStream.mockImplementation(mockGen);

    const ctx = buildContext({ prompt: 'hello from prompt' }, createMockEnv());
    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(mockTranslateStream).toHaveBeenCalledWith('hello from prompt', 'zh', 'text', expect.anything());
  });
});
