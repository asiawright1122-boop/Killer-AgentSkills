#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../src/i18n';
import { getLocalizedSeoEligibleLocales, getPreferredCanonicalLocale } from '../src/lib/seo-locales';

type SitemapSkill = {
  owner?: string;
  repo?: string;
};

type SkillCacheEntry = {
  owner?: string;
  repo?: string;
  id?: string;
  name?: string;
  repoPath?: string;
  description?: string | Record<string, string>;
  seo?: {
    definition?: string | Record<string, string>;
    description?: string | Record<string, string>;
  };
  skillMd?: {
    body?: string;
    bodyPreview?: string;
  };
};

type CollectionEntry = {
  title?: Record<string, string>;
  description?: Record<string, string>;
};

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const failOnThin = args.has('--fail-on-thin');
const failOnMissingBody = args.has('--fail-on-missing-body');
const failOnPartialCollections = args.has('--fail-on-partial-collections');
const workspaceRoot = process.cwd();
const dataDir = resolve(workspaceRoot, 'data');
const collectionsDir = resolve(workspaceRoot, 'src/content/collections');
const MIN_INDEXABLE_SKILL_README_BYTES = 250;
const textEncoder = new TextEncoder();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function toOwnerRepoKey(owner?: string, repo?: string): string | null {
  if (!owner || !repo) return null;
  return `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}

function writeDriftArtifacts(onlyInSitemap: string[], onlyInCache: string[]): void {
  const reportDir = resolve(workspaceRoot, 'reports/seo');
  mkdirSync(reportDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      onlyInSitemap: onlyInSitemap.length,
      onlyInIndexableCache: onlyInCache.length,
    },
    onlyInSitemap,
    onlyInIndexableCache: onlyInCache,
  };

  writeFileSync(resolve(reportDir, 'index-drift.json'), JSON.stringify(payload, null, 2), 'utf8');
  writeFileSync(resolve(reportDir, 'index-drift-sitemap-only.txt'), `${onlyInSitemap.join('\n')}\n`, 'utf8');
  writeFileSync(resolve(reportDir, 'index-drift-cache-only.txt'), `${onlyInCache.join('\n')}\n`, 'utf8');
}

function summarizeList(items: string[], limit = 12): string {
  if (items.length === 0) return 'none';
  const uniqueItems = Array.from(new Set(items));
  const preview = uniqueItems.slice(0, limit).join(', ');
  return uniqueItems.length > limit ? `${preview}, ... (+${uniqueItems.length - limit} more)` : preview;
}

function getSkillReadmeContent(skill: SkillCacheEntry): string {
  return skill.skillMd?.body || skill.skillMd?.bodyPreview || '';
}

function toSkillKey(skill: SkillCacheEntry): string {
  if (skill.id) return skill.id;
  if (skill.owner && skill.repo && skill.repoPath) return `${skill.owner}/${skill.repo}#${skill.repoPath}`;
  if (skill.owner && skill.repo) return `${skill.owner}/${skill.repo}`;
  return 'unknown-skill';
}

function pickPreferredText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const preferred = [record.en, record.zh, ...Object.values(record)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return '';
}

function getFallbackDescription(skill: SkillCacheEntry): string {
  return (
    pickPreferredText(skill.description) ||
    pickPreferredText(skill.seo?.definition) ||
    pickPreferredText(skill.seo?.description) ||
    ''
  );
}

function getSkillReadmeBytes(skill: SkillCacheEntry): number {
  const content = getSkillReadmeContent(skill);
  if (!content) return 0;
  return textEncoder.encode(content).length;
}

function getSkillIndexableBytes(skill: SkillCacheEntry): number {
  const readmeContent = getSkillReadmeContent(skill);
  if (readmeContent && textEncoder.encode(readmeContent).length >= MIN_INDEXABLE_SKILL_README_BYTES) {
    return textEncoder.encode(readmeContent).length;
  }

  const fallbackDescription = getFallbackDescription(skill);
  const fallbackContent = [readmeContent, `# ${skill.name || skill.repo || 'Skill'}\n\n${fallbackDescription}`]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n');
  if (!fallbackContent) return 0;
  return textEncoder.encode(fallbackContent).length;
}

function isIndexableSkill(skill: SkillCacheEntry): boolean {
  return getSkillIndexableBytes(skill) >= MIN_INDEXABLE_SKILL_README_BYTES;
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sitemapSkillsPath = join(dataDir, 'sitemap-skills.json');
  const skillsCachePath = join(dataDir, 'skills-cache.json');

  if (existsSync(sitemapSkillsPath) && existsSync(skillsCachePath)) {
    const sitemapSkillsRaw = readJson<SitemapSkill[] | { skills?: SitemapSkill[] }>(sitemapSkillsPath);
    const skillsCacheRaw = readJson<SkillCacheEntry[] | { skills?: SkillCacheEntry[] }>(skillsCachePath);

    const sitemapSkills = Array.isArray(sitemapSkillsRaw) ? sitemapSkillsRaw : sitemapSkillsRaw.skills || [];
    const skillsCache = Array.isArray(skillsCacheRaw) ? skillsCacheRaw : skillsCacheRaw.skills || [];

    const sitemapIds = new Set(
      sitemapSkills
        .map((item) => toOwnerRepoKey(item.owner, item.repo))
        .filter((value): value is string => Boolean(value)),
    );
    const indexableCacheIds = new Set(
      skillsCache
        .filter((item) => isIndexableSkill(item))
        .map((item) => toOwnerRepoKey(item.owner, item.repo))
        .filter((value): value is string => Boolean(value)),
    );

    const onlyInSitemap = Array.from(sitemapIds).filter((id) => !indexableCacheIds.has(id));
    const onlyInCache = Array.from(indexableCacheIds).filter((id) => !sitemapIds.has(id));

    if (onlyInSitemap.length > 0 || onlyInCache.length > 0) {
      writeDriftArtifacts(onlyInSitemap, onlyInCache);
      warnings.push('drift artifacts written: reports/seo/index-drift.json (+ txt lists)');
    }

    if (onlyInSitemap.length > 0 || onlyInCache.length > 0) {
      const message = [
        `skill source drift detected`,
        `only in sitemap: ${onlyInSitemap.length}`,
        `only in indexable cache: ${onlyInCache.length}`,
        `sample sitemap-only: ${summarizeList(onlyInSitemap)}`,
        `sample indexable-cache-only: ${summarizeList(onlyInCache)}`,
      ].join(' | ');

      if (strict) errors.push(message);
      else warnings.push(message);
    }

    const thinSkills = skillsCache.filter((skill) => {
      const contentBytes = getSkillIndexableBytes(skill);
      return contentBytes > 0 && contentBytes < MIN_INDEXABLE_SKILL_README_BYTES;
    });
    const missingBodies = skillsCache.filter((skill) => {
      return getSkillReadmeBytes(skill) === 0;
    });

    if (missingBodies.length > 0) {
      const missingBodyKeys = missingBodies.map(toSkillKey);
      const message = `skills missing body/bodyPreview: ${missingBodies.length} | unique ids: ${
        new Set(missingBodyKeys).size
      } | sample: ${summarizeList(missingBodyKeys)}`;
      if (failOnMissingBody) errors.push(message);
      else warnings.push(message);
    }
    if (thinSkills.length > 0) {
      const thinSkillKeys = thinSkills.map(toSkillKey);
      const message = `skills with indexable content under ${MIN_INDEXABLE_SKILL_README_BYTES} bytes: ${
        thinSkills.length
      } | unique ids: ${new Set(thinSkillKeys).size} | sample: ${summarizeList(thinSkillKeys)}`;
      if (failOnThin) errors.push(message);
      else warnings.push(message);
    }
  } else {
    warnings.push('data snapshots missing; skipped skill source integrity checks');
  }

  if (existsSync(collectionsDir)) {
    const collectionFiles = readdirSync(collectionsDir).filter((file) => file.endsWith('.json'));
    const partialCollections: string[] = [];
    const emptyCollections: string[] = [];

    for (const file of collectionFiles) {
      const entry = readJson<CollectionEntry>(join(collectionsDir, file));
      const eligibleLocales = getLocalizedSeoEligibleLocales(entry, SUPPORTED_LOCALES);
      if (eligibleLocales.length === 0) {
        emptyCollections.push(file);
        continue;
      }

      if (eligibleLocales.length !== SUPPORTED_LOCALES.length) {
        const missingLocales = SUPPORTED_LOCALES.filter((locale) => !eligibleLocales.includes(locale));
        partialCollections.push(
          `${file} -> canonical ${getPreferredCanonicalLocale(eligibleLocales)}; missing ${missingLocales.join(',')}`,
        );
      }
    }

    if (emptyCollections.length > 0) {
      errors.push(`collections with no indexable locale variants: ${summarizeList(emptyCollections)}`);
    }

    if (partialCollections.length > 0) {
      const message = `collections with partial locale coverage: ${partialCollections.length} | ${summarizeList(
        partialCollections,
      )}`;
      if (failOnPartialCollections) errors.push(message);
      else warnings.push(message);
    }
  }

  if (errors.length > 0) {
    console.error('SEO index integrity failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    if (warnings.length > 0) {
      console.error('Warnings:');
      for (const warning of warnings) {
        console.error(`- ${warning}`);
      }
    }
    process.exit(1);
  }

  console.log('SEO index integrity passed');
  if (warnings.length > 0) {
    console.warn('Warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }
}

main();
