import { beforeEach, describe, expect, it, vi } from 'vitest';

async function readBody(response: Response) {
  return await response.text();
}

describe('GET /llms-full.txt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns updated CLI terminology and canonical collection links', async () => {
    const mod = await import('./llms-full.txt');
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
  });

  it('keeps llms-full IDE support count aligned with the current CLI coverage', async () => {
    const mod = await import('./llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain('19+ IDEs');
    expect(body).not.toContain('15+ IDEs');
  });

  it('frames llms-full as skills-first while keeping MCP as a secondary integration concept', async () => {
    const mod = await import('./llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain('open directory of AI Agent Skills, IDE-native skill installation workflows, and reusable automation patterns');
    expect(body).toContain('### MCP Runtime Integrations (Model Context Protocol)');
    expect(body).not.toContain("world's largest open-source directory of AI Agent Skills and MCP Servers");
    expect(body).not.toContain('### MCP Servers (Model Context Protocol)');
  });

  it('keeps curated collection counts aligned with the current collection data', async () => {
    const mod = await import('./llms-full.txt');
    const response = await mod.GET({} as never);
    const body = await readBody(response);

    expect(body).toContain('| Top AI Agent Skills | 7 | https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools/ |');
    expect(body).not.toContain('https://killer-skills.com/en/collections/top-ai-agent-platforms-orchestration-tools/');
    expect(body).toContain('| Top Developer Tools | 12 | https://killer-skills.com/en/collections/top-developer-tooling-ai-agent-work/ |');
    expect(body).toContain('| Top Workflow Automation Skills | 9 | https://killer-skills.com/en/collections/top-agent-workflow-automation-tools/ |');
    expect(body).toContain('| Top Python Skills | 12 | https://killer-skills.com/en/collections/top-python-ai-agent-tools-developer-workflows/ |');
    expect(body).toContain('| Top React Skills | 12 | https://killer-skills.com/en/collections/top-react-ai-tools-ui-workflows-component-development/ |');
    expect(body).toContain('| Top TypeScript Skills | 12 | https://killer-skills.com/en/collections/top-typescript-ai-tools-developer-workflows/ |');
    expect(body).toContain('| Top DevOps Skills | 6 | https://killer-skills.com/en/collections/top-devops-operations-automation-tools/ |');
    expect(body).not.toContain('| File & Document Automation Tools | 10+ |');
    expect(body).not.toContain('| Top Workflow Automation Skills | 15+ |');
  });
});
