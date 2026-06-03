import { describe, expect, it } from 'vitest';
import {
  compareGscSnapshots,
  findCtrOpportunities,
  findQueryPrecisionRisks,
  formatPercent,
  parseGscCsv,
  isRepositoryDirectoryPath,
  aggregateRepositoryDirectoryMetrics,
} from './gsc-report';

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

describe('findQueryPrecisionRisks', () => {
  it('flags off-topic queries and ignores core intent queries', () => {
    const risks = findQueryPrecisionRisks(
      [
        { entity: 'framer animation', clicks: 0, impressions: 120, ctr: 0, position: 12.5 },
        { entity: 'mcp server', clicks: 6, impressions: 180, ctr: 0.033, position: 4.2 },
      ],
      10,
    );

    expect(risks.some((item) => item.entity === 'framer animation' && item.issue === 'off-topic')).toBe(true);
    expect(risks.some((item) => item.entity === 'mcp server')).toBe(false);
  });

  it('flags weak-intent generic queries with no product terms', () => {
    const risks = findQueryPrecisionRisks(
      [{ entity: 'what is product strategy', clicks: 0, impressions: 80, ctr: 0, position: 16 }],
      10,
    );
    expect(risks).toHaveLength(1);
    expect(risks[0].issue).toBe('weak-intent');
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

describe('isRepositoryDirectoryPath', () => {
  it('correctly matches repository directory URLs', () => {
    expect(isRepositoryDirectoryPath('https://killer-skills.com/skills/owner/repo')).toBe(true);
    expect(isRepositoryDirectoryPath('http://localhost:4321/skills/owner/repo/')).toBe(true);
    expect(isRepositoryDirectoryPath('/skills/owner/repo')).toBe(true);
    expect(isRepositoryDirectoryPath('/en/skills/owner/repo')).toBe(true);
    expect(isRepositoryDirectoryPath('/zh-cn/skills/owner/repo')).toBe(true);
  });

  it('ignores non-repository directory URLs', () => {
    expect(isRepositoryDirectoryPath('https://killer-skills.com/skills/owner')).toBe(false);
    expect(isRepositoryDirectoryPath('https://killer-skills.com/skills/owner/repo/skill-name')).toBe(false);
    expect(isRepositoryDirectoryPath('/en/skills/owner/repo/skill-name')).toBe(false);
    expect(isRepositoryDirectoryPath('/en/blog/post-1')).toBe(false);
  });
});

describe('aggregateRepositoryDirectoryMetrics', () => {
  it('aggregates clicks and impressions and calculates weighted position', () => {
    const rows = [
      {
        entity: 'https://killer-skills.com/skills/owner1/repo1',
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 2.0,
      },
      { entity: '/skills/owner2/repo2', clicks: 5, impressions: 50, ctr: 0.1, position: 5.0 },
      { entity: '/skills/owner2/repo2/skill-a', clicks: 20, impressions: 200, ctr: 0.1, position: 1.0 },
      { entity: '/en/blog/other-page', clicks: 50, impressions: 500, ctr: 0.1, position: 1.0 },
    ];

    const result = aggregateRepositoryDirectoryMetrics(rows);
    expect(result.count).toBe(2);
    expect(result.totalClicks).toBe(15);
    expect(result.totalImpressions).toBe(150);
    expect(result.averageCtr).toBe(0.1);
    expect(result.averagePosition).toBe(3.0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].entity).toBe('https://killer-skills.com/skills/owner1/repo1');
    expect(result.rows[1].entity).toBe('/skills/owner2/repo2');
  });
});
