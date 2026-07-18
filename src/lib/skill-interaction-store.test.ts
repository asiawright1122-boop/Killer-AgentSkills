import { describe, expect, it, vi } from 'vitest';
import { getRecentSkillInteractionMetrics, recordSkillInteraction } from './skill-interaction-store';

describe('recordSkillInteraction', () => {
  it('uses INSERT OR IGNORE with daily identity fields', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));

    await recordSkillInteraction({ prepare } as any, {
      eventDate: '2026-07-16',
      actorHash: 'a'.repeat(64),
      eventType: 'cli_install',
      skillRef: 'owner/repo/skill',
      source: 'cli',
      platform: 'codex',
      surface: 'cli',
      locale: '',
      clientVersion: '1.10.1',
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO skill_interactions'));
    expect(run).toHaveBeenCalledOnce();
  });

  it('fails open when D1 is unavailable', async () => {
    await expect(recordSkillInteraction(undefined, {} as any)).resolves.toBe(false);
  });
});

describe('getRecentSkillInteractionMetrics', () => {
  it('maps grouped seven and thirty day metrics by canonical skill ref', async () => {
    const all = vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          skill_ref: 'owner/repo/skill',
          cli_installs_7d: 2,
          cli_installs_30d: 5,
          install_actions_7d: 3,
          install_actions_30d: 9,
          trend_score: 31,
        },
      ],
    });
    const db = { prepare: vi.fn(() => ({ bind: () => ({ all }) })) };

    const metrics = await getRecentSkillInteractionMetrics(db as any, new Date('2026-07-16T12:00:00Z'));

    expect(metrics.get('owner/repo/skill')).toEqual({
      cliInstalls7d: 2,
      cliInstalls30d: 5,
      installActions7d: 3,
      installActions30d: 9,
      trendScore: 31,
    });
  });

  it('returns an empty map when the table is missing', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({ all: vi.fn().mockRejectedValue(new Error('no such table')) }),
      })),
    };

    await expect(getRecentSkillInteractionMetrics(db as any, new Date('2026-07-16T12:00:00Z'))).resolves.toEqual(
      new Map(),
    );
  });
});
