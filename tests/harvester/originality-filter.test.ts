import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

const loggedSkips: string[] = [];

// Mock fs module safely before importing other modules
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  
  // Define local duplicate long text inside the mocked module factory to avoid hoisting issues
  const localDuplicateText = '# Existing Skill Body\n' + Array(220).fill('duplicate').join(' ');

  const skillsCacheData = JSON.stringify({
    version: 1,
    skills: [
      {
        id: 'existing-owner/existing-repo/existing-skill',
        owner: 'existing-owner',
        repo: 'existing-repo',
        topics: ['ai-agents'],
        skillMd: {
          body: localDuplicateText,
        },
      },
    ],
  });

  return {
    ...actual,
    existsSync: vi.fn().mockImplementation((p: any) => {
      if (typeof p === 'string') {
        if (p.includes('skills-cache.json')) return true;
        if (p.includes('expanded-github-skills.json')) return true;
      }
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn().mockImplementation((p: any, options: any) => {
      if (typeof p === 'string') {
        if (p.includes('skills-cache.json')) {
          return skillsCacheData;
        }
        if (p.includes('expanded-github-skills.json')) {
          return '[]';
        }
      }
      return actual.readFileSync(p, options);
    }),
    writeFileSync: vi.fn().mockImplementation((p: any, data: any, options: any) => {
      if (typeof p === 'string' && (p.includes('expanded-github-skills.json') || p.includes('skills-cache.json'))) {
        return;
      }
      return actual.writeFileSync(p, data, options);
    }),
    appendFileSync: vi.fn().mockImplementation((p: any, data: any, options: any) => {
      if (typeof p === 'string' && p.includes('harvester-skipped.log')) {
        loggedSkips.push(data.toString());
        return;
      }
      return actual.appendFileSync(p, data, options);
    }),
  };
});

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  return undefined as never;
});

// Import harvester main and originality engine AFTER mock fs has been registered
import { main as runHarvester } from '../../scripts/harvest-github-skills';
import { injectOriginalityBlock } from '../../scripts/lib/originality-filter';

describe('Harvester Originality Filter Integration Test', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    loggedSkips.length = 0;

    // Reset process.argv to mock simple target count
    process.argv = ['node', 'scripts/harvest-github-skills.ts', '--target=2'];

    // Mock global fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      // Mock GitHub search API
      if (url.includes('api.github.com/search/code')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              items: [
                {
                  path: 'skills/thin-skill/SKILL.md',
                  repository: {
                    name: 'thin-repo',
                    owner: { login: 'thin-owner' },
                    description: 'A thin content skill repo',
                    topics: ['test'],
                    updated_at: '2026-06-23T12:00:00Z',
                  },
                },
                {
                  path: 'skills/duplicate-skill/SKILL.md',
                  repository: {
                    name: 'duplicate-repo',
                    owner: { login: 'duplicate-owner' },
                    description: 'A duplicate content skill repo',
                    topics: ['ai-agents'],
                    updated_at: '2026-06-23T12:00:00Z',
                  },
                },
                {
                  path: 'skills/valid-skill/SKILL.md',
                  repository: {
                    name: 'valid-repo',
                    owner: { login: 'valid-owner' },
                    description: 'A perfectly valid new skill repo',
                    topics: ['ai-agents', 'mcp'],
                    updated_at: '2026-06-23T12:00:00Z',
                  },
                },
              ],
            }),
        });
      }

      // Mock GitHub repos API (stars/forks metadata enrichment)
      if (url.match(/api\.github\.com\/repos\/[^\/]+\/[^\/]+$/)) {
        const repoName = url.split('/').pop();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              stargazers_count: 42,
              forks_count: 5,
              description: `Details for ${repoName}`,
              updated_at: '2026-06-23T12:00:00Z',
              topics: repoName === 'valid-repo' ? ['ai-agents', 'mcp'] : ['test'],
            }),
        });
      }

      // Mock GitHub contents API (SKILL.md file content)
      if (url.includes('/contents/')) {
        let fileContent = '';
        if (url.includes('thin-repo')) {
          fileContent = '---\nname: thin-skill\ntags: [test]\n---\nThis body has more than 100 characters to pass the first validation gate, but it has less than 200 words.';
        } else if (url.includes('duplicate-repo')) {
          fileContent = '---\nname: duplicate-skill\ntags: [ai-agents]\n---\n# Existing Skill Body\n' + Array(220).fill('duplicate').join(' ');
        } else if (url.includes('valid-repo')) {
          // Unique, long description (> 200 words)
          fileContent = '---\nname: valid-skill\ntags: [ai-agents, mcp]\n---\n# Valid New Skill\nThis is a brand new, highly original and detailed skill. ' +
            'It provides functional instructions on how to use custom agents. ' +
            'We need to write more words here to easily exceed the minimum requirement of 200 words limit. ' +
            'So I will write a lengthy description about how LLMs interact with external API schemas. ' +
            'AI agents should be equipped with direct APIs. Developers love automation because it cuts down repetitive tasks. ' +
            'By building custom skills, agents can navigate complex directories, run local tools, perform audits, and interact with developers. ' +
            'Our ecosystem requires high-quality, comprehensive documentation for search engines to index it. ' +
            'Originality blocks will be appended to ensure proper citation of the source repository and raw files, avoiding duplication penalties.';
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(fileContent),
        });
      }

      return Promise.reject(new Error(`Unexpected URL fetch: ${url}`));
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('should run crawler loop and skip thin, duplicate, and invalid repositories', async () => {
    // Run harvester main execution
    await runHarvester();

    // Verify logs of skipped items
    expect(loggedSkips.length).toBeGreaterThanOrEqual(2);

    const thinSkip = loggedSkips.find((log) => log.includes('thin-repo') && log.includes('Thin content'));
    const dupeSkip = loggedSkips.find((log) => log.includes('duplicate-repo') && log.includes('Duplicate content'));

    expect(thinSkip).toBeDefined();
    expect(dupeSkip).toBeDefined();
  });

  it('should verify originality block injection formats', () => {
    const body = '# My Skill\nSome functional description...';
    const metadata = { owner: 'agent-owner', repo: 'super-agent', filePath: 'skills/my-skill/SKILL.md' };

    const injected = injectOriginalityBlock(body, metadata);
    expect(injected).toContain('## 🏷️ Originality & Credits');
    expect(injected).toContain('https://github.com/agent-owner/super-agent');
    expect(injected).toContain('https://github.com/agent-owner/super-agent/blob/main/skills/my-skill/SKILL.md');
  });
});
