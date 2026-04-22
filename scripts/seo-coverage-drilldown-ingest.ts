#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import {
  DEFAULT_COVERAGE_DRILLDOWN_ARCHIVE_DIR,
  discoverCoverageDrilldownSourceDirectories,
  findCoverageDrilldownArchiveDirectories,
  findCoverageDrilldownDownloadArchives,
  findCoverageDrilldownDownloadDirectories,
  ingestCoverageDrilldownDirectory,
  ingestCoverageDrilldownZip,
  inspectCoverageDrilldownDirectory,
  parseCoverageDrilldownDirectoryDate,
} from './lib/coverage-drilldown-source';

type IngestStatus = 'imported' | 'skipped';

type IngestReportItem = {
  status: IngestStatus;
  sourceKind: 'directory' | 'zip';
  sourcePath: string;
  folderName: string;
  detectedDate: string | null;
  archiveDirectory?: string;
  manifestPath?: string;
  reason?: string;
};

type IngestReport = {
  generatedAt: string;
  archiveDirectory: string;
  downloadsDirectory: string | null;
  archiveSourceCountBefore: number;
  archiveSourceCountAfter: number;
  imported: IngestReportItem[];
  skipped: IngestReportItem[];
  latestArchivedSourceDate: string | null;
  latestArchivedSourceDirectory: string | null;
};

const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-drilldown-ingest.md');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-drilldown-ingest.json');

function detectDownloadsDirectory(): string | null {
  return process.env.HOME ? resolve(process.env.HOME, 'Downloads') : null;
}

function renderMarkdown(report: IngestReport): string {
  const lines: string[] = [];
  lines.push('# Coverage Drilldown Ingest');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Archive directory: ${report.archiveDirectory}`);
  lines.push(`- Downloads directory: ${report.downloadsDirectory || 'missing'}`);
  lines.push(`- Archive sources before ingest: ${report.archiveSourceCountBefore}`);
  lines.push(`- Archive sources after ingest: ${report.archiveSourceCountAfter}`);
  lines.push(`- Imported: ${report.imported.length}`);
  lines.push(`- Skipped: ${report.skipped.length}`);
  lines.push(`- Latest archived source date: ${report.latestArchivedSourceDate || 'missing'}`);
  if (report.latestArchivedSourceDirectory) {
    lines.push(`- Latest archived source directory: ${report.latestArchivedSourceDirectory}`);
  }
  lines.push('');
  lines.push('## Imported');
  lines.push('');
  if (report.imported.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.imported) {
      lines.push(`- ${item.folderName} | kind=${item.sourceKind} | date=${item.detectedDate || 'missing'}`);
      lines.push(`  - Source: ${item.sourcePath}`);
      lines.push(`  - Archive: ${item.archiveDirectory || 'n/a'}`);
      lines.push(`  - Manifest: ${item.manifestPath || 'n/a'}`);
    }
  }
  lines.push('');
  lines.push('## Skipped');
  lines.push('');
  if (report.skipped.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.skipped) {
      lines.push(`- ${item.folderName} | kind=${item.sourceKind} | reason=${item.reason || 'n/a'}`);
      lines.push(`  - Source: ${item.sourcePath}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const generatedAt = new Date().toISOString();
  const archiveDir = resolve(process.cwd(), DEFAULT_COVERAGE_DRILLDOWN_ARCHIVE_DIR);
  const downloadsDir = detectDownloadsDirectory();

  const archiveSourcesBefore = findCoverageDrilldownArchiveDirectories(archiveDir);
  const imported: IngestReportItem[] = [];
  const skipped: IngestReportItem[] = [];

  const downloadDirectoryCandidates = findCoverageDrilldownDownloadDirectories(downloadsDir || '');
  const zipCandidates = findCoverageDrilldownDownloadArchives(downloadsDir || '');
  const preferredDirectoryByFolder = new Map<string, string>();

  for (const dirPath of downloadDirectoryCandidates) {
    const inspection = inspectCoverageDrilldownDirectory(dirPath);
    if (!inspection.csvPaths) {
      skipped.push({
        status: 'skipped',
        sourceKind: 'directory',
        sourcePath: dirPath,
        folderName: inspection.folderName,
        detectedDate: inspection.detectedDate,
        reason: `invalid_directory_missing_${inspection.missingRoles.join('_') || 'unknown'}`,
      });
      continue;
    }

    preferredDirectoryByFolder.set(inspection.folderName, dirPath);
    const result = ingestCoverageDrilldownDirectory({
      sourcePath: dirPath,
      archiveDir,
      ingestedAt: generatedAt,
    });
    imported.push({
      status: 'imported',
      sourceKind: 'directory',
      sourcePath: dirPath,
      folderName: result.folderName,
      detectedDate: result.detectedDate,
      archiveDirectory: result.archiveDirectory,
      manifestPath: result.manifestPath,
    });
  }

  for (const zipPath of zipCandidates) {
    const folderName = basename(zipPath, extname(zipPath));
    if (preferredDirectoryByFolder.has(folderName)) {
      skipped.push({
        status: 'skipped',
        sourceKind: 'zip',
        sourcePath: zipPath,
        folderName,
        detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
        reason: 'directory_already_available',
      });
      continue;
    }

    try {
      const result = ingestCoverageDrilldownZip({
        zipPath,
        archiveDir,
        folderName,
        ingestedAt: generatedAt,
      });
      imported.push({
        status: 'imported',
        sourceKind: 'zip',
        sourcePath: zipPath,
        folderName: result.folderName,
        detectedDate: result.detectedDate,
        archiveDirectory: result.archiveDirectory,
        manifestPath: result.manifestPath,
      });
    } catch (error) {
      skipped.push({
        status: 'skipped',
        sourceKind: 'zip',
        sourcePath: zipPath,
        folderName,
        detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
        reason: error instanceof Error ? error.message : 'zip_ingest_failed',
      });
    }
  }

  const archiveSourcesAfter = findCoverageDrilldownArchiveDirectories(archiveDir);
  if (archiveSourcesAfter.length === 0 && imported.length === 0) {
    console.error(
      [
        'No valid Coverage Drilldown raw sources are available.',
        `Checked archive: ${archiveDir}`,
        downloadsDir ? `Checked downloads: ${downloadsDir}` : 'Downloads directory: missing',
      ].join('\n'),
    );
    process.exit(1);
  }

  const latestArchivedSource = discoverCoverageDrilldownSourceDirectories({
    archiveDir,
    downloadsDir: '',
  })[0];

  const report: IngestReport = {
    generatedAt,
    archiveDirectory: archiveDir,
    downloadsDirectory: downloadsDir,
    archiveSourceCountBefore: archiveSourcesBefore.length,
    archiveSourceCountAfter: archiveSourcesAfter.length,
    imported,
    skipped,
    latestArchivedSourceDate: latestArchivedSource?.detectedDate || null,
    latestArchivedSourceDirectory: latestArchivedSource?.directoryPath || null,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT, renderMarkdown(report), 'utf8');

  console.log(`Wrote ingest report to ${MD_OUTPUT}`);
  console.log(`Wrote ingest JSON to ${JSON_OUTPUT}`);
  console.log(`Imported sources: ${report.imported.length}`);
  console.log(`Latest archived source: ${report.latestArchivedSourceDate || 'missing'}`);
}

main();
