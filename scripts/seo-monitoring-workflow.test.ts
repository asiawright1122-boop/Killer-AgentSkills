import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SEO monitoring workflow', () => {
  it('generates the skill indexability report before content governance', () => {
    const workflow = readFileSync(resolve('.github/workflows/seo-monitoring.yml'), 'utf8');
    const generationStep = '- name: Generate SEO Indexability Report';
    const governanceStep = '- name: Build Content Governance Report';
    const generationIndex = workflow.indexOf(generationStep);
    const governanceIndex = workflow.indexOf(governanceStep);

    expect(generationIndex).toBeGreaterThanOrEqual(0);
    expect(governanceIndex).toBeGreaterThan(generationIndex);
    expect(workflow.slice(generationIndex, governanceIndex)).toContain('run: npm run report:seo:skill-indexability');
  });
});
