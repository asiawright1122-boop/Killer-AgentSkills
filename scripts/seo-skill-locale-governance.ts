#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CacheData, SkillCache } from './lib/types';
import {
  buildSkillLocaleGovernanceIndex,
  renderSkillLocaleGovernanceReport,
} from './lib/skill-locale-governance';

function readSkillsCache(path: string): SkillCache[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CacheData | SkillCache[];
  return Array.isArray(raw) ? raw : raw.skills || [];
}

const workspaceRoot = process.cwd();
const dataDir = resolve(workspaceRoot, 'data');
const reportDir = resolve(workspaceRoot, 'reports/seo');
const cachePath = resolve(dataDir, 'skills-cache.json');
const dataOutputPath = resolve(dataDir, 'seo-skill-locale-governance.json');
const reportJsonPath = resolve(reportDir, 'latest-skill-locale-governance.json');
const reportMarkdownPath = resolve(reportDir, 'latest-skill-locale-governance.md');

const skills = readSkillsCache(cachePath);
const index = buildSkillLocaleGovernanceIndex(skills);
const markdown = renderSkillLocaleGovernanceReport(index);

mkdirSync(dataDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

writeFileSync(dataOutputPath, JSON.stringify(index, null, 2), 'utf8');
writeFileSync(reportJsonPath, JSON.stringify(index, null, 2), 'utf8');
writeFileSync(reportMarkdownPath, markdown, 'utf8');

console.log(
  [
    `skill locale governance generated`,
    `skills=${index.summary.totalSkills}`,
    `eligibleVariants=${index.summary.eligibleVariants}`,
    `suppressedMetadataVariants=${index.summary.suppressedMetadataVariants}`,
    `data=${dataOutputPath}`,
    `report=${reportMarkdownPath}`,
  ].join(' | '),
);
