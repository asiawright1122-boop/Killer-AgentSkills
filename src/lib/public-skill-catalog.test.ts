import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicSkillRepoMetadata, hasCatalogedSkillRepo } from './public-skill-catalog';
import { getSkillsKV, type Env } from './kv';

vi.mock('./kv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./kv')>();
  return {
    ...actual,
    getSkillsKV: vi.fn(),
  };
});

function createEnvWithSkillCache(store: Map<string, unknown>): Env {
  return {
    TRANSLATIONS: {} as KVNamespace,
    SKILLS_CACHE: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
    } as unknown as KVNamespace,
    ASSETS: {} as Fetcher,
  };
}

describe('PublicSkillCatalog', () => {
  beforeEach(() => {
    vi.mocked(getSkillsKV).mockReset();
  });

  it('returns sanitized public repository metadata from a cataloged skill', async () => {
    vi.mocked(getSkillsKV).mockResolvedValue({
      id: 'anthropics/skills',
      name: 'Claude Agent Skill',
      skillName: 'Claude Agent Skill',
      owner: 'anthropics',
      repo: 'skills',
      description: 'Public agent skill description',
      category: 'developer',
      topics: ['agent-skills'],
      stars: 100,
      source: 'cache',
      updatedAt: '2026-06-09T00:00:00.000Z',
      filePath: '<thinking>private path notes</thinking>.claude/skills/SKILL.md',
      defaultBranch: '<analysis>private branch notes</analysis>develop',
    });

    const metadata = await getPublicSkillRepoMetadata({} as Env, 'anthropics', 'skills');

    expect(metadata).toEqual({
      filePath: '.claude/skills/SKILL.md',
      defaultBranch: 'develop',
    });
  });

  it('falls back to sanitized legacy metadata without exposing raw records', async () => {
    vi.mocked(getSkillsKV).mockResolvedValue(null);
    const env = createEnvWithSkillCache(
      new Map([
        [
          'meta:test-owner/test-repo',
          {
            filePath: 'skills/<reasoning>private route notes</reasoning>SKILL.md',
            defaultBranch: 'feature/<thinking>private branch notes</thinking>public',
            rawNotes: '<thinking>private operator notes</thinking>',
          },
        ],
      ]),
    );

    const metadata = await getPublicSkillRepoMetadata(env, 'test-owner', 'test-repo');

    expect(metadata).toEqual({
      filePath: 'skills/SKILL.md',
      defaultBranch: 'feature/public',
    });
    expect(JSON.stringify(metadata)).not.toMatch(/thinking|reasoning|private/i);
  });

  it('answers repository existence without returning raw skill data', async () => {
    vi.mocked(getSkillsKV).mockResolvedValue({ secret: '<thinking>private raw record</thinking>' });

    await expect(hasCatalogedSkillRepo({} as Env, 'anthropics', 'skills')).resolves.toBe(true);
  });
});
