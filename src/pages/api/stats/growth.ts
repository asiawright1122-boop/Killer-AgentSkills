import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/api-utils';
import { type Env } from '../../../lib/kv';
import { withPublicApiHeaders } from '../../../lib/public-skill-api';
import { getAllSkills, type UnifiedSkill } from '../../../lib/public-skill-catalog';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

/**
 * GET /api/stats/growth
 *
 * Returns growth statistics: total skills, categories, sources breakdown,
 * and recent additions.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = await getRuntimeEnv<Env>(locals);

    const skills: UnifiedSkill[] = env ? await getAllSkills(env) : [];

    const totalSkills = skills.length;
    const categories = new Set(skills.map((s) => s.category).filter(Boolean));
    const totalStars = skills.reduce((sum, s) => sum + (s.stars || 0), 0);

    // Source breakdown
    const sources = { verified: 0, featured: 0, cache: 0 };
    for (const skill of skills) {
      if (skill.source in sources) {
        sources[skill.source as keyof typeof sources]++;
      }
    }

    // Recent additions (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentSkills = skills.filter((s) => new Date(s.updatedAt).getTime() > thirtyDaysAgo).length;

    return jsonResponse(
      {
        totalSkills,
        totalCategories: categories.size,
        totalStars,
        sources,
        recentSkills,
      },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }),
    );
  } catch (error) {
    console.error('Growth stats API error:', error);
    return jsonResponse({ error: 'Failed to fetch growth stats' }, 500, withPublicApiHeaders());
  }
};
