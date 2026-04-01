import { describe, expect, it } from 'vitest';
import {
  buildKeywordString,
  getCategoryKeywordClusters,
  getCollectionKeywordClusters,
  getIntentKeywordClusters,
  getKeywordCluster,
} from './seo-keywords';

describe('seo-keywords', () => {
  const dummyEn = {
    'Seo.Keywords.workflowAutomation': 'workflow automation skills',
    'Seo.Keywords.core': 'ai agent skills, developer skills for ai',
    'Seo.Keywords.docs': 'ai agent skills docs, skill setup docs',
    'Seo.Keywords.cli': 'skill installation cli',
  };
  const dummyZh = {
    'Seo.Keywords.workflowAutomation': '工作流自动化技能',
  };
  const tEn = (k: string) => dummyEn[k as keyof typeof dummyEn] || '';
  const tZh = (k: string) => dummyZh[k as keyof typeof dummyZh] || '';

  it('getKeywordCluster returns correct localized array', () => {
    expect(getKeywordCluster('workflowAutomation', tEn)).toContain('workflow automation skills');
    expect(getKeywordCluster('workflowAutomation', tZh)).toContain('工作流自动化技能');
  });

  it('buildKeywordString resolves IDs and merges literal keywords', () => {
    const keywords = buildKeywordString(tEn, 'core', 'workflowAutomation', 'workflow automation');
    expect(keywords).toContain('ai agent skills');
    expect(keywords).toContain('workflow automation skills');
    expect(keywords.split(', ')).toHaveLength(4);
  });

  it('buildKeywordString filters out low intent queries appropriately', () => {
    const keywords = buildKeywordString(tEn, 'docs', 'cli', 'agent workflow');
    expect(keywords).toContain('skill installation cli');
    expect(keywords).not.toContain('how to');
  });

  it('buildKeywordString deduplicates overlapping strings', () => {
    const keywords = buildKeywordString(tEn, 'core', 'what is mcp', 'product manager workflow', 'mvp builder');
    expect(keywords).not.toContain('what is');
    expect(keywords).not.toContain('mvp builder');
    expect(keywords).toContain('ai agent skills');
  });

  it('maps intent ids to keyword clusters', () => {
    expect(getIntentKeywordClusters('workflow-automation')).toContain('workflowAutomation');
    expect(getIntentKeywordClusters('mcp-servers')).toEqual(
      expect.arrayContaining(['mcp', 'developerExperience', 'ideCompat', 'installSetup', 'workflowAutomation']),
    );
    expect(getIntentKeywordClusters('skill-installation')).toContain('installSetup');
    expect(getIntentKeywordClusters('workflow-templates')).toContain('templates');
  });

  it('maps normalized categories to keyword clusters', () => {
    expect(getCategoryKeywordClusters('documentation')).toContain('documentAutomation');
    expect(getCategoryKeywordClusters('browser')).toContain('browserAutomation');
  });

  it('infers focused collection keyword clusters from category and slug', () => {
    const clusters = getCollectionKeywordClusters('documentation', 'top-pdf-claude-code-skills');
    expect(clusters).toEqual(expect.arrayContaining(['core', 'documentAutomation', 'ideCompat']));
  });
});
