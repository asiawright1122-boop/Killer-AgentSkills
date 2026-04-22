import { describe, expect, it } from 'vitest';

import { extractMarkdownHeadings, slugifyHeading } from './markdown-headings';

describe('markdown-headings', () => {
  it('extracts supported heading levels in order', () => {
    const markdown = ['# Title', '## Overview', '### Install & Setup', '#### Ignored', '## Architecture'].join('\n');

    expect(extractMarkdownHeadings(markdown)).toEqual([
      { id: 'overview', label: 'Overview', level: 2 },
      { id: 'install-setup', label: 'Install & Setup', level: 3 },
      { id: 'architecture', label: 'Architecture', level: 2 },
    ]);
  });

  it('dedupes repeated headings', () => {
    const markdown = ['## Features', '## Features', '### Features'].join('\n');

    expect(extractMarkdownHeadings(markdown)).toEqual([
      { id: 'features', label: 'Features', level: 2 },
      { id: 'features-2', label: 'Features', level: 2 },
      { id: 'features-3', label: 'Features', level: 3 },
    ]);
  });

  it('normalizes markdown decorations before slugifying', () => {
    expect(slugifyHeading('## [`Skill`](https://example.com) Overview')).toBe('skill-overview');
  });
});
