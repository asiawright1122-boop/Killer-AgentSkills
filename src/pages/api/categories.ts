import type { APIRoute } from 'astro';
import { type Env } from '../../lib/kv';
import { getLightweightSkillsCategorySummary } from '../../lib/skills';
import { errorResponse } from '../../lib/api-utils';
import { getRuntimeEnv } from '../../lib/runtime-env';

export const prerender = false;

/**
 * GET /api/categories
 *
 * Returns all skill categories with counts and descriptions.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = await getRuntimeEnv<Env>(locals);
    const summary = env ? await getLightweightSkillsCategorySummary(env) : { total: 0, categories: [] };
    const categories = summary.categories.map((item) => ({
      name: item.category || 'other',
      count: item.count,
    }));

    return new Response(JSON.stringify({ categories, total: categories.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return errorResponse(error);
  }
};
