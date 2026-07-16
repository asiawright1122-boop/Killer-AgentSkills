import { describe, expect, it, vi } from 'vitest';
import { isTelemetryDisabled, reportSuccessfulInstall } from '../src/utils/telemetry';

describe('isTelemetryDisabled', () => {
  it.each([
    [{ DO_NOT_TRACK: '1' }, true],
    [{ KILLER_SKILLS_TELEMETRY: '0' }, true],
    [{ KILLER_SKILLS_TELEMETRY: 'false' }, true],
    [{ KILLER_SKILLS_TEST: '1' }, true],
    [{}, false],
  ])('evaluates %#', (env, expected) => expect(isTelemetryDisabled(env)).toBe(expected));
});

const event = { skillRef: 'owner/repo/skill', platform: 'codex' as const, clientVersion: '1.10.1' };

it('posts a successful install event', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

  await reportSuccessfulInstall(event, { fetchImpl: fetchImpl as any, env: {} });

  expect(fetchImpl).toHaveBeenCalledWith(
    'https://killer-skills.com/api/analytics/skill-event',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ ...event, eventType: 'cli_install', surface: 'cli' }),
    }),
  );
});

it('never throws when fetch rejects or reaches the timeout', async () => {
  const rejected = vi.fn().mockRejectedValue(new Error('offline'));
  await expect(reportSuccessfulInstall(event, { fetchImpl: rejected as any, env: {} })).resolves.toBeUndefined();

  const pending = vi.fn(
    (_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  await expect(
    reportSuccessfulInstall(event, { fetchImpl: pending as any, timeoutMs: 5, env: {} }),
  ).resolves.toBeUndefined();
});

it('does not post missing canonical refs or opted-out events', async () => {
  const fetchImpl = vi.fn();

  await reportSuccessfulInstall({ ...event, skillRef: 'local-skill' }, { fetchImpl: fetchImpl as any, env: {} });
  await reportSuccessfulInstall(event, {
    fetchImpl: fetchImpl as any,
    env: { KILLER_SKILLS_TELEMETRY: '0' },
  });

  expect(fetchImpl).not.toHaveBeenCalled();
});
