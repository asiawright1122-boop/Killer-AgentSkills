import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';
import { CATEGORY_GROUPS } from '../../../lib/search';

export const prerender = false;

/**
 * POST /api/admin/sync
 *
 * Triggers a cache sync operation. Fetches the latest skills-cache.json
 * from GitHub and upserts every skill directly into Cloudflare D1.
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    if (!env?.DB) {
      return new Response(
        JSON.stringify({ error: 'D1 database not available' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch latest skills data from GitHub main branch
    const syncUrl =
      'https://raw.githubusercontent.com/asiawright1122-boop/Killer-AgentSkills/main/data/skills-cache.json';

    const response = await fetch(syncUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch skills data from source' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const raw = await response.json() as { skills?: any[] };
    const skills = Array.isArray(raw) ? raw : (raw.skills || []);

    // Batch upsert into D1
    const stmt = env.DB.prepare(`
      INSERT OR REPLACE INTO skills 
      (id, category, owner, repo, repo_path, name, stars, forks, quality_score, updated_at, last_synced, content_hash, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batches = [];
    for (const skill of skills) {
      // ⚡ Smart Categorization: Infer category from text if missing or 'community'
      let assignedCategory = skill.category;
      if (!assignedCategory || assignedCategory.toLowerCase() === 'community') {
        const textToSearch = (
          skill.name + " " +
          JSON.stringify(skill.description || {}) + " " +
          (skill.topics || []).join(" ")
        ).toLowerCase();

        for (const [groupName, keywords] of Object.entries(CATEGORY_GROUPS)) {
          if (keywords.some(k => textToSearch.includes(k.toLowerCase()))) {
            assignedCategory = groupName;
            break;
          }
        }
      }

      batches.push(
        stmt.bind(
          skill.id || `${skill.owner}/${skill.repo}`,
          assignedCategory || 'community',
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
          JSON.stringify(skill)
        )
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
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin sync API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync operation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
