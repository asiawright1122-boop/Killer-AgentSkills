import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerAiRuntime } from './ai-runtime';

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    ...overrides,
  };
}

function providerReply(text: string) {
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

describe('WorkerAiRuntime', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows guarded fallback to OpenRouter after NVIDIA 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    fetchMock.mockResolvedValueOnce(providerReply('backup output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      NVIDIA_API_KEY: 'nvidia-key',
      OPENROUTER_API_KEY: 'openrouter-key',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'balanced',
      defaultOpenRouterTitle: 'Worker runtime test',
    });

    const result = await runtime.callText(env, { userPrompt: 'hello world' });

    expect(result.provider).toBe('openrouter');
    expect(result.text).toBe('backup output');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit)?.body)).model).toBe(
      'google/gemini-2.5-flash',
    );
  });

  it('hard-disables SiliconFlow for the runtime after a billing or auth response and skips it on the next call', async () => {
    fetchMock.mockResolvedValueOnce(new Response('insufficient balance', { status: 403 }));
    fetchMock.mockResolvedValueOnce(providerReply('openrouter fallback output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      SILICONFLOW_API_KEY: 'siliconflow-key',
      OPENROUTER_API_KEY: 'openrouter-key',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'batch_generation',
    });

    const firstResult = await runtime.callText(env, { userPrompt: 'hello world' });

    expect(firstResult.provider).toBe('openrouter');
    expect(firstResult.text).toBe('openrouter fallback output');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.siliconflow.cn/v1/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(providerReply('openrouter stays first after siliconflow disable'));

    const secondResult = await runtime.callText(env, { userPrompt: 'hello again' });

    expect(secondResult.provider).toBe('openrouter');
    expect(secondResult.text).toBe('openrouter stays first after siliconflow disable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('prefers SiliconFlow before OpenRouter when NVIDIA is not configured', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('siliconflow output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      SILICONFLOW_API_KEY: 'siliconflow-key',
      OPENROUTER_API_KEY: 'openrouter-key',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'balanced',
    });

    const result = await runtime.callText(env, { userPrompt: 'hello world' });

    expect(result.provider).toBe('siliconflow');
    expect(result.text).toBe('siliconflow output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.siliconflow.cn/v1/chat/completions');
  });

  it('honors OPENROUTER_MODEL overrides in the shared runtime request body', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('custom openrouter output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      OPENROUTER_API_KEY: 'openrouter-key',
      OPENROUTER_MODEL: 'openai/gpt-4.1-mini',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'balanced',
    });

    const result = await runtime.callText(env, { userPrompt: 'hello world' });

    expect(result.provider).toBe('openrouter');
    expect(result.text).toBe('custom openrouter output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body)).model).toBe('openai/gpt-4.1-mini');
  });

  it('sanitizes hidden reasoning from provider text output', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('<thinking>private notes</thinking>Public runtime output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      OPENROUTER_API_KEY: 'openrouter-key',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'balanced',
    });

    const result = await runtime.callText(env, { userPrompt: 'hello world' });

    expect(result.provider).toBe('openrouter');
    expect(result.text).toBe('Public runtime output');
  });

  it('prioritizes the healthier NVIDIA key after a label-level 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    fetchMock.mockResolvedValueOnce(providerReply('fallback key output'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      NVIDIA_API_KEYS: 'nvidia-key-0,nvidia-key-1',
    });
    const runtime = new WorkerAiRuntime({
      workloadProfile: 'balanced',
    });

    const firstResult = await runtime.callText(env, { userPrompt: 'first run' });
    expect(firstResult.provider).toBe('nvidia');
    expect(firstResult.text).toBe('fallback key output');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-0',
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-1',
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(providerReply('healthy key stays first'));

    const secondResult = await runtime.callText(env, { userPrompt: 'second run' });
    expect(secondResult.provider).toBe('nvidia');
    expect(secondResult.text).toBe('healthy key stays first');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-1',
    });
  });
});
