import type { APIRoute } from 'astro';
import { type Env } from '../../lib/kv';
import { getLightweightSkillsCategorySummary } from '../../lib/public-skill-catalog';
import { errorResponse, jsonResponse } from '../../lib/api-utils';
import { sanitizePublicAIOutput } from '../../lib/public-ai-output';
import { withPublicApiHeaders } from '../../lib/public-skill-api';
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
      name: sanitizePublicAIOutput(item.category) || 'other',
      count: item.count,
    }));

    return jsonResponse(
      { categories, total: categories.length },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }),
    );
  } catch (error) {
    console.error('Categories API error:', error);
    return errorResponse(error);
  }
};
