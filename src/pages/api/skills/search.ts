import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../../lib/kv';
import { searchSkills, filterByCategory } from '../../../lib/search';
import { getLocalizedDescription, type UnifiedSkill } from '../../../lib/skills';

export const prerender = false;

/**
 * GET /api/skills/search
 *
 * Search skills using keyword query with relevance scoring.
 *
 * Query parameters:
 *   q        - Search query string (optional, returns all if empty)
 *   page     - Page number, 1-based (default: 1)
 *   limit    - Results per page (default: 20)
 *   category - Filter by category (optional)
 *   locale   - Locale for description localization (default: "en")
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
  const category = url.searchParams.get('category');
  const locale = url.searchParams.get('locale') || 'en';

  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    // 1. Load all skills from KV
    let skills: UnifiedSkill[] = [];
    if (env) {
      const raw = await getSkillsFromKV(env);
      skills = raw as UnifiedSkill[];
    }

    // 2. Localize descriptions
    skills = skills.map((skill) => ({
      ...skill,
      description: getLocalizedDescription(skill.description, locale),
    }));

    // 3. Apply category filter
    if (category) {
      skills = filterByCategory(skills, category);
    }

    // 4. Apply search query with relevance scoring
    if (query.trim()) {
      skills = searchSkills(skills, query, locale);
    } else {
      // No query: sort by source quality then stars
      const sourceOrder: Record<string, number> = { verified: 3, featured: 2, cache: 1 };
      skills.sort((a, b) => {
        const sourceCompare = (sourceOrder[b.source] || 0) - (sourceOrder[a.source] || 0);
        if (sourceCompare !== 0) return sourceCompare;
        return (b.stars || 0) - (a.stars || 0);
      });
    }

    // 5. Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedSkills = skills.slice(start, end);

    return new Response(
      JSON.stringify({
        skills: paginatedSkills,
        total: skills.length,
        page,
        hasMore: end < skills.length,
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
    console.error('Search API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to search skills' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
