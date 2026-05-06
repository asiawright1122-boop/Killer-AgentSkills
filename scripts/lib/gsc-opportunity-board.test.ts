import { describe, expect, it } from 'vitest';
import { buildGscOpportunityBoardReport } from './gsc-opportunity-board';

describe('buildGscOpportunityBoardReport', () => {
  it('blocks when Search Console evidence is unavailable', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'blocking',
        sourceMode: 'missing-config',
        failureReason: 'Missing GSC settings.',
        nextStep: 'Configure GSC secrets.',
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('Missing GSC settings.');
    expect(report.nextActions).toContain('Configure GSC secrets.');
  });

  it('keeps explicit 301 consolidation URLs out of metadata rewrite work', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [
        {
          entity: 'https://killer-skills.com/en/skills/callstackincubator/agent-skills',
          clicks: 0,
          impressions: 14,
          ctr: 0,
          position: 4.9,
        },
        {
          entity: 'https://killer-skills.com/en/blog/example',
          clicks: 1,
          impressions: 3,
          ctr: 0.33,
          position: 1,
        },
      ],
      currentQueries: [],
    });

    expect(report.status).toBe('active');
    expect(report.items[0]?.entity).toContain('/skills/callstackincubator/agent-skills');
    expect(report.items[0]?.priority).toBe('P0');
    expect(report.items[0]?.lane).toBe('canonicalization');
    expect(report.items[0]?.actions.join(' ')).toContain('Explicit 301 consolidation rule');
  });

  it('prioritizes canonical page-one zero-click pages for metadata review', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [
        {
          entity: 'https://killer-skills.com/en/skills/Dynokostya/just-works',
          clicks: 0,
          impressions: 5,
          ctr: 0,
          position: 1.4,
        },
      ],
      currentQueries: [],
    });

    expect(report.items[0]?.lane).toBe('metadata');
  });

  it('keeps weak-intent queries as narrowing signals instead of expansion targets', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [],
      currentQueries: [
        {
          entity: 'refactorisation react native',
          clicks: 0,
          impressions: 13,
          ctr: 0,
          position: 9,
        },
      ],
    });

    expect(report.items[0]?.priority).toBe('P3');
    expect(report.items[0]?.lane).toBe('query-intent');
    expect(report.items[0]?.actions.join(' ')).toContain('Do not chase this query directly');
  });

  it('classifies non-canonical host pages as canonicalization work instead of snippet work', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [
        {
          entity: 'https://www.killer-skills.com/fr/favorites',
          clicks: 0,
          impressions: 5,
          ctr: 0,
          position: 2.4,
        },
      ],
      currentQueries: [],
    });

    expect(report.items[0]?.lane).toBe('canonicalization');
    expect(report.items[0]?.actions.join(' ')).toContain('Non-canonical host');
  });

  it('classifies trailing-slash variants as canonicalization work instead of snippet work', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [
        {
          entity: 'https://killer-skills.com/en/skills/github/awesome-copilot/gh-cli/',
          clicks: 0,
          impressions: 5,
          ctr: 0,
          position: 1.2,
        },
      ],
      currentQueries: [],
    });

    expect(report.items[0]?.lane).toBe('canonicalization');
    expect(report.items[0]?.actions.join(' ')).toContain('Trailing-slash URL variant');
  });

  it('classifies suppressed locale variants as canonicalization work instead of snippet work', () => {
    const report = buildGscOpportunityBoardReport({
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        previousPeriod: { start: '2026-03-11', end: '2026-04-07' },
      },
      currentPages: [
        {
          entity: 'https://killer-skills.com/ja/skills/0boluan0/Notes_on_Economic_Statistics/today',
          clicks: 0,
          impressions: 5,
          ctr: 0,
          position: 4,
        },
      ],
      currentQueries: [],
    });

    expect(report.items[0]?.lane).toBe('canonicalization');
    expect(report.items[0]?.actions.join(' ')).toContain('Suppressed locale variant');
  });
});
