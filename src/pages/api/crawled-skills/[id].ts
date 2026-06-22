import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';
import { sanitizePublicSkillLikeRecord, withPublicApiHeaders } from '../../../lib/public-skill-api';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

/**
 * GET /api/crawled-skills/[id]
 *
 * Returns details for a specific crawled skill by ID.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing skill ID parameter' }), {
      status: 400,
      headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  try {
    const env = await getRuntimeEnv<Env>(locals);

    // Try direct key lookup first
    if (env?.SKILLS_CACHE) {
      try {
        const direct = await env.SKILLS_CACHE.get(`crawled:${id}`, 'json');
        if (direct) {
          return new Response(JSON.stringify(sanitizePublicSkillLikeRecord(direct)), {
            status: 200,
            headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
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
            return new Response(JSON.stringify(sanitizePublicSkillLikeRecord(skill)), {
              status: 200,
              headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
            });
          }
        }
      } catch (e) {
        console.error('[Crawled Skill Detail] KV read error:', e);
      }
    }

    return new Response(JSON.stringify({ error: `Crawled skill not found: ${id}` }), {
      status: 404,
      headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error('Crawled skill detail API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch crawled skill' }), {
      status: 500,
      headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
    });
  }
};
