import { describe, expect, it } from 'vitest';
import {
  buildContentGovernanceReport,
  parseContentGovernanceThreshold,
  renderContentGovernanceReport,
} from './content-governance';

describe('content governance', () => {
  it('stays clear when collections and route contracts are healthy', () => {
    const report = buildContentGovernanceReport({
      generatedAt: '2026-04-06T15:20:00.000Z',
      failOnSeverity: 'blocking',
      localeGaps: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        collectionsWithGaps: 0,
        fullCoverageCollections: 35,
        supportedLocales: ['en', 'zh'],
        items: [],
      },
      collectionDrift: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        totalIssues: 0,
        issuesByCode: {},
        items: [],
      },
      routeContracts: {
        command: 'vitest',
        passed: true,
        exitCode: 0,
        summary: 'Representative route contracts passed',
        details: null,
      },
    });

    expect(report.severity).toBe('clear');
    expect(report.gate.blocking).toBe(false);
    expect(renderContentGovernanceReport(report)).toContain('Current severity: clear');
  });

  it('treats structured drift as warning-only and threshold-gated', () => {
    const report = buildContentGovernanceReport({
      generatedAt: '2026-04-06T15:20:00.000Z',
      failOnSeverity: 'warning',
      localeGaps: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        collectionsWithGaps: 2,
        fullCoverageCollections: 33,
        supportedLocales: ['en', 'zh'],
        items: [],
      },
      collectionDrift: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        totalIssues: 0,
        issuesByCode: {},
        items: [],
      },
      routeContracts: {
        command: 'vitest',
        passed: true,
        exitCode: 0,
        summary: 'Representative route contracts passed',
        details: null,
      },
    });

    expect(report.severity).toBe('warning');
    expect(report.gate.blocking).toBe(true);
    expect(report.gate.triggeredChecks).toContain('collection_locale_gaps');
  });

  it('treats route contract failures as blocking', () => {
    const report = buildContentGovernanceReport({
      generatedAt: '2026-04-06T15:20:00.000Z',
      failOnSeverity: 'blocking',
      localeGaps: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        collectionsWithGaps: 0,
        fullCoverageCollections: 35,
        supportedLocales: ['en', 'zh'],
        items: [],
      },
      collectionDrift: {
        generatedAt: '2026-04-06T15:20:00.000Z',
        totalCollections: 35,
        totalIssues: 0,
        issuesByCode: {},
        items: [],
      },
      routeContracts: {
        command: 'vitest',
        passed: false,
        exitCode: 1,
        summary: 'Representative route contracts failed',
        details: 'some failed tests',
      },
    });

    expect(report.severity).toBe('blocking');
    expect(report.gate.blocking).toBe(true);
    expect(parseContentGovernanceThreshold('warning')).toBe('warning');
    expect(renderContentGovernanceReport(report)).toContain('Representative route contracts failed');
  });
});
