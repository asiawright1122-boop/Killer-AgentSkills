import { describe, expect, it } from 'vitest';
import { sanitizePublicSkillCopy, sanitizePublicSkillCopyList } from './public-skill-copy';

describe('public skill copy sanitizer', () => {
  it('removes leaked process fragments from descriptions', () => {
    expect(
      sanitizePublicSkillCopy(
        'Ideal for AI agents that need this happens in two steps:. Algorithmic Art creates interactive visualizations.',
      ),
    ).toBe('Algorithmic Art creates interactive visualizations.');
  });

  it('drops instruction-style limitations', () => {
    expect(
      sanitizePublicSkillCopyList([
        'CRITICAL GUIDELINES: Avoid redundancy: each algorithmic aspect should be mentioned once.',
        'Requires p5.js and browser rendering support.',
      ]),
    ).toEqual(['Requires p5.js and browser rendering support.']);
  });

  it('normalizes feature labels generated from upstream instructions', () => {
    expect(
      sanitizePublicSkillCopyList([
        'Applying This happens in two steps:',
        'Applying Algorithmic Philosophy Creation (.md file)',
        'Interactive Visualization',
      ]),
    ).toEqual(['Algorithmic Philosophy Creation', 'Interactive Visualization']);
  });
});
