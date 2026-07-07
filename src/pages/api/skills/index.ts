import type { APIRoute } from 'astro';
import { type Env } from '../../../lib/kv';
import { getLightweightMarketplaceSkillsPage, getLocalizedDescription } from '../../../lib/public-skill-catalog';
import { jsonResponse, errorResponse } from '../../../lib/api-utils';
import { sanitizePublicSkill, withPublicApiHeaders } from '../../../lib/public-skill-api';
import { getRuntimeEnv } from '../../../lib/runtime-env';

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
    const env = await getRuntimeEnv<Env>(locals);
    const paged = env
      ? await getLightweightMarketplaceSkillsPage(env, page, limit)
      : { skills: [], total: 0, page, pageSize: limit };
    const localizedSkills = paged.skills.map((skill) => ({
      ...skill,
      description: getLocalizedDescription(skill.description, locale),
    }));

    return jsonResponse(
      {
        skills: localizedSkills.map((skill) => sanitizePublicSkill(skill)),
        total: paged.total,
        page: paged.page,
        limit: paged.pageSize,
        hasMore: paged.page * paged.pageSize < paged.total,
      },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }),
    );
  } catch (error) {
    console.error('Skills List API error:', error);
    return errorResponse(error);
  }
};
