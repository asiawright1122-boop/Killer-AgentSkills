import { describe, expect, it } from 'vitest';
import {
  buildKeywordString,
  getCategoryKeywordClusters,
  getIntentKeywordClusters,
  getKeywordCluster,
} from './seo-keywords';

describe('seo-keywords', () => {
  it('returns locale-specific keyword clusters', () => {
    expect(getKeywordCluster('workflowAutomation', 'en')).toContain('workflow automation');
    expect(getKeywordCluster('workflowAutomation', 'zh')).toContain('工作流自动化');
  });

  it('deduplicates merged keyword strings', () => {
    const keywords = buildKeywordString('en', 'core', 'workflowAutomation', 'workflow automation');
    const occurrences = keywords.split(', ').filter((item) => item === 'workflow automation');
    expect(occurrences).toHaveLength(1);
  });

  it('supports literal keywords alongside clusters', () => {
    const keywords = buildKeywordString('en', 'docs', 'cli', 'agent workflow');
    expect(keywords).toContain('AI agent skills CLI');
    expect(keywords).toContain('agent workflow');
  });

  it('maps intent ids to keyword clusters', () => {
    expect(getIntentKeywordClusters('workflow-automation')).toContain('workflowAutomation');
    expect(getIntentKeywordClusters('mcp-servers')).toContain('mcp');
    expect(getIntentKeywordClusters('skill-installation')).toContain('installSetup');
    expect(getIntentKeywordClusters('workflow-templates')).toContain('templates');
  });

  it('maps normalized categories to keyword clusters', () => {
    expect(getCategoryKeywordClusters('documentation')).toContain('documentAutomation');
    expect(getCategoryKeywordClusters('browser')).toContain('browserAutomation');
  });
});
