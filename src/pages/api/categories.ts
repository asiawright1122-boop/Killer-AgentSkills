import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../lib/kv';
import type { UnifiedSkill } from '../../lib/skills';

export const prerender = false;

/**
 * GET /api/categories
 *
 * Returns all skill categories with counts and descriptions.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    let skills: UnifiedSkill[] = [];
    if (env) {
      const raw = await getSkillsFromKV(env);
      skills = raw as UnifiedSkill[];
    }

    // Group skills by category
    const categoryMap = new Map<string, number>();
    for (const skill of skills) {
      const cat = skill.category || 'other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }

    // Build response
    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return new Response(
      JSON.stringify({ categories, total: categories.length }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Categories API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch categories' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
