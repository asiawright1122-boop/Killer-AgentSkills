import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSkillMd } from './github';

describe('fetchSkillMd', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dereferences SKILL.md stubs that point to __SKILL__.md', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/.claude/skills/build-plugin/SKILL.md')) {
        return {
          ok: true,
          text: async () =>
            '**IMPORTANT: This file is a stub.** Read `.claude/skills/build-plugin/__SKILL__.md` for the real content.',
        };
      }
      if (url.includes('/.claude/skills/build-plugin/__SKILL__.md')) {
        return {
          ok: true,
          text: async () => '# Build Plugin\n\nReal content lives here.',
        };
      }
      return {
        ok: false,
        text: async () => '',
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    const content = await fetchSkillMd('opentabs-dev', 'opentabs', '.claude/skills/build-plugin/SKILL.md');

    expect(content).toContain('Real content lives here.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the original content when no stub indirection exists', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Quality Check\n\nRun both checks and report results.',
    }));

    vi.stubGlobal('fetch', fetchMock);

    const content = await fetchSkillMd('tfunk1030', 'bnredo', '.claude/skills/check/SKILL.md');

    expect(content).toContain('Run both checks');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
