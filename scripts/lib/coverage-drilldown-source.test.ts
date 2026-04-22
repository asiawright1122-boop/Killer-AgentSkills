import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyCoverageDrilldownCsvRoleFromContent,
  discoverCoverageDrilldownSourceDirectories,
  ingestCoverageDrilldownDirectory,
  inspectCoverageDrilldownDirectory,
  parseCoverageDrilldownCsv,
  readCoverageDrilldownMetadata,
} from './coverage-drilldown-source';

function write(root: string, relativePath: string, content: string): string {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function seedCoverageExport(root: string, folderName: string, fileNames?: { metadata: string; chart: string; table: string }): string {
  const dir = join(root, folderName);
  const names = fileNames || {
    metadata: '元数据.csv',
    chart: '图表.csv',
    table: '表格.csv',
  };

  write(
    dir,
    names.metadata,
    ['资源,值', '站点地图,所有已知网页', '问题名称,未找到 (404)', '导出时间,2026-04-03'].join('\n'),
  );
  write(
    dir,
    names.chart,
    ['日期,受影响的网页数', '2026-04-01,7', '2026-04-03,9'].join('\n'),
  );
  write(
    dir,
    names.table,
    ['网址,上次抓取日期', 'https://killer-skills.com/en/skills/demo/repo/,2026-04-01'].join('\n'),
  );

  return dir;
}

describe('coverage drilldown source', () => {
  it('recognizes csv roles from content even when filenames are mangled', () => {
    expect(classifyCoverageDrilldownCsvRoleFromContent('资源,值\n站点地图,所有已知网页\n')).toBe('metadata');
    expect(classifyCoverageDrilldownCsvRoleFromContent('日期,受影响的网页数\n2026-04-03,9\n')).toBe('chart');
    expect(classifyCoverageDrilldownCsvRoleFromContent('网址,上次抓取日期\nhttps://example.com,2026-04-03\n')).toBe('table');

    const root = mkdtempSync(join(tmpdir(), 'coverage-source-headers-'));
    const dir = seedCoverageExport(root, 'killer-skills.com-Coverage-Drilldown-2026-04-03', {
      metadata: 'Õø¥Þí¿.csv',
      chart: 'Þí¿µá+.csv',
      table: 'Õàâµò¦µì«.csv',
    });

    const inspection = inspectCoverageDrilldownDirectory(dir);
    expect(inspection.csvPaths).not.toBeNull();
    expect(basename(inspection.csvPaths!.metadata)).toBe('Õø¥Þí¿.csv');
    expect(basename(inspection.csvPaths!.chart)).toBe('Þí¿µá+.csv');
    expect(basename(inspection.csvPaths!.table)).toBe('Õàâµò¦µì«.csv');
    expect(readCoverageDrilldownMetadata(inspection.csvPaths!)).toMatchObject({
      问题名称: '未找到 (404)',
      站点地图: '所有已知网页',
    });
  });

  it('parses multiline quoted csv cells without splitting url rows', () => {
    const rows = parseCoverageDrilldownCsv(
      [
        '网址,上次抓取日期',
        '"https://killer-skills.com/fr/skills?q=donn%C3%A9es de films et de ',
        's%C3%A9ries TV",2026-04-10',
      ].join('\n'),
    );

    expect(rows).toEqual([
      ['网址', '上次抓取日期'],
      ['https://killer-skills.com/fr/skills?q=donn%C3%A9es de films et de s%C3%A9ries TV', '2026-04-10'],
    ]);
  });

  it('ingests a coverage directory into canonical archive files with a manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-source-ingest-'));
    const sourceDir = seedCoverageExport(root, 'killer-skills.com-Coverage-Drilldown-2026-04-03', {
      metadata: 'Õø¥Þí¿.csv',
      chart: 'Þí¿µá+.csv',
      table: 'Õàâµò¦µì«.csv',
    });
    const archiveRoot = join(root, 'archive');

    const result = ingestCoverageDrilldownDirectory({
      sourcePath: sourceDir,
      archiveDir: archiveRoot,
      ingestedAt: '2026-04-16T00:00:00.000Z',
    });

    expect(result.archiveDirectory).toBe(join(archiveRoot, 'killer-skills.com-Coverage-Drilldown-2026-04-03'));
    expect(basename(result.csvPaths.metadata)).toBe('metadata.csv');
    expect(basename(result.csvPaths.chart)).toBe('chart.csv');
    expect(basename(result.csvPaths.table)).toBe('table.csv');
    expect(existsSync(result.manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8')) as {
      sourceKind: string;
      files: Array<{ role: string; sourceFileName: string }>;
    };
    expect(manifest.sourceKind).toBe('directory');
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'metadata', sourceFileName: 'Õø¥Þí¿.csv' }),
        expect.objectContaining({ role: 'chart', sourceFileName: 'Þí¿µá+.csv' }),
        expect.objectContaining({ role: 'table', sourceFileName: 'Õàâµò¦µì«.csv' }),
      ]),
    );
  });

  it('prefers archive sources over downloads when both share the same folder name', () => {
    const root = mkdtempSync(join(tmpdir(), 'coverage-source-discover-'));
    const archiveRoot = join(root, 'archive');
    const downloadsRoot = join(root, 'downloads');

    seedCoverageExport(archiveRoot, 'killer-skills.com-Coverage-Drilldown-2026-04-03', {
      metadata: 'metadata.csv',
      chart: 'chart.csv',
      table: 'table.csv',
    });
    seedCoverageExport(downloadsRoot, 'killer-skills.com-Coverage-Drilldown-2026-04-03');
    seedCoverageExport(downloadsRoot, 'killer-skills.com-Coverage-Drilldown-2026-03-28');

    const sources = discoverCoverageDrilldownSourceDirectories({
      archiveDir: archiveRoot,
      downloadsDir: downloadsRoot,
    });

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      folderName: 'killer-skills.com-Coverage-Drilldown-2026-04-03',
      origin: 'archive',
      directoryPath: join(archiveRoot, 'killer-skills.com-Coverage-Drilldown-2026-04-03'),
    });
    expect(sources[1]).toMatchObject({
      folderName: 'killer-skills.com-Coverage-Drilldown-2026-03-28',
      origin: 'downloads',
    });
  });
});
