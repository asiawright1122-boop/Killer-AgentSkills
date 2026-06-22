import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { createAPIContext, createMockEnv, createMockKV } from '../../../../src/lib/api-test-utils';

describe('POST /api/skills/try', () => {
  let POST: any;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await import('../../../../src/pages/api/skills/try');
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildEnv(overrides: Record<string, unknown> = {}) {
    return {
      ...createMockEnv(),
      ...overrides,
    } as ReturnType<typeof createMockEnv> & Record<string, unknown>;
  }

  function buildContext(
    env: ReturnType<typeof buildEnv>,
    bodyOverrides: Partial<{ skillId: string; input: string; locale: string }> = {},
  ) {
    return createAPIContext({
      url: 'https://killer-skills.com/api/skills/try',
      env,
      body: {
        skillId: 'copywriting',
        input: 'AI workflow automation for ecommerce teams',
        locale: 'en',
        ...bodyOverrides,
      },
      headers: {
        'cf-connecting-ip': '203.0.113.10',
      },
    }) as any;
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

  function outputCacheKey(profileId: string, input: string, locale: string) {
    const fingerprint = crypto.createHash('sha256').update(`${profileId}|${locale}|${input}`).digest('hex');
    return `skill-try:v1:out:${fingerprint}`;
  }

  it('keeps template mode when fallback policy is cold and NVIDIA is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    fetchMock.mockResolvedValueOnce(providerReply('backup output should never be used'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'cold',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(body.mode).toBe('template');
    expect(body.provider).toBe('template');
    expect(body.workloadProfile).toBe('interactive_demo');
    expect(body.fallbackReason).toBe('provider_unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('allows guarded fallback to OpenRouter after NVIDIA failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream overloaded', { status: 429 }));
    fetchMock.mockResolvedValueOnce(providerReply('guarded backup output'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'guarded',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.provider).toBe('openrouter');
    expect(body.workloadProfile).toBe('interactive_demo');
    expect(body.outputMarkdown).toBe('guarded backup output');
    expect(body.routing).toMatchObject({
      policy: 'guarded',
      workloadProfile: 'interactive_demo',
      decision: 'backup_recovery',
      activationReason: 'nvidia_unavailable',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('strips hidden reasoning blocks from live provider output before returning or caching it', async () => {
    const store = new Map<string, unknown>();
    fetchMock.mockResolvedValueOnce(
      providerReply(
        '<thinking>private scratchpad</thinking>\n\n## Final\nShip the workflow.\n\n<reasoning>hidden chain</reasoning>',
      ),
    );

    const input = 'AI workflow automation for ecommerce teams';
    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'guarded',
        OPENROUTER_API_KEY: 'openrouter-key',
        TRANSLATIONS: createMockKV(store),
      }),
      { input },
    );

    const res = await POST(ctx);
    const body: any = await res.json();
    const cachedRaw = store.get(outputCacheKey('copywriting', input, 'en'));

    expect(res.status).toBe(200);
    expect(body.outputMarkdown).toBe('## Final\nShip the workflow.');
    expect(body.outputMarkdown).not.toMatch(/thinking|reasoning|scratchpad|chain/i);
    expect(JSON.parse(String(cachedRaw)).outputMarkdown).toBe('## Final\nShip the workflow.');
  });

  it('strips hidden reasoning blocks from cached provider output before returning it', async () => {
    const input = 'AI workflow automation for ecommerce teams';
    const store = new Map<string, unknown>([
      [
        outputCacheKey('copywriting', input, 'en'),
        JSON.stringify({
          provider: 'openrouter',
          outputMarkdown: 'Chain of thought:\nprivate analysis\n## Final\nUse this result.',
          workloadProfile: 'interactive_demo',
        }),
      ],
    ]);

    const ctx = buildContext(
      buildEnv({
        TRANSLATIONS: createMockKV(store),
      }),
      { input },
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.outputMarkdown).toBe('## Final\nUse this result.');
    expect(body.outputMarkdown).not.toMatch(/chain of thought|private analysis/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips hidden reasoning from failed trial error responses', async () => {
    const ctx = buildContext(buildEnv());
    vi.spyOn(ctx.request, 'json').mockRejectedValueOnce(
      new Error('<thinking>private parse notes</thinking>Public failure'),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Skill trial failed');
    expect(JSON.stringify(body)).not.toMatch(/thinking|private parse notes/i);
  });

  it('allows guarded fallback immediately when no NVIDIA key is configured', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('guarded no-nvidia backup output'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'guarded',
        OPENROUTER_API_KEY: 'openrouter-key',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.provider).toBe('openrouter');
    expect(body.workloadProfile).toBe('interactive_demo');
    expect(body.outputMarkdown).toBe('guarded no-nvidia backup output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body)).model).toBe(
      'google/gemma-3-27b-it:free',
    );
  });

  it('keeps skill try on its allowlisted OpenRouter model even when a global model override is set', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('allowlisted openrouter output'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'guarded',
        OPENROUTER_API_KEY: 'openrouter-key',
        OPENROUTER_MODEL: 'google/gemini-2.5-flash',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.provider).toBe('openrouter');
    expect(body.outputMarkdown).toBe('allowlisted openrouter output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body)).model).toBe(
      'google/gemma-3-27b-it:free',
    );
  });

  it('still prefers NVIDIA on always policy when the primary provider is healthy', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('nvidia primary output'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'always',
        NVIDIA_API_KEY: 'nvidia-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.provider).toBe('nvidia');
    expect(body.workloadProfile).toBe('interactive_demo');
    expect(body.outputMarkdown).toBe('nvidia primary output');
    expect(body.routing).toMatchObject({
      policy: 'always',
      workloadProfile: 'interactive_demo',
      decision: 'primary_preferred',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('prioritizes the healthier NVIDIA key after a label-level 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    fetchMock.mockResolvedValueOnce(providerReply('fallback nvidia key output'));
    fetchMock.mockResolvedValueOnce(providerReply('healthy nvidia key stays first'));

    const env = buildEnv({
      AI_FALLBACK_POLICY: 'guarded',
      NVIDIA_API_KEYS: 'nvidia-key-0,nvidia-key-1',
      OPENROUTER_API_KEY: 'openrouter-key',
    });

    const firstRes = await POST(buildContext(env, { input: 'first run' }));
    const firstBody: any = await firstRes.json();
    expect(firstRes.status).toBe(200);
    expect(firstBody.mode).toBe('ai');
    expect(firstBody.provider).toBe('nvidia');
    expect(firstBody.workloadProfile).toBe('interactive_demo');
    expect(firstBody.outputMarkdown).toBe('fallback nvidia key output');
    expect(firstBody.routing?.pressureLabels).toEqual([
      expect.objectContaining({
        label: 'N0',
        provider: 'nvidia',
        scope: 'primary',
        severity: 'critical',
        reasons: expect.arrayContaining([
          'consecutive_429s=1',
          'retryable_failures=1',
          'recent_429s=1',
          'recent_cooldowns=1',
          'recent_retryable_failures=1',
        ]),
      }),
    ]);

    const secondRes = await POST(buildContext(env, { input: 'second run' }));
    const secondBody: any = await secondRes.json();
    expect(secondRes.status).toBe(200);
    expect(secondBody.mode).toBe('ai');
    expect(secondBody.provider).toBe('nvidia');
    expect(secondBody.workloadProfile).toBe('interactive_demo');
    expect(secondBody.outputMarkdown).toBe('healthy nvidia key stays first');
    expect(secondBody.routing).toMatchObject({
      policy: 'guarded',
      decision: 'guarded_recovery',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-0',
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-1',
    });
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit)?.headers).toMatchObject({
      Authorization: 'Bearer nvidia-key-1',
    });
  });

  it('prefers siliconflow before openrouter for the interactive demo workload', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('interactive siliconflow output'));

    const ctx = buildContext(
      buildEnv({
        AI_FALLBACK_POLICY: 'guarded',
        SILICONFLOW_API_KEY: 'siliconflow-key',
        OPENROUTER_API_KEY: 'openrouter-key',
        SKILL_TRY_WORKLOAD_PROFILE: 'interactive_demo',
      }),
    );

    const res = await POST(ctx);
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.provider).toBe('siliconflow');
    expect(body.workloadProfile).toBe('interactive_demo');
    expect(body.outputMarkdown).toBe('interactive siliconflow output');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.siliconflow.cn/v1/chat/completions');
  });
});
