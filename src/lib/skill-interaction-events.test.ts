import { describe, expect, it } from 'vitest';
import {
  createDailyActorHash,
  isTelemetryCrawler,
  validateSkillInteractionPayload,
} from './skill-interaction-events';

describe('validateSkillInteractionPayload', () => {
  it('accepts a canonical CLI install event', () => {
    expect(
      validateSkillInteractionPayload({
        eventType: 'cli_install',
        skillRef: 'anthropics/skills/frontend-design',
        platform: 'claude',
        surface: 'cli',
        clientVersion: '1.10.1',
      }),
    ).toEqual({
      eventType: 'cli_install',
      skillRef: 'anthropics/skills/frontend-design',
      source: 'cli',
      platform: 'claude',
      surface: 'cli',
      locale: '',
      clientVersion: '1.10.1',
    });
  });

  it('accepts the auto-detect website install mode', () => {
    expect(
      validateSkillInteractionPayload({
        eventType: 'platform_copy',
        skillRef: 'anthropics/skills/frontend-design',
        platform: 'auto',
        surface: 'detail',
        locale: 'en',
      }),
    ).toMatchObject({ source: 'web', platform: 'auto', surface: 'detail' });
  });

  it.each([
    { eventType: 'cli_install', skillRef: '../secret', platform: 'claude', surface: 'cli' },
    { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'codex', surface: 'cli' },
    { eventType: 'platform_copy', skillRef: 'owner/repo', platform: 'unknown', surface: 'detail' },
  ])('rejects invalid or contradictory payload %#', (payload) => {
    expect(validateSkillInteractionPayload(payload)).toBeNull();
  });
});

describe('daily anonymous actor hashing', () => {
  it('is stable within a day and unlinkable across days', async () => {
    const base = { salt: 'test-secret', ip: '203.0.113.5', userAgent: 'killer-skills/1.10.1' };
    const first = await createDailyActorHash({ ...base, eventDate: '2026-07-16' });
    const same = await createDailyActorHash({ ...base, eventDate: '2026-07-16' });
    const nextDay = await createDailyActorHash({ ...base, eventDate: '2026-07-17' });
    expect(first).toBe(same);
    expect(first).not.toBe(nextDay);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('recognizes search and AI crawlers', () => {
    expect(isTelemetryCrawler('Googlebot/2.1')).toBe(true);
    expect(isTelemetryCrawler('GPTBot/1.0')).toBe(true);
    expect(isTelemetryCrawler('killer-skills/1.10.1')).toBe(false);
  });
});
