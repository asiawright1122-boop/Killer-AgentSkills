/**
 * Local skills fallback - loads skills from local JSON files.
 *
 * This module is intentionally separate from kv.ts to prevent the bundler
 * from inlining the large skills-cache.json (≈2.9 MiB) into the Worker bundle.
 * All file I/O happens at runtime via dynamic imports.
 */

import { SkillListingItem } from './kv';
import type { TrackedSkillRow } from './skills';

function parseInstalledSkillFrontmatter(raw: string): { name: string; description: string; body: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2]?.trim() || '';
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim();
  const description = descriptionMatch?.[1]?.trim();

  if (!name) return null;

  return {
    name,
    description: description || `${name} AI agent skill.`,
    body: body || `# ${name}`,
  };
}

function normalizeTrackedSkillFallback(row: TrackedSkillRow): SkillListingItem | null {
  const owner = typeof row.owner === 'string' ? row.owner.trim() : '';
  const repo = typeof row.repo === 'string' ? row.repo.trim() : '';
  const routePath = typeof row.routePath === 'string' ? row.routePath.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  const category = typeof row.category === 'string' ? row.category.trim() : '';
  const topics = Array.isArray(row.topics) ? row.topics : [];
  const stars = typeof row.stars === 'number' ? row.stars : 0;
  const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt.trim() : '';
  const source = typeof row.source === 'string' ? row.source : 'cache';

  if (!owner || !repo || !routePath || !name || !description || !updatedAt) {
    return null;
  }

  return {
    id: `${owner}/${repo}/${routePath}`,
    name,
    skillName: name,
    owner,
    repo,
    repoPath: `${owner}/${repo}`,
    description: { en: description },
    category,
    topics,
    stars,
    source,
    updatedAt,
    lastSynced: updatedAt,
  };
}

async function getInstalledSkillsFallback(): Promise<any[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const baseDirs = [
    path.resolve(process.cwd(), 'packages/cli/.opencode/skills'),
    path.resolve(process.cwd(), 'packages/cli/.cline/skills'),
  ];

  const collected = new Map<string, any>();

  for (const baseDir of baseDirs) {
    if (!fs.existsSync(baseDir)) continue;

    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(baseDir, entry.name);
      const metaPath = path.join(skillDir, '.killer-meta.json');
      const skillPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(metaPath) || !fs.existsSync(skillPath)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const repoUrl = typeof meta.repoUrl === 'string' ? meta.repoUrl.trim() : '';
        const subpath = typeof meta.subpath === 'string' ? meta.subpath.trim() : '';
        const installedAt = typeof meta.installedAt === 'string' ? meta.installedAt : '';
        const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
        const skillMatch = subpath.match(/^skills\/([^/]+)$/);
        if (!repoMatch || !skillMatch) continue;

        const owner = repoMatch[1];
        const repo = repoMatch[2];
        const skillSlug = skillMatch[1];
        const rawSkill = fs.readFileSync(skillPath, 'utf-8');
        const parsed = parseInstalledSkillFrontmatter(rawSkill);
        if (!parsed) continue;

        const id = `${owner}/${repo}/${skillSlug}`;
        if (collected.has(id)) continue;

        collected.set(id, {
          id,
          name: parsed.name,
          skillName: parsed.name,
          description: { en: parsed.description },
          owner,
          repo,
          repoPath: `${owner}/${repo}`,
          stars: 0,
          forks: 0,
          updatedAt: installedAt,
          lastSynced: installedAt,
          topics: ['agent-skills'],
          category: 'official',
          qualityScore: 0,
          filePath: path.relative(process.cwd(), skillPath),
          skillMd: {
            name: parsed.name,
            description: parsed.description,
            bodyPreview: parsed.body,
            body: parsed.body,
          },
        });
      } catch {
        // ignore malformed installed skill metadata
      }
    }
  }

  return Array.from(collected.values());
}

let _localSkillsCache: SkillListingItem[] | null = null;
let _localSkillsCacheTime = 0;

export async function getLocalSkillsFallback(): Promise<SkillListingItem[]> {
  if (_localSkillsCache && Date.now() - _localSkillsCacheTime < 30000) {
    return _localSkillsCache || [];
  }

  try {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
    if (fs.existsSync(mainCachePath)) {
      const content = fs.readFileSync(mainCachePath, 'utf-8');
      const data = JSON.parse(content);
      _localSkillsCache = Array.isArray(data) ? data : data.skills || [];
      _localSkillsCacheTime = Date.now();
      return _localSkillsCache || [];
    }

    const installedSkills = await getInstalledSkillsFallback();
    if (installedSkills.length > 0) {
      _localSkillsCache = installedSkills;
      _localSkillsCacheTime = Date.now();
      return _localSkillsCache || [];
    }

    const trackedFallbackPath = path.resolve(process.cwd(), 'data/expanded-github-skills.json');
    if (fs.existsSync(trackedFallbackPath)) {
      const content = fs.readFileSync(trackedFallbackPath, 'utf-8');
      const data = JSON.parse(content);
      const normalized = (Array.isArray(data) ? data : [])
        .map((row) => normalizeTrackedSkillFallback(row as TrackedSkillRow))
        .filter((row): row is SkillListingItem => row !== null);
      _localSkillsCache = normalized;
      _localSkillsCacheTime = Date.now();
      return _localSkillsCache || [];
    }
  } catch {
    // ignore
  }

  return [];
}
