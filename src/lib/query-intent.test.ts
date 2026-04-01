import { describe, it, expect } from 'vitest';
import { resolveQueryIntent } from './query-intent';

describe('resolveQueryIntent', () => {
  const dummyEn = {
    'Query.Intent.workflow-automation.label': 'Workflow Automation Skills',
    'Query.Intent.process-automation.label': 'Process Automation Skills',
    'Query.Intent.document-automation.label': 'Document Automation Skills',
    'Query.Intent.browser-automation.label': 'Browser Automation Skills',
    'Query.Intent.skill-installation.label': 'Skill Installation Guides',
    'Query.Intent.workflow-templates.label': 'Workflow Templates',
    'Query.Intent.mcp-servers.label': 'AI Agent Skills for Integrations',
    'Query.Intent.cursor-skills.label': 'Cursor Skills',
  };
  const dummyZh = {
    'Query.Intent.data-extraction.label': '数据流程技能',
  };
  const tEn = (k: string) => dummyEn[k as keyof typeof dummyEn] || k;
  const tZh = (k: string) => dummyZh[k as keyof typeof dummyZh] || k;

  it('matches workflow automation intent', () => {
    const result = resolveQueryIntent('workflow automation for ai agents', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('workflow-automation');
    expect(result?.displayTerm).toBe('Workflow Automation Skills');
  });

  it('matches process automation intent', () => {
    const result = resolveQueryIntent('process automation tools', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('process-automation');
    expect(result?.displayTerm).toBe('Process Automation Skills');
  });

  it('matches document automation intent', () => {
    const result = resolveQueryIntent('document automation', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('document-automation');
    expect(result?.displayTerm).toBe('Document Automation Skills');
  });

  it('matches browser automation intent', () => {
    const result = resolveQueryIntent('browser automation workflow', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('browser-automation');
    expect(result?.displayTerm).toBe('Browser Automation Skills');
  });

  it('matches data extraction intent (zh)', () => {
    const result = resolveQueryIntent('data extraction pipeline', tZh);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('data-extraction');
    expect(result?.displayTerm).toBe('数据流程技能');
  });

  it('matches installation intent', () => {
    const result = resolveQueryIntent('install ai agent skills in cursor', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('skill-installation');
    expect(result?.displayTerm).toBe('Skill Installation Guides');
  });

  it('matches workflow templates intent', () => {
    const result = resolveQueryIntent('workflow templates for agents', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('workflow-templates');
    expect(result?.displayTerm).toBe('Workflow Templates');
  });

  it('matches mcp servers intent', () => {
    const result = resolveQueryIntent('mcp tools for claude code', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('mcp-servers');
    expect(result?.displayTerm).toBe('AI Agent Skills for Integrations');
  });

  it('returns null for unhandled queries', () => {
    const result = resolveQueryIntent('how do i write a hello world program', tEn);
    expect(result).toBeNull();
  });

  it('matches ide specific intent', () => {
    const result = resolveQueryIntent('cursor skills', tEn);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('cursor-skills');
    expect(result?.displayTerm).toBe('Cursor Skills');
  });
});
