import { beforeEach, describe, expect, it, vi } from 'vitest';

async function readBody(response: Response) {
  return await response.text();
}

describe('GET /llms-full.txt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns updated CLI terminology and canonical collection links', async () => {
    const mod = await import('../../src/pages/llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toContain('npx killer-skills add <owner/repo>');
    expect(body).toContain('npx killer-skills manage');
    expect(body).not.toContain('npx killer-skills install <owner/repo>');
    expect(body).not.toContain('Search the skill registry');
    expect(body).not.toContain('npx killer-skills remove <name>');
    expect(body).not.toContain('/collections/top-pdf-mcp-servers/');
    expect(body).not.toContain('https://killer-skills.com/en/community/');
    expect(body).not.toContain('https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools/');
    expect(body).not.toContain('https://killer-skills.com/en/docs/');
  });

  it('keeps llms-full IDE support count aligned with the current CLI coverage', async () => {
    const mod = await import('../../src/pages/llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain('19+ IDEs');
    expect(body).not.toContain('15+ IDEs');
  });

  it('frames llms-full as skills-first while keeping MCP as a secondary integration concept', async () => {
    const mod = await import('../../src/pages/llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain(
      'open directory of AI Agent Skills, IDE-native skill installation workflows, and reusable automation patterns',
    );
    expect(body).toContain('### MCP Runtime Integrations (Model Context Protocol)');
    expect(body).not.toContain("world's largest open-source directory of AI Agent Skills and MCP Servers");
    expect(body).not.toContain('### MCP Servers (Model Context Protocol)');
  });

  it('keeps llms-full aligned with the current core marketplace routes', async () => {
    const mod = await import('../../src/pages/llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain('| Home | https://killer-skills.com/en | Marketplace entry |');
    expect(body).toContain('| Skills | https://killer-skills.com/en/skills | Search and filter the complete directory |');
    expect(body).toContain('| Rankings | https://killer-skills.com/en/popular | Popular and latest skills |');
    expect(body).toContain('| Occupations | https://killer-skills.com/en/occupations | Browse skills by role and task |');
    expect(body).toContain('| Categories | https://killer-skills.com/en/categories | Browse skills by capability |');
    expect(body).not.toContain('https://killer-skills.com/en/collections/');
    expect(body).not.toContain('| Top AI Agent Skills |');
    expect(body).not.toContain('| File & Document Automation Tools | 10+ |');
    expect(body).not.toContain('| Top Workflow Automation Skills | 15+ |');
  });
});
