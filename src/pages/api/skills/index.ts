import type { APIRoute } from 'astro';
import { type Env } from '../../../lib/kv';
import { getAllSkills, getLocalizedDescription, type UnifiedSkill } from '../../../lib/skills';
import { jsonResponse, errorResponse } from '../../../lib/api-utils';
import { sanitizePublicSkill, withPublicApiHeaders } from '../../../lib/public-skill-api';

export const prerender = false;

/**
 * GET /api/skills
 *
 * List all skills with pagination.
 *
 * Query parameters:
 *   page     - Page number, 1-based (default: 1)
 *   limit    - Results per page (default: 50)
 *   locale   - Locale for description localization (default: "en")
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));
  const locale = url.searchParams.get('locale') || 'en';

  try {
    const env = locals.runtime?.env as Env | undefined;

    // 1. Load all skills from KV
    const skillsBase = env ? await getAllSkills(env) : [];
    let skills: UnifiedSkill[] = skillsBase;

    // 2. Localize descriptions
    skills = skills.map((skill) => ({
      ...skill,
      description: getLocalizedDescription(skill.description, locale),
    }));

    // 3. Sort by stars (default)
    skills.sort((a, b) => (b.stars || 0) - (a.stars || 0));

    // 4. Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedSkills = skills.slice(start, end);

    return jsonResponse(
      {
        skills: paginatedSkills.map((skill) => sanitizePublicSkill(skill)),
        total: skills.length,
        page,
        limit,
        hasMore: end < skills.length,
      },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }),
    );
  } catch (error) {
    console.error('Skills List API error:', error);
    return errorResponse(error);
  }
};
