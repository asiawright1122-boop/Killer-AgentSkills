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
    let skills: UnifiedSkill[] = [];
    let total = 0;

    // ==========================================
    // 1. FAST PATH: Cloudflare D1 (FTS5 & SQL)
    // ==========================================
    if (env?.DB) {
      try {
        let condition = '';
        const params: any[] = [];

        let joinFts = '';
        let orderBy = 'ORDER BY quality_score DESC, stars DESC';

        if (query.trim()) {
          // Sanitize and format for FTS5 prefix matching: "word1"* AND "word2"*
          const safeQuery = query.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-\s]/g, ' ').trim();
          if (safeQuery) {
            const ftsQuery = safeQuery.split(/\s+/).map(word => `"${word}"*`).join(' AND ');
            joinFts = `JOIN skills_fts f ON s.id = f.id`;
            condition += `WHERE skills_fts MATCH ? `;
            params.push(ftsQuery);
            orderBy = 'ORDER BY f.rank ASC, s.quality_score DESC, s.stars DESC';
          }
        }

        if (category) {
          condition += condition ? ` AND s.category = ? ` : `WHERE s.category = ? `;
          params.push(category);
        }

        const countQuery = `SELECT COUNT(*) as total FROM skills s ${joinFts} ${condition}`;
        const dataQuery = `SELECT s.data_json FROM skills s ${joinFts} ${condition} ${orderBy} LIMIT ? OFFSET ?`;

        // Execute queries concurrently
        const [countResult, dataResult] = await Promise.all([
          env.DB.prepare(countQuery).bind(...params).first(),
          env.DB.prepare(dataQuery).bind(...params, limit, (page - 1) * limit).all()
        ]);

        if (countResult && dataResult.success) {
          total = (countResult as any).total as number;

          // Parse JSON and localize
          skills = dataResult.results.map((row: any) => {
            const skill = JSON.parse(row.data_json as string) as UnifiedSkill;
            return {
              ...skill,
              description: getLocalizedDescription(skill.description, locale)
            };
          });

          return new Response(
            JSON.stringify({
              skills,
              total,
              page,
              hasMore: (page * limit) < total,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
          );
        }
      } catch (e) {
        console.warn('[D1 Search] Failed, falling back to KV:', e);
        // Fallthrough to KV logic
      }
    }

    // ==========================================
    // 2. SLOW PATH: KV + JS Memory (Fallback)
    // ==========================================
    if (env) {
      const raw = await getSkillsFromKV(env);
      skills = raw as UnifiedSkill[];
    }

    // Localize descriptions
    skills = skills.map((skill) => ({
      ...skill,
      description: getLocalizedDescription(skill.description, locale),
    }));

    // Apply category filter
    if (category) {
      skills = filterByCategory(skills, category);
    }

    // Apply search query with relevance scoring
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

    total = skills.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedSkills = skills.slice(start, end);

    return new Response(
      JSON.stringify({
        skills: paginatedSkills,
        total,
        page,
        hasMore: end < total,
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
