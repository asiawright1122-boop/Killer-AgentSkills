import { describe, expect, it } from 'vitest';
import { compareGscSnapshots, findCtrOpportunities, formatPercent, parseGscCsv } from './gsc-report';

describe('parseGscCsv', () => {
  it('parses English GSC CSV exports', () => {
    const csv = `Top queries,Clicks,Impressions,CTR,Position
mcp server,10,500,2.0%,5.2
claude code skills,5,200,2.5%,3.4`;

    const rows = parseGscCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].entity).toBe('mcp server');
    expect(rows[0].ctr).toBe(0.02);
  });

  it('parses Chinese GSC CSV exports', () => {
    const csv = `热门网页,点击次数,展示次数,平均点击率,平均排名
/zh/skills/foo/bar,4,120,3.3%,8.1`;

    const rows = parseGscCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('/zh/skills/foo/bar');
    expect(rows[0].impressions).toBe(120);
  });
});

describe('findCtrOpportunities', () => {
  it('prioritizes high-impression low-CTR query opportunities', () => {
    const opportunities = findCtrOpportunities(
      [
        { entity: 'mcp server', clicks: 10, impressions: 500, ctr: 0.02, position: 5.2 },
        { entity: 'niche query', clicks: 1, impressions: 25, ctr: 0.04, position: 4.5 },
      ],
      'query',
      10,
    );

    expect(opportunities[0].entity).toBe('mcp server');
    expect(opportunities[0].bucket).toBe('ctr');
    expect(opportunities[0].actions.some((action) => action.includes('MCP Server'))).toBe(true);
  });
});

describe('formatPercent', () => {
  it('formats percentages consistently', () => {
    expect(formatPercent(0.0234)).toBe('2.34%');
  });
});

describe('compareGscSnapshots', () => {
  it('detects improved entities across snapshots', () => {
    const comparisons = compareGscSnapshots(
      [{ entity: 'mcp server', clicks: 20, impressions: 500, ctr: 0.04, position: 4.5 }],
      [{ entity: 'mcp server', clicks: 10, impressions: 480, ctr: 0.02, position: 4.8 }],
      10,
    );

    expect(comparisons[0].status).toBe('improved');
    expect(comparisons[0].deltaCtr).toBeCloseTo(0.02, 5);
  });

  it('marks missing previous entities as new', () => {
    const comparisons = compareGscSnapshots(
      [{ entity: '/en/skills/foo/bar', clicks: 3, impressions: 60, ctr: 0.05, position: 8.2 }],
      [],
      10,
    );

    expect(comparisons[0].status).toBe('new');
    expect(comparisons[0].previous).toBeNull();
  });
});
