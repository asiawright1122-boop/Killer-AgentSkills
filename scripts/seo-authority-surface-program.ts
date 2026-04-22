#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type LocalizedText = Record<string, string>;

type AuthoritySurfaceRecord = {
  id: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  href: string;
  title: LocalizedText;
  description: LocalizedText;
  rationale: LocalizedText;
  placements: string[];
};

type AuthoritySurfaceData = {
  strategy: {
    thesis: LocalizedText;
    principles: Array<{ id: string; title: LocalizedText; description: LocalizedText }>;
  };
  surfaces: AuthoritySurfaceRecord[];
  editorialQueue: Array<{
    id: string;
    surfaceId: string;
    priority: string;
    action: LocalizedText;
    why: LocalizedText;
  }>;
  linkingRules: Array<{ id: string; rule: LocalizedText }>;
};

type RecoveryBoard = {
  overallStatus?: string;
  technicalRecoveryStatus?: string;
  businessRecoveryStatus?: string;
  headline?: string;
};

type GscCtrReport = {
  status?: string;
  sourceMode?: string;
  currentPeriod?: { start?: string; end?: string };
  previousPeriod?: { start?: string; end?: string };
  priorityQueryOpportunities?: number;
  priorityPageOpportunities?: number;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function resolveAuthorityHref(hrefTemplate: string, locale = 'en'): string {
  return `https://killer-skills.com${hrefTemplate.replaceAll('{locale}', locale)}`;
}

function resolveText(text: LocalizedText, locale = 'en'): string {
  return text[locale] || text.en || Object.values(text)[0] || '';
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function buildTierCounts(surfaces: AuthoritySurfaceRecord[]): Record<string, number> {
  return surfaces.reduce<Record<string, number>>((acc, surface) => {
    acc[surface.tier] = (acc[surface.tier] || 0) + 1;
    return acc;
  }, {});
}

function buildFormatCounts(surfaces: AuthoritySurfaceRecord[]): Record<string, number> {
  return surfaces.reduce<Record<string, number>>((acc, surface) => {
    acc[surface.surfaceClass] = (acc[surface.surfaceClass] || 0) + 1;
    return acc;
  }, {});
}

function buildPlacementCounts(surfaces: AuthoritySurfaceRecord[]): Record<string, number> {
  return surfaces.reduce<Record<string, number>>((acc, surface) => {
    for (const placement of surface.placements) {
      acc[placement] = (acc[placement] || 0) + 1;
    }
    return acc;
  }, {});
}

function renderMarkdown(report: any): string {
  const immediateFocus = report.surfaces.filter((surface: any) => surface.tier === 'P0');
  return [
    '# Authority Surface Program',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Thesis',
    report.strategy.thesis.en,
    '',
    '## Summary',
    `- total surfaces: ${report.summary.totalSurfaces}`,
    `- primary surfaces: ${report.summary.primarySurfaces}`,
    `- supporting surfaces: ${report.summary.supportingSurfaces}`,
    `- editorial queue items: ${report.summary.editorialQueueItems}`,
    '',
    '## Evidence Snapshot',
    `- recovery board overall status: ${report.evidence.recoveryBoard.overallStatus}`,
    `- technical recovery status: ${report.evidence.recoveryBoard.technicalRecoveryStatus}`,
    `- business recovery status: ${report.evidence.recoveryBoard.businessRecoveryStatus}`,
    `- GSC source mode: ${report.evidence.gsc.sourceMode}`,
    `- GSC current period: ${report.evidence.gsc.currentPeriod.start} to ${report.evidence.gsc.currentPeriod.end}`,
    '',
    '## Immediate Focus Surfaces',
    ...immediateFocus.map(
      (surface: any) =>
        `- ${surface.id} | ${surface.title.en} | ${surface.surfaceClass} | ${surface.url} | ${surface.rationale.en}`,
    ),
    '',
    '## Linking Rules',
    ...report.linkingRules.map((rule: any) => `- ${rule.rule.en}`),
    '',
    '## Editorial Queue',
    ...report.editorialQueue.map(
      (item: any) => `- ${item.priority.toUpperCase()} | ${item.surfaceId} | ${item.action.en}`,
    ),
    '',
  ].join('\n');
}

const workspaceRoot = process.cwd();
const dataPath = resolve(workspaceRoot, 'data/authority-surfaces.json');
const recoveryBoardPath = resolve(workspaceRoot, 'reports/seo/latest-recovery-control-board.json');
const gscReportPath = resolve(workspaceRoot, 'reports/gsc/latest-ctr-report.json');
const reportDir = resolve(workspaceRoot, 'reports/seo');
const reportJsonPath = resolve(reportDir, 'latest-authority-surface-program.json');
const reportMdPath = resolve(reportDir, 'latest-authority-surface-program.md');

const authorityData = readJson<AuthoritySurfaceData>(dataPath);
const recoveryBoard = readJson<RecoveryBoard>(recoveryBoardPath);
const gscReport = readJson<GscCtrReport>(gscReportPath);
const generatedAt = new Date().toISOString();

assertUnique(authorityData.surfaces.map((surface) => surface.id), 'surface id');
assertUnique(authorityData.editorialQueue.map((item) => item.id), 'editorial queue id');
assertUnique(authorityData.surfaces.map((surface) => resolveAuthorityHref(surface.href)), 'surface href');

for (const queueItem of authorityData.editorialQueue) {
  if (!authorityData.surfaces.some((surface) => surface.id === queueItem.surfaceId)) {
    throw new Error(`Editorial queue references unknown surface: ${queueItem.surfaceId}`);
  }
}

const primarySurfaces = authorityData.surfaces.filter((surface) => surface.role === 'primary');
const supportingSurfaces = authorityData.surfaces.filter((surface) => surface.role === 'supporting');

const report = {
  generatedAt,
  summary: {
    totalSurfaces: authorityData.surfaces.length,
    primarySurfaces: primarySurfaces.length,
    supportingSurfaces: supportingSurfaces.length,
    editorialQueueItems: authorityData.editorialQueue.length,
    tierCounts: buildTierCounts(authorityData.surfaces),
    formatCounts: buildFormatCounts(authorityData.surfaces),
    placementCounts: buildPlacementCounts(authorityData.surfaces),
  },
  strategy: authorityData.strategy,
  evidence: {
    recoveryBoard: {
      overallStatus: recoveryBoard.overallStatus || 'unknown',
      technicalRecoveryStatus: recoveryBoard.technicalRecoveryStatus || 'unknown',
      businessRecoveryStatus: recoveryBoard.businessRecoveryStatus || 'unknown',
      headline: recoveryBoard.headline || '',
    },
    gsc: {
      status: gscReport.status || 'unknown',
      sourceMode: gscReport.sourceMode || 'unknown',
      currentPeriod: gscReport.currentPeriod || {},
      previousPeriod: gscReport.previousPeriod || {},
      priorityQueryOpportunities: gscReport.priorityQueryOpportunities || 0,
      priorityPageOpportunities: gscReport.priorityPageOpportunities || 0,
    },
  },
  surfaces: authorityData.surfaces.map((surface) => ({
    ...surface,
    url: resolveAuthorityHref(surface.href),
    title: {
      en: resolveText(surface.title, 'en'),
      zh: resolveText(surface.title, 'zh'),
    },
    description: {
      en: resolveText(surface.description, 'en'),
      zh: resolveText(surface.description, 'zh'),
    },
    rationale: {
      en: resolveText(surface.rationale, 'en'),
      zh: resolveText(surface.rationale, 'zh'),
    },
  })),
  editorialQueue: authorityData.editorialQueue.map((item) => ({
    ...item,
    action: {
      en: resolveText(item.action, 'en'),
      zh: resolveText(item.action, 'zh'),
    },
    why: {
      en: resolveText(item.why, 'en'),
      zh: resolveText(item.why, 'zh'),
    },
  })),
  linkingRules: authorityData.linkingRules.map((rule) => ({
    ...rule,
    rule: {
      en: resolveText(rule.rule, 'en'),
      zh: resolveText(rule.rule, 'zh'),
    },
  })),
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
writeFileSync(reportMdPath, renderMarkdown(report), 'utf8');

console.log(
  [
    'authority surface program generated',
    `surfaces=${report.summary.totalSurfaces}`,
    `primary=${report.summary.primarySurfaces}`,
    `supporting=${report.summary.supportingSurfaces}`,
    `queue=${report.summary.editorialQueueItems}`,
    `report=${reportMdPath}`,
  ].join(' | '),
);
