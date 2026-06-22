import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';
import { normalizeCategoryId } from '../../../lib/category-taxonomy';
import { sanitizePublicAIOutputValue } from '../../../lib/public-ai-output';
import { CATEGORY_GROUPS } from '../../../lib/search';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

function inferCategoryFromText(skill: any): string {
  const topics = Array.isArray(skill?.topics) ? skill.topics.map((topic: unknown) => String(topic).toLowerCase()) : [];
  const topicsSet = new Set(topics);
  const textToSearch =
    `${skill?.name || ''} ${JSON.stringify(skill?.description || {})} ${topics.join(' ')}`.toLowerCase();

  let bestCategory = '';
  let bestScore = 0;

  for (const [groupName, keywords] of Object.entries(CATEGORY_GROUPS)) {
    let score = 0;
    for (const keyword of keywords) {
      const k = keyword.toLowerCase();
      if (!k) continue;
      if (topicsSet.has(k)) score += 10;
      if (
        String(skill?.name || '')
          .toLowerCase()
          .includes(k)
      )
        score += 5;
      if (textToSearch.includes(k)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = groupName;
    }
  }

  return bestScore > 0 ? bestCategory : '';
}

/**
 * POST /api/admin/sync
 *
 * Triggers a cache sync operation. Fetches the latest skills-cache.json
 * from GitHub and upserts every skill directly into Cloudflare D1.
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const env = await getRuntimeEnv<Env>(locals);

    if (!env?.DB) {
      return new Response(JSON.stringify({ error: 'D1 database not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch latest skills data from GitHub main branch
    const syncUrl =
      'https://raw.githubusercontent.com/asiawright1122-boop/Killer-AgentSkills/main/data/skills-cache.json';

    const response = await fetch(syncUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to fetch skills data from source' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = (await response.json()) as { skills?: any[] };
    const skills = Array.isArray(raw) ? raw : raw.skills || [];

    // Batch upsert into D1
    const stmt = env.DB.prepare(`
      INSERT OR REPLACE INTO skills 
      (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batches = [];
    for (const rawSkill of skills) {
      const skill = sanitizePublicAIOutputValue(rawSkill) as any;
      const normalizedExplicitCategory = normalizeCategoryId(skill.category);
      const shouldInfer = !normalizedExplicitCategory || normalizedExplicitCategory === 'community';
      const inferredCategory = shouldInfer ? inferCategoryFromText(skill) : '';
      const assignedCategory = normalizedExplicitCategory || inferredCategory || 'community';

      batches.push(
        stmt.bind(
          skill.id || `${skill.owner}/${skill.repo}`,
          assignedCategory,
          skill.owner || '',
          skill.repo || '',
          skill.repoPath || '',
          skill.name || '',
          skill.stars || 0,
          skill.forks || 0,
          skill.qualityScore || 0,
          skill.updatedAt || new Date().toISOString(),
          skill.lastSynced || new Date().toISOString(),
          skill.contentHash || '',
          JSON.stringify(skill),
        ),
      );
    }

    // D1 batch supports up to 100 statements per batch call
    const BATCH_SIZE = 100;
    let totalWritten = 0;
    for (let i = 0; i < batches.length; i += BATCH_SIZE) {
      const chunk = batches.slice(i, i + BATCH_SIZE);
      await env.DB.batch(chunk);
      totalWritten += chunk.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalWritten} skills to D1 Serverless SQL`,
        syncedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Admin sync API error:', error);
    return new Response(JSON.stringify({ error: 'Sync operation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
