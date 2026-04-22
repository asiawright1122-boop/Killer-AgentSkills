import { describe, expect, it } from 'vitest';
import { getAuthoritySurfaceEntries, getCollectionRecoveryPathEntries } from './authority-surfaces';

describe('authority surfaces', () => {
  it('routes nextjs authority collections into workflow and cli recovery paths', () => {
    const entries = getCollectionRecoveryPathEntries('en', 'top-nextjs-ai-tools-full-stack-developer-workflows');

    expect(entries.map((entry) => entry.id)).toEqual([
      'solution-workflow-automation',
      'docs-cli-overview',
      'solution-agent-workflows',
      'collection-official-trusted-tools',
    ]);
  });

  it('keeps claude-code recovery paths localized and editorially focused', () => {
    const entries = getCollectionRecoveryPathEntries('zh', 'top-claude-code-skills');

    expect(entries.map((entry) => entry.id)).toEqual([
      'docs-cli-overview',
      'solution-agent-workflows',
      'blog-ide-comparison',
      'collection-official-trusted-tools',
    ]);
    expect(entries[0]?.title).toBe('CLI 总览文档');
    expect(entries[1]?.title).toBe('Agent 工作流方案页');
  });

  it('routes official trusted collections into editorial and solution recovery surfaces', () => {
    const entries = getCollectionRecoveryPathEntries('en', 'top-official-ai-skills-trusted-tools');

    expect(entries.map((entry) => entry.id)).toEqual([
      'docs-cli-overview',
      'solution-agent-workflows',
      'blog-official-ai-agent-skills-guide',
      'blog-ide-comparison',
    ]);
  });

  it('falls back to the default recovery set when a collection has no custom map', () => {
    const entries = getCollectionRecoveryPathEntries('en', 'unknown-slug', { limit: 3 });

    expect(entries.map((entry) => entry.id)).toEqual([
      'docs-cli-overview',
      'solution-agent-workflows',
      'solution-workflow-automation',
    ]);
  });

  it('does not expose internal rationale notes on public authority surface entries', () => {
    const entry = getAuthoritySurfaceEntries('zh', { ids: ['collection-official-trusted-tools'] })[0];

    expect(entry).toBeDefined();
    expect(entry?.title).toBeTruthy();
    expect(entry?.description).toBeTruthy();
    expect(entry && Object.prototype.hasOwnProperty.call(entry, 'rationale')).toBe(false);
  });
});
