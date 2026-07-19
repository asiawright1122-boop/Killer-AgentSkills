import { describe, expect, it, vi } from 'vitest';
import { reportSkillInteraction } from './skill-interaction-reporter';

const payload = {
  eventType: 'platform_copy',
  skillRef: 'owner/repo/skill',
  platform: 'codex',
  surface: 'detail',
  locale: 'en',
};

describe('reportSkillInteraction', () => {
  it('prefers sendBeacon with an application/json blob', () => {
    const sendBeacon = vi.fn(() => true);
    const fetchImpl = vi.fn();

    reportSkillInteraction(payload, { sendBeacon } as any, fetchImpl as any);

    expect(sendBeacon).toHaveBeenCalledWith('/api/analytics/skill-event', expect.any(Blob));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to keepalive fetch when sendBeacon is unavailable', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    reportSkillInteraction(payload, {} as any, fetchImpl as any);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/analytics/skill-event',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify(payload),
      }),
    );
  });

  it('swallows synchronous and asynchronous reporting failures', () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));

    expect(() => reportSkillInteraction(payload, {} as any, fetchImpl as any)).not.toThrow();
  });
});
