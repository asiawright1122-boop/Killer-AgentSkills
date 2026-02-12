import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';

export const prerender = false;

/**
 * GET /api/crawled-skills
 *
 * Returns the list of crawled skills from KV (SKILLS_CACHE namespace).
 * These are skills discovered by the GitHub Actions crawler workflow.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));

    let crawledSkills: any[] = [];
    if (env?.SKILLS_CACHE) {
      try {
        const data = await env.SKILLS_CACHE.get('crawled-skills', 'json');
        if (Array.isArray(data)) crawledSkills = data;
      } catch (e) {
        console.error('[Crawled Skills API] KV read error:', e);
      }
    }

    const start = (page - 1) * limit;
    const paginated = crawledSkills.slice(start, start + limit);

    return new Response(
      JSON.stringify({
        skills: paginated,
        total: crawledSkills.length,
        page,
        hasMore: start + limit < crawledSkills.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Crawled skills API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch crawled skills' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
