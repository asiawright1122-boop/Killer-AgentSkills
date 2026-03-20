import { describe, expect, it } from 'vitest';
import { resolveQueryIntent } from './query-intent';

describe('resolveQueryIntent', () => {
  it('matches workflow automation intent', () => {
    const result = resolveQueryIntent('workflow automation for ai agents', 'en');
    expect(result?.id).toBe('workflow-automation');
    expect(result?.displayTerm).toBe('Workflow Automation Skills');
  });

  it('matches process automation intent', () => {
    const result = resolveQueryIntent('process automation tools', 'en');
    expect(result?.id).toBe('process-automation');
    expect(result?.keywords).toContain('business process automation');
  });

  it('matches document automation intent', () => {
    const result = resolveQueryIntent('document automation', 'en');
    expect(result?.id).toBe('document-automation');
  });

  it('matches browser automation intent', () => {
    const result = resolveQueryIntent('browser automation workflow', 'en');
    expect(result?.id).toBe('browser-automation');
  });

  it('matches data workflow intent in zh locale', () => {
    const result = resolveQueryIntent('data extraction pipeline', 'zh');
    expect(result?.id).toBe('data-extraction');
    expect(result?.displayTerm).toBe('数据流程技能');
  });

  it('matches skill installation intent', () => {
    const result = resolveQueryIntent('install ai agent skills in cursor', 'en');
    expect(result?.id).toBe('skill-installation');
    expect(result?.keywords).toContain('skill installation');
  });

  it('matches workflow templates intent', () => {
    const result = resolveQueryIntent('workflow templates for agents', 'en');
    expect(result?.id).toBe('workflow-templates');
    expect(result?.displayTerm).toBe('Workflow Templates');
  });

  it('keeps mcp queries discoverable while framing them as skills-first workflow discovery', () => {
    const result = resolveQueryIntent('mcp tools for claude code', 'en');
    expect(result?.id).toBe('mcp-servers');
    expect(result?.displayTerm).toBe('AI Agent Skills for Integrations');
    expect(result?.description).toContain('AI agent skills');
    expect(result?.keywords).toContain('ai agent skills');
    expect(result?.keywords).toContain('mcp integrations');
  });

  it('falls back to existing cursor intent before generic skill intent', () => {
    const result = resolveQueryIntent('cursor skills', 'en');
    expect(result?.id).toBe('cursor-skills');
  });
});
