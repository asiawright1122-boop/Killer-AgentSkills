import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../../lib/kv';
import { getLocalizedDescription, type UnifiedSkill } from '../../../lib/skills';

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

        // 3. Sort by stars (default)
        skills.sort((a, b) => (b.stars || 0) - (a.stars || 0));

        // 4. Paginate
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedSkills = skills.slice(start, end);

        return new Response(
            JSON.stringify({
                skills: paginatedSkills,
                total: skills.length,
                page,
                limit,
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
        console.error('Skills List API error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to fetch skills' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
