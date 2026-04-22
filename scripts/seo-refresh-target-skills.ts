#!/usr/bin/env npx tsx

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateQualityScore } from '../src/lib/shared/validation';
import { fetchRepoInfo, fetchSkillMd, parseSkillMd } from './lib/github';
import { resolveSkillScoringPath } from './lib/skill-source';
import {
  buildTargetSkillFilePathCandidates,
  pickPrimaryText,
  resolveExpandedSkillFilePath,
} from './lib/target-skill-refresh';
import type { CacheData, SkillCache } from './lib/types';

type RefreshRow = {
  id: string;
  status: 'updated' | 'failed' | 'skipped';
  reason?: string;
  filePathTried?: string[];
  resolvedFilePath?: string | null;
  qualityScore?: {
    before: number;
    after: number;
  };
  bodyBytes?: {
    before: number;
    after: number;
  };
};

type RefreshReport = {
  generatedAt: string;
  ids: string[];
  summary: {
    requested: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  rows: RefreshRow[];
};

type ExpandedGithubSkill = {
  owner?: string;
  repo?: string;
  filePath?: string | null;
};

function parseIds(args: string[]): string[] {
  const idsArg = args.find((arg) => arg.startsWith('--ids='));
  if (!idsArg) return [];
  return idsArg
    .slice('--ids='.length)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJson<T>(targetPath: string): T {
  return JSON.parse(readFileSync(targetPath, 'utf8')) as T;
}

function writeJson(targetPath: string, data: unknown) {
  writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8');
}

function readSkillsCache(targetPath: string): CacheData {
  return readJson<CacheData>(targetPath);
}

function readExpandedSkills(targetPath: string): ExpandedGithubSkill[] {
  if (!existsSync(targetPath)) return [];
  const raw = readJson<ExpandedGithubSkill[] | { items?: ExpandedGithubSkill[] }>(targetPath);
  return Array.isArray(raw) ? raw : raw.items || [];
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function getSkillContent(skill: SkillCache): string {
  return skill.skillMd?.body || skill.skillMd?.bodyPreview || '';
}

async function resolveLiveFilePath(skill: SkillCache, expandedSkills: ExpandedGithubSkill[]) {
  const backupPath = resolveExpandedSkillFilePath(expandedSkills, skill.owner, skill.repo, skill.id);
  const candidates = [
    ...(backupPath ? [backupPath] : []),
    ...buildTargetSkillFilePathCandidates(skill).filter((candidate) => candidate !== backupPath),
  ];

  for (const filePath of candidates) {
    const content = await fetchSkillMd(skill.owner, skill.repo, filePath);
    if (content) {
      return {
        filePath: filePath || null,
        content,
        tried: candidates,
      };
    }
  }

  return {
    filePath: backupPath || null,
    content: null,
    tried: candidates,
  };
}

function buildUpdatedSkill(existing: SkillCache, options: {
  filePath: string | null;
  content: string;
  repoInfo: Awaited<ReturnType<typeof fetchRepoInfo>>;
}): SkillCache {
  const parsed = parseSkillMd(options.content);
  const parsedBody = parsed?.body || parsed?.bodyPreview || '';
  const parsedName = String(parsed?.name || '').trim();
  const parsedDescription = String(parsed?.description || '').trim();
  const retainedDescription = pickPrimaryText(existing.description);
  const scoringDescription = retainedDescription || parsedDescription;
  const resolvedName = parsedName || existing.name || existing.id.split('/').pop() || existing.repo;
  const repoInfo = options.repoInfo?.data;

  const updatedSkillMd: SkillCache['skillMd'] = {
    name: resolvedName,
    description: parsedDescription || scoringDescription,
    version: parsed?.version,
    tags: parsed?.tags,
    bodyPreview: parsed?.bodyPreview || options.content.slice(0, 3000).trim(),
    ...(parsed?.body ? { body: parsed.body } : {}),
  };

  const updated: SkillCache = {
    ...existing,
    name: resolvedName,
    filePath: options.filePath || existing.filePath,
    stars: typeof repoInfo?.stargazers_count === 'number' ? repoInfo.stargazers_count : existing.stars,
    forks: typeof repoInfo?.forks_count === 'number' ? repoInfo.forks_count : existing.forks,
    updatedAt: typeof repoInfo?.updated_at === 'string' ? repoInfo.updated_at : existing.updatedAt,
    topics: Array.isArray(repoInfo?.topics) ? repoInfo.topics : existing.topics,
    skillMd: updatedSkillMd,
    contentHash: sha256(options.content),
    repoEtag: options.repoInfo?.etag || existing.repoEtag,
    lastSynced: new Date().toISOString(),
  };

  updated.qualityScore = calculateQualityScore({
    name: updatedSkillMd.name || updated.name,
    owner: updated.owner,
    repo: updated.repo,
    body: parsedBody,
    repoPath: resolveSkillScoringPath(updated.filePath, updated.repoPath),
    description: scoringDescription,
    stars: updated.stars,
    updatedAt: updated.updatedAt,
    version: updatedSkillMd.version,
    tags: updatedSkillMd.tags,
  });

  return updated;
}

function renderMarkdown(report: RefreshReport): string {
  const lines = report.rows.map((row) => {
    if (row.status !== 'updated') {
      return `- ${row.id} | ${row.status} | ${row.reason || 'unknown'}`;
    }

    return `- ${row.id} | ${row.status} | quality ${row.qualityScore?.before ?? 0} -> ${row.qualityScore?.after ?? 0} | body ${row.bodyBytes?.before ?? 0} -> ${row.bodyBytes?.after ?? 0} | filePath=${row.resolvedFilePath || 'none'}`;
  });

  return [
    '# Target Skill Source Refresh',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- requested: ${report.summary.requested}`,
    `- updated: ${report.summary.updated}`,
    `- failed: ${report.summary.failed}`,
    `- skipped: ${report.summary.skipped}`,
    '',
    '## Rows',
    ...(lines.length > 0 ? lines : ['- none']),
    '',
  ].join('\n');
}

async function main() {
  const ids = parseIds(process.argv.slice(2));
  if (ids.length === 0) {
    throw new Error('Missing --ids=owner/repo/skill,...');
  }

  const workspaceRoot = process.cwd();
  const dataDir = resolve(workspaceRoot, 'data');
  const reportDir = resolve(workspaceRoot, 'reports/seo');
  const cachePath = resolve(dataDir, 'skills-cache.json');
  const expandedPath = resolve(dataDir, 'expanded-github-skills.json');
  const reportJsonPath = resolve(reportDir, 'latest-target-skill-refresh.json');
  const reportMarkdownPath = resolve(reportDir, 'latest-target-skill-refresh.md');

  const cache = readSkillsCache(cachePath);
  const expandedSkills = readExpandedSkills(expandedPath);
  const rows: RefreshRow[] = [];
  const skillIndex = new Map(cache.skills.map((skill, index) => [skill.id, index]));

  for (const id of ids) {
    const index = skillIndex.get(id);
    if (typeof index !== 'number') {
      rows.push({
        id,
        status: 'failed',
        reason: 'skill_not_found_in_cache',
      });
      continue;
    }

    const existing = cache.skills[index];
    try {
      const liveSource = await resolveLiveFilePath(existing, expandedSkills);
      if (!liveSource.content) {
        rows.push({
          id,
          status: 'failed',
          reason: 'source_not_found',
          filePathTried: liveSource.tried,
          resolvedFilePath: liveSource.filePath,
        });
        continue;
      }

      const repoInfo = await fetchRepoInfo(existing.owner, existing.repo, existing.repoEtag);
      const updated = buildUpdatedSkill(existing, {
        filePath: liveSource.filePath,
        content: liveSource.content,
        repoInfo,
      });

      cache.skills[index] = updated;
      rows.push({
        id,
        status: 'updated',
        filePathTried: liveSource.tried,
        resolvedFilePath: updated.filePath || null,
        qualityScore: {
          before: Number(existing.qualityScore || 0),
          after: Number(updated.qualityScore || 0),
        },
        bodyBytes: {
          before: Buffer.byteLength(getSkillContent(existing), 'utf8'),
          after: Buffer.byteLength(getSkillContent(updated), 'utf8'),
        },
      });
    } catch (error) {
      rows.push({
        id,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  cache.lastUpdated = new Date().toISOString();
  cache.totalCount = cache.skills.length;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  writeJson(cachePath, cache);

  const report: RefreshReport = {
    generatedAt: new Date().toISOString(),
    ids,
    summary: {
      requested: ids.length,
      updated: rows.filter((row) => row.status === 'updated').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      skipped: rows.filter((row) => row.status === 'skipped').length,
    },
    rows,
  };

  writeJson(reportJsonPath, report);
  writeFileSync(reportMarkdownPath, renderMarkdown(report), 'utf8');

  console.log(
    [
      'target skill refresh complete',
      `requested=${report.summary.requested}`,
      `updated=${report.summary.updated}`,
      `failed=${report.summary.failed}`,
      `json=${reportJsonPath}`,
      `md=${reportMarkdownPath}`,
    ].join(' | '),
  );
}

main().catch((error) => {
  console.error('target skill refresh failed', error);
  process.exit(1);
});
