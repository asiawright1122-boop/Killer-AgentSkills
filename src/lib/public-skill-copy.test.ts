import { describe, expect, it } from 'vitest';
import {
  sanitizePublicSkillCopy,
  sanitizePublicSkillCopyList,
  sanitizePublicSkillSourceExcerpt,
} from './public-skill-copy';

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

  it('removes trigger instructions from public card descriptions', () => {
    expect(
      sanitizePublicSkillCopy(
        'Creates GitHub pull requests with properly formatted titles. Use when creating PRs, submitting changes for review, or when the user says /pr.',
      ),
    ).toBe('Creates GitHub pull requests with properly formatted titles.');
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

  it('removes instruction blocks from public source excerpts', () => {
    expect(
      sanitizePublicSkillSourceExcerpt(`# Algorithmic Art

Create original generative artwork with p5.js.

CRITICAL GUIDELINES:
- Avoid redundancy: each algorithmic aspect should be mentioned once.
- Do not copy reference artwork.

## Usage

Describe the visual system and export the sketch.`),
    ).toBe(`# Algorithmic Art

Create original generative artwork with p5.js.

## Usage

Describe the visual system and export the sketch.`);
  });

  it('strips leaked process fragments while preserving useful source material', () => {
    expect(
      sanitizePublicSkillSourceExcerpt(`This happens in two steps:

## Capabilities

- Creates interactive browser-based sketches.
- Requires p5.js and browser rendering support.

VARIABLE (must be filled in by the model): Color palette`),
    ).toBe(`## Capabilities

- Creates interactive browser-based sketches.
- Requires p5.js and browser rendering support.`);
  });
});
