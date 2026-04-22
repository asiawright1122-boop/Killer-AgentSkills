import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

export const DEFAULT_COVERAGE_DRILLDOWN_PREFIX = 'killer-skills.com-Coverage-Drilldown';
export const DEFAULT_COVERAGE_DRILLDOWN_ARCHIVE_DIR = 'data/coverage-drilldown-raw';

export type CoverageDrilldownCsvRole = 'metadata' | 'chart' | 'table';
export type CoverageDrilldownCsvPaths = Record<CoverageDrilldownCsvRole, string>;
export type CoverageDrilldownSourceOrigin = 'archive' | 'downloads';
export type CoverageDrilldownDownloadCandidateKind = 'directory' | 'zip';
export type CoverageDrilldownMetadata = Record<string, string>;

export type CoverageDrilldownMatchedFile = {
  role: CoverageDrilldownCsvRole;
  filePath: string;
  fileName: string;
  header: string[];
};

export type CoverageDrilldownDirectoryInspection = {
  directoryPath: string;
  folderName: string;
  detectedDate: string | null;
  csvPaths: CoverageDrilldownCsvPaths | null;
  matchedFiles: CoverageDrilldownMatchedFile[];
  missingRoles: CoverageDrilldownCsvRole[];
};

export type CoverageDrilldownSourceDirectory = {
  directoryPath: string;
  folderName: string;
  detectedDate: string | null;
  origin: CoverageDrilldownSourceOrigin;
  csvPaths: CoverageDrilldownCsvPaths;
};

export type CoverageDrilldownDownloadCandidate = {
  kind: CoverageDrilldownDownloadCandidateKind;
  path: string;
  folderName: string;
  detectedDate: string | null;
};

export type CoverageDrilldownIngestRecord = {
  sourceKind: CoverageDrilldownDownloadCandidateKind;
  sourcePath: string;
  folderName: string;
  detectedDate: string | null;
  archiveDirectory: string;
  csvPaths: CoverageDrilldownCsvPaths;
  manifestPath: string;
};

const ROLE_ORDER: CoverageDrilldownCsvRole[] = ['metadata', 'chart', 'table'];
const CANONICAL_FILE_NAMES: Record<CoverageDrilldownCsvRole, string> = {
  metadata: 'metadata.csv',
  chart: 'chart.csv',
  table: 'table.csv',
};
const LEGACY_FILE_NAMES: Record<CoverageDrilldownCsvRole, string> = {
  metadata: '元数据.csv',
  chart: '图表.csv',
  table: '表格.csv',
};
const SOURCE_ORIGIN_PRIORITY: Record<CoverageDrilldownSourceOrigin, number> = {
  archive: 2,
  downloads: 1,
};

function normalizeHeaderCell(value: string): string {
  return String(value || '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeCsvCell(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseCoverageDrilldownCsv(content: string): string[][] {
  const rows: string[][] = [];
  const normalizedContent = content.replace(/^\ufeff/, '');
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalizedContent.length; i++) {
    const char = normalizedContent[i];

    if (char === '"') {
      if (inQuotes && normalizedContent[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(normalizeCsvCell(current));
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && normalizedContent[i + 1] === '\n') {
        i++;
      }
      row.push(normalizeCsvCell(current));
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(normalizeCsvCell(current));
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function readCsvHeader(content: string): string[] {
  return parseCoverageDrilldownCsv(content)[0] || [];
}

export function classifyCoverageDrilldownCsvRole(header: string[]): CoverageDrilldownCsvRole | null {
  const first = normalizeHeaderCell(header[0] || '');
  const second = normalizeHeaderCell(header[1] || '');

  if ((first === '资源' || first === 'resource') && (second === '值' || second === 'value')) {
    return 'metadata';
  }

  if ((first === '日期' || first === 'date') && (second === '受影响的网页数' || second === 'affectedpages')) {
    return 'chart';
  }

  if (
    (first === '网址' || first === 'url') &&
    (second === '上次抓取日期' || second === 'lastcrawldate' || second === 'lastcrawled')
  ) {
    return 'table';
  }

  return null;
}

export function classifyCoverageDrilldownCsvRoleFromContent(content: string): CoverageDrilldownCsvRole | null {
  return classifyCoverageDrilldownCsvRole(readCsvHeader(content));
}

export function readCoverageDrilldownMetadata(csvPaths: CoverageDrilldownCsvPaths): CoverageDrilldownMetadata {
  const rows = parseCoverageDrilldownCsv(readFileSync(csvPaths.metadata, 'utf8'));

  const metadata: CoverageDrilldownMetadata = {};
  for (const row of rows.slice(1)) {
    const key = String(row[0] || '').trim();
    const value = String(row[1] || '').trim();
    if (!key) continue;
    metadata[key] = value;
  }

  return metadata;
}

function filePreference(role: CoverageDrilldownCsvRole, fileName: string): number {
  if (fileName === CANONICAL_FILE_NAMES[role]) return 3;
  if (fileName === LEGACY_FILE_NAMES[role]) return 2;
  return 1;
}

export function parseCoverageDrilldownDirectoryDate(pathOrName: string): string | null {
  const match = basename(pathOrName).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function inspectCoverageDrilldownDirectory(dirPath: string): CoverageDrilldownDirectoryInspection {
  const resolvedDir = resolve(dirPath);
  const folderName = basename(resolvedDir);
  const matchedFiles: CoverageDrilldownMatchedFile[] = [];
  const selected = new Map<
    CoverageDrilldownCsvRole,
    { path: string; fileName: string; header: string[]; score: number }
  >();

  if (!existsSync(resolvedDir)) {
    return {
      directoryPath: resolvedDir,
      folderName,
      detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
      csvPaths: null,
      matchedFiles,
      missingRoles: [...ROLE_ORDER],
    };
  }

  let stats;
  try {
    stats = statSync(resolvedDir);
  } catch {
    stats = null;
  }

  if (!stats?.isDirectory()) {
    return {
      directoryPath: resolvedDir,
      folderName,
      detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
      csvPaths: null,
      matchedFiles,
      missingRoles: [...ROLE_ORDER],
    };
  }

  const entries = readdirSync(resolvedDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  for (const entry of entries) {
    const filePath = join(resolvedDir, entry.name);
    let content = '';
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const header = readCsvHeader(content);
    const role = classifyCoverageDrilldownCsvRole(header);
    if (!role) continue;

    matchedFiles.push({
      role,
      filePath,
      fileName: entry.name,
      header,
    });

    const score = filePreference(role, entry.name);
    const current = selected.get(role);
    if (!current || score > current.score || (score === current.score && entry.name.localeCompare(current.fileName) < 0)) {
      selected.set(role, {
        path: filePath,
        fileName: entry.name,
        header,
        score,
      });
    }
  }

  const missingRoles = ROLE_ORDER.filter((role) => !selected.has(role));
  const csvPaths =
    missingRoles.length === 0
      ? {
          metadata: selected.get('metadata')!.path,
          chart: selected.get('chart')!.path,
          table: selected.get('table')!.path,
        }
      : null;

  return {
    directoryPath: resolvedDir,
    folderName,
    detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
    csvPaths,
    matchedFiles,
    missingRoles,
  };
}

export function resolveCoverageDrilldownCsvPaths(dirPath: string): CoverageDrilldownCsvPaths | null {
  return inspectCoverageDrilldownDirectory(dirPath).csvPaths;
}

export function isCoverageDrilldownDirectory(dirPath: string): boolean {
  return Boolean(resolveCoverageDrilldownCsvPaths(dirPath));
}

export function resolveCoverageDrilldownArchiveDir(
  rootDir = process.cwd(),
  archiveDir = DEFAULT_COVERAGE_DRILLDOWN_ARCHIVE_DIR,
): string {
  return resolve(rootDir, archiveDir);
}

export function findCoverageDrilldownDownloadDirectories(downloadsDir?: string | null): string[] {
  if (downloadsDir === '') return [];

  const resolvedDownloadsDir =
    typeof downloadsDir === 'string'
      ? resolve(downloadsDir)
      : process.env.HOME
        ? resolve(process.env.HOME, 'Downloads')
        : '';

  if (!resolvedDownloadsDir || !existsSync(resolvedDownloadsDir)) return [];

  return readdirSync(resolvedDownloadsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(DEFAULT_COVERAGE_DRILLDOWN_PREFIX))
    .map((entry) => join(resolvedDownloadsDir, entry.name))
    .sort((a, b) => compareCoverageNames(basename(a), basename(b)));
}

export function findCoverageDrilldownDownloadArchives(downloadsDir?: string | null): string[] {
  if (downloadsDir === '') return [];

  const resolvedDownloadsDir =
    typeof downloadsDir === 'string'
      ? resolve(downloadsDir)
      : process.env.HOME
        ? resolve(process.env.HOME, 'Downloads')
        : '';

  if (!resolvedDownloadsDir || !existsSync(resolvedDownloadsDir)) return [];

  return readdirSync(resolvedDownloadsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(DEFAULT_COVERAGE_DRILLDOWN_PREFIX) &&
        entry.name.toLowerCase().endsWith('.zip'),
    )
    .map((entry) => join(resolvedDownloadsDir, entry.name))
    .sort((a, b) => compareCoverageNames(basename(a, extname(a)), basename(b, extname(b))));
}

function compareCoverageNames(a: string, b: string): number {
  const aDate = parseCoverageDrilldownDirectoryDate(a) || '';
  const bDate = parseCoverageDrilldownDirectoryDate(b) || '';
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  return a.localeCompare(b, 'zh-Hans-CN');
}

export function findCoverageDrilldownArchiveDirectories(
  archiveDir = resolveCoverageDrilldownArchiveDir(),
): CoverageDrilldownSourceDirectory[] {
  const resolvedArchiveDir = resolve(archiveDir);
  if (!existsSync(resolvedArchiveDir)) return [];

  return readdirSync(resolvedArchiveDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(DEFAULT_COVERAGE_DRILLDOWN_PREFIX))
    .map((entry) => inspectCoverageDrilldownDirectory(join(resolvedArchiveDir, entry.name)))
    .filter(
      (inspection): inspection is CoverageDrilldownDirectoryInspection & { csvPaths: CoverageDrilldownCsvPaths } =>
        Boolean(inspection.csvPaths),
    )
    .map((inspection) => ({
      directoryPath: inspection.directoryPath,
      folderName: inspection.folderName,
      detectedDate: inspection.detectedDate,
      origin: 'archive' as const,
      csvPaths: inspection.csvPaths,
    }))
    .sort((a, b) => compareCoverageNames(a.folderName, b.folderName));
}

export function discoverCoverageDrilldownSourceDirectories(options?: {
  archiveDir?: string;
  downloadsDir?: string | null;
}): CoverageDrilldownSourceDirectory[] {
  const archiveSources = findCoverageDrilldownArchiveDirectories(
    options?.archiveDir || resolveCoverageDrilldownArchiveDir(),
  );
  const downloadSources = findCoverageDrilldownDownloadDirectories(options?.downloadsDir)
    .map((dirPath) => inspectCoverageDrilldownDirectory(dirPath))
    .filter(
      (inspection): inspection is CoverageDrilldownDirectoryInspection & { csvPaths: CoverageDrilldownCsvPaths } =>
        Boolean(inspection.csvPaths),
    )
    .map((inspection) => ({
      directoryPath: inspection.directoryPath,
      folderName: inspection.folderName,
      detectedDate: inspection.detectedDate,
      origin: 'downloads' as const,
      csvPaths: inspection.csvPaths,
    }));

  const deduped = new Map<string, CoverageDrilldownSourceDirectory>();
  for (const source of [...archiveSources, ...downloadSources]) {
    const current = deduped.get(source.folderName);
    if (!current || SOURCE_ORIGIN_PRIORITY[source.origin] > SOURCE_ORIGIN_PRIORITY[current.origin]) {
      deduped.set(source.folderName, source);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const byName = compareCoverageNames(a.folderName, b.folderName);
    if (byName !== 0) return byName;
    return SOURCE_ORIGIN_PRIORITY[b.origin] - SOURCE_ORIGIN_PRIORITY[a.origin];
  });
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeManifest(path: string, content: unknown): void {
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

export function ingestCoverageDrilldownDirectory(options: {
  sourcePath: string;
  sourceKind?: CoverageDrilldownDownloadCandidateKind;
  archiveDir?: string;
  folderName?: string;
  ingestedAt?: string;
}): CoverageDrilldownIngestRecord {
  const sourcePath = resolve(options.sourcePath);
  const inspection = inspectCoverageDrilldownDirectory(sourcePath);
  if (!inspection.csvPaths) {
    throw new Error(
      `Coverage Drilldown source is incomplete: ${sourcePath} (missing roles: ${inspection.missingRoles.join(', ') || 'unknown'})`,
    );
  }

  const archiveDir = resolve(options.archiveDir || resolveCoverageDrilldownArchiveDir());
  const folderName = options.folderName || inspection.folderName;
  const targetDir = join(archiveDir, folderName);
  mkdirSync(targetDir, { recursive: true });

  const csvPaths = {} as CoverageDrilldownCsvPaths;
  const files = ROLE_ORDER.map((role) => {
    const sourceFilePath = inspection.csvPaths![role];
    const targetFilePath = join(targetDir, CANONICAL_FILE_NAMES[role]);
    copyFileSync(sourceFilePath, targetFilePath);
    csvPaths[role] = targetFilePath;

    return {
      role,
      sourceFileName: basename(sourceFilePath),
      sourcePath: sourceFilePath,
      archivePath: targetFilePath,
      sha256: sha256File(targetFilePath),
      bytes: statSync(targetFilePath).size,
    };
  });

  const manifestPath = join(targetDir, 'manifest.json');
  writeManifest(manifestPath, {
    ingestedAt: options.ingestedAt || new Date().toISOString(),
    sourceKind: options.sourceKind || 'directory',
    sourcePath,
    folderName,
    detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
    archiveDirectory: targetDir,
    files,
  });

  return {
    sourceKind: options.sourceKind || 'directory',
    sourcePath,
    folderName,
    detectedDate: parseCoverageDrilldownDirectoryDate(folderName),
    archiveDirectory: targetDir,
    csvPaths,
    manifestPath,
  };
}

function extractCoverageDrilldownZip(zipPath: string, destinationDir: string): void {
  const unzipResult = spawnSync('unzip', ['-oq', zipPath, '-d', destinationDir], {
    encoding: 'utf8',
  });
  if (unzipResult.status === 0) return;

  const dittoResult = spawnSync('ditto', ['-x', '-k', zipPath, destinationDir], {
    encoding: 'utf8',
  });
  if (dittoResult.status === 0) return;

  throw new Error(
    [
      `Failed to extract Coverage Drilldown archive: ${zipPath}`,
      unzipResult.stderr?.trim(),
      dittoResult.stderr?.trim(),
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

function findCoverageDrilldownDirectoryInExtractRoot(rootDir: string): string | null {
  if (isCoverageDrilldownDirectory(rootDir)) return rootDir;

  const entries = readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rootDir, entry.name))
    .filter((entryPath) => isCoverageDrilldownDirectory(entryPath))
    .sort((a, b) => compareCoverageNames(basename(a), basename(b)));

  return entries[0] || null;
}

export function ingestCoverageDrilldownZip(options: {
  zipPath: string;
  archiveDir?: string;
  folderName?: string;
  ingestedAt?: string;
}): CoverageDrilldownIngestRecord {
  const zipPath = resolve(options.zipPath);
  const tempDir = mkdtempSync(join(tmpdir(), 'coverage-drilldown-'));

  try {
    extractCoverageDrilldownZip(zipPath, tempDir);
    const extractedSourceDir = findCoverageDrilldownDirectoryInExtractRoot(tempDir);
    if (!extractedSourceDir) {
      throw new Error(`Extracted archive does not contain a valid Coverage Drilldown export: ${zipPath}`);
    }

    return ingestCoverageDrilldownDirectory({
      sourcePath: extractedSourceDir,
      sourceKind: 'zip',
      archiveDir: options.archiveDir,
      folderName: options.folderName || basename(zipPath, extname(zipPath)),
      ingestedAt: options.ingestedAt,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
