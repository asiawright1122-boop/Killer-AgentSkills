import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLightweightSkillsByRefs, type UnifiedSkill } from './skills';
import { getSkillsListingByRefs, type Env, type SkillListingItem } from './kv';

vi.mock('./kv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./kv')>();
  return {
    ...actual,
    getSkillsListingByRefs: vi.fn(),
  };
});

describe('public lightweight skill listings', () => {
  beforeEach(() => {
    vi.mocked(getSkillsListingByRefs).mockReset();
  });

  it('sanitizes hidden reasoning before returning referenced listing rows', async () => {
    const leakingRow: SkillListingItem = {
      id: 'leaky/repo/public-subskill',
      name: '<thinking>private display notes</thinking>Public Subskill',
      skillName: 'Scratchpad:\nprivate naming notes\n\nPublic Skill Name',
      owner: 'leaky',
      repo: 'repo',
      description: {
        en: 'Chain of thought:\nprivate description notes\n\nPublic description',
      },
      category: 'developer',
      topics: ['<analysis>private topic notes</analysis>public-topic'],
      stars: 42,
      source: 'cache',
      updatedAt: '2026-06-09T00:00:00.000Z',
      qualityScore: 10,
      seo: {
        definition: {
          en: '<reasoning>private SEO notes</reasoning>Public SEO definition',
        },
      },
    };

    vi.mocked(getSkillsListingByRefs).mockResolvedValue([leakingRow]);

    const result = await getLightweightSkillsByRefs({} as Env, ['leaky/repo']);
    const [skill] = result as UnifiedSkill[];

    expect(skill.name).toBe('Public Subskill');
    expect(skill.skillName).toBe('Public Skill Name');
    expect(skill.description).toEqual({ en: 'Public description' });
    expect(skill.topics).toEqual(['public-topic']);
    expect(skill.seo?.definition.en).toBe('Public SEO definition');
    expect(JSON.stringify(skill)).not.toMatch(/thinking|reasoning|scratchpad|chain of thought|private/i);
  });
});
