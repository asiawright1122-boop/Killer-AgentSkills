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

  it('removes hidden reasoning sections from public generated copy', () => {
    expect(
      sanitizePublicSkillCopy(`Chain of thought:
private ranking notes

API Skills helps teams design stable integration workflows.`),
    ).toBe('API Skills helps teams design stable integration workflows.');
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
        'Each reference file follows a hybrid format for fast lookup and deep understanding:',
        'Quick Pattern: Incorrect/Correct code snippets for immediate pattern matching',
      ]),
    ).toEqual(['Algorithmic Philosophy Creation', 'Interactive Visualization']);
  });

  it('removes generic AI-agent fit boilerplate before metadata and schema rendering', () => {
    expect(
      sanitizePublicSkillCopy(
        'Ideal for AI agents that need react native best practices. react-native-best-practices is an AI agent skill for React Native performance reviews.',
      ),
    ).toBe('react-native-best-practices is an AI agent skill for React Native performance reviews.');
  });

  it('removes incomplete metadata tails left by upstream truncation', () => {
    expect(
      sanitizePublicSkillCopy(
        'Provides React Native performance optimization guidelines for FPS, TTI, bundle size, memory leaks, re-renders, and animations. This AI agent skill supports.',
      ),
    ).toBe(
      'Provides React Native performance optimization guidelines for FPS, TTI, bundle size, memory leaks, re-renders, and animations.',
    );
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

  it('removes hidden reasoning blocks from public source excerpts', () => {
    expect(
      sanitizePublicSkillSourceExcerpt(`# API Skills

<thinking>internal comparison notes</thinking>

Helps agents produce stable API integration plans.

## Usage

Describe the API surface and target client.`),
    ).toBe(`# API Skills

Helps agents produce stable API integration plans.

## Usage

Describe the API surface and target client.`);
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
