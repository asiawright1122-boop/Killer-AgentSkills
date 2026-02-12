import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';

export const prerender = false;

/**
 * GET /api/crawled-skills/[id]
 *
 * Returns details for a specific crawled skill by ID.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Missing skill ID parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    // Try direct key lookup first
    if (env?.SKILLS_CACHE) {
      try {
        const direct = await env.SKILLS_CACHE.get(`crawled:${id}`, 'json');
        if (direct) {
          return new Response(JSON.stringify(direct), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // Fall through to list scan
      }

      // Fallback: scan crawled-skills list
      try {
        const data = await env.SKILLS_CACHE.get('crawled-skills', 'json');
        if (Array.isArray(data)) {
          const skill = data.find((s: any) => s.id === id || `${s.owner}/${s.repo}` === id);
          if (skill) {
            return new Response(JSON.stringify(skill), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.error('[Crawled Skill Detail] KV read error:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: `Crawled skill not found: ${id}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Crawled skill detail API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch crawled skill' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
