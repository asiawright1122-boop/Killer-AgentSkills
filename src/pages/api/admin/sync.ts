import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';

export const prerender = false;

/**
 * POST /api/admin/sync
 *
 * Triggers a cache sync operation. Reads the latest skills-cache.json
 * from the GitHub Actions workflow output and updates KV.
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    if (!env?.SKILLS_CACHE) {
      return new Response(
        JSON.stringify({ error: 'KV not available' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Trigger sync by fetching latest skills data from GitHub
    const syncUrl =
      'https://raw.githubusercontent.com/asiawright1122-boop/Killer-AgentSkills/main/data/skills-cache.json';

    try {
      const response = await fetch(syncUrl);
      if (response.ok) {
        const data = await response.text();
        await env.SKILLS_CACHE.put('all-skills', data, {
          expirationTtl: 31536000,
        });

        const parsed = JSON.parse(data);
        const count = Array.isArray(parsed) ? parsed.length : 0;

        return new Response(
          JSON.stringify({
            success: true,
            message: `Synced ${count} skills to KV`,
            syncedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to fetch skills data from source',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error('Sync fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Sync fetch failed' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Admin sync API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync operation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
