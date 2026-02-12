import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../../lib/kv';
import type { UnifiedSkill } from '../../../lib/skills';

export const prerender = false;

/**
 * GET /api/stats/growth
 *
 * Returns growth statistics: total skills, categories, sources breakdown,
 * and recent additions.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    let skills: UnifiedSkill[] = [];
    if (env) {
      const raw = await getSkillsFromKV(env);
      skills = raw as UnifiedSkill[];
    }

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
    const recentSkills = skills.filter(
      (s) => new Date(s.updatedAt).getTime() > thirtyDaysAgo
    ).length;

    return new Response(
      JSON.stringify({
        totalSkills,
        totalCategories: categories.size,
        totalStars,
        sources,
        recentSkills,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Growth stats API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch growth stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
