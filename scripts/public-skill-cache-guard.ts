#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findHiddenReasoningPublicOutputMatches, sanitizePublicAIOutputValue } from '../src/lib/public-ai-output';

type SkillCacheLike = {
  id?: unknown;
  owner?: unknown;
  repo?: unknown;
  name?: unknown;
};

type CacheDataLike = {
  skills?: unknown;
};

export type PublicSkillCacheGuardIssue = {
  file: string;
  index: number;
  id: string;
  ownerRepo: string;
  matches: string[];
};

const DEFAULT_CACHE_PATH = 'data/skills-cache.json';

function formatSkillId(skill: SkillCacheLike, index: number): string {
  if (typeof skill.id === 'string' && skill.id.trim()) return skill.id;
  if (typeof skill.name === 'string' && skill.name.trim()) return skill.name;
  return `skill[${index}]`;
}

function formatOwnerRepo(skill: SkillCacheLike): string {
  const owner = typeof skill.owner === 'string' ? skill.owner : '';
  const repo = typeof skill.repo === 'string' ? skill.repo : '';
  return owner || repo ? `${owner}/${repo}` : 'unknown/unknown';
}

export function findPublicSkillCacheGuardIssuesInData(data: CacheDataLike, file: string): PublicSkillCacheGuardIssue[] {
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const issues: PublicSkillCacheGuardIssue[] = [];

  skills.forEach((rawSkill, index) => {
    const skill = rawSkill && typeof rawSkill === 'object' ? (rawSkill as SkillCacheLike) : {};
    const publicPayload = sanitizePublicAIOutputValue(rawSkill);
    const matches = findHiddenReasoningPublicOutputMatches(JSON.stringify(publicPayload));

    if (matches.length > 0) {
      issues.push({
        file,
        index,
        id: formatSkillId(skill, index),
        ownerRepo: formatOwnerRepo(skill),
        matches,
      });
    }
  });

  return issues;
}

export function scanPublicSkillCacheFile(cachePath = DEFAULT_CACHE_PATH, cwd = process.cwd()) {
  const absolutePath = resolve(cwd, cachePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`cache file not found: ${cachePath}`);
  }

  const data = JSON.parse(readFileSync(absolutePath, 'utf8')) as CacheDataLike;
  const file = relative(cwd, absolutePath);
  return {
    file,
    issues: findPublicSkillCacheGuardIssuesInData(data, file),
  };
}

function printReport(file: string, issues: PublicSkillCacheGuardIssue[]) {
  const lines: string[] = [];
  lines.push('# Public Skill Cache Guard');
  lines.push('');
  lines.push(`- Cache file: ${file}`);
  lines.push(`- Issues found: ${issues.length}`);

  if (issues.length === 0) {
    lines.push('- Status: pass');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('- Status: fail');
  lines.push('');
  lines.push('## Issues');

  for (const issue of issues) {
    lines.push(
      `- ${issue.file}#${issue.index} ${issue.id} (${issue.ownerRepo}): ${issue.matches
        .map((match) => JSON.stringify(match))
        .join(', ')}`,
    );
  }

  console.error(lines.join('\n'));
}

export function main(argv = process.argv.slice(2)) {
  const cachePath = argv.find((arg) => !arg.startsWith('-')) || DEFAULT_CACHE_PATH;
  const result = scanPublicSkillCacheFile(cachePath);

  printReport(result.file, result.issues);
  if (result.issues.length > 0) process.exit(1);
}

const isDirectRun = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  main();
}
