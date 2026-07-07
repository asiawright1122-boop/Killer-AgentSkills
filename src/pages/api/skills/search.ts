import type { APIRoute } from 'astro';
import { type Env } from '../../../lib/kv';
import { searchSkills, filterByCategory } from '../../../lib/search';
import {
  getLightweightSkills,
  getLocalizedDescription,
  isPublicSkill,
  type UnifiedSkill,
} from '../../../lib/public-skill-catalog';
import { errorResponse } from '../../../lib/api-utils';
import { compareSkillsPopular, getMarketplaceSkills } from '../../../lib/marketplace-filters';
import {
  checkRateLimitDetailed,
  createRateLimiter,
  getClientIP,
  rateLimitResponse,
  type KVNamespaceLike,
} from '../../../lib/rate-limit';
import { sanitizePublicSkill, withPublicApiHeaders } from '../../../lib/public-skill-api';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

// Local-isolate fallback; prod uses RATE_LIMIT_SKILLS_SEARCH (wrangler.toml).
const skillsSearchLimiterFallback = createRateLimiter({ windowMs: 60_000, max: 30 });

const MARKETPLACE_ADMISSION_SQL = `
  (s.security_level IS NULL OR s.security_level != 'D')
  AND COALESCE(s.source_trust, json_extract(s.data_json, '$.sourceTrust'), '') IN ('T1', 'T2')
  AND (
    json_extract(s.data_json, '$.isTrustedRankingEligible') IS NULL
    OR (
      json_extract(s.data_json, '$.isTrustedRankingEligible') != 0
      AND LOWER(CAST(json_extract(s.data_json, '$.isTrustedRankingEligible') AS TEXT)) != 'false'
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(COALESCE(json_extract(s.data_json, '$.riskFlags'), '[]')) AS risk
    WHERE LOWER(COALESCE(json_extract(risk.value, '$.severity'), '')) = 'blocker'
  )
`;

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
  const env = await getRuntimeEnv<Env>(locals);

  // Rate limit check (KV-backed with in-memory fallback)
  const clientIP = getClientIP(request);
  const kv = env?.SKILLS_CACHE as KVNamespaceLike | undefined;
  const rl = await checkRateLimitDetailed(
    kv,
    { bucket: 'skills-search', key: clientIP, max: 30, periodSec: 60 },
    skillsSearchLimiterFallback,
  );
  if (!rl.allowed) {
    const r = rateLimitResponse();
    r.headers.set('X-RL-Source', rl.source);
    return r;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
  const category = url.searchParams.get('category');
  const locale = url.searchParams.get('locale') || 'en';

  try {
    let _skills: UnifiedSkill[] = [];
    let _total = 0;

    // ==========================================
    // 1. FAST PATH: Cloudflare D1 (FTS5 & SQL)
    // ==========================================
    if (env?.DB) {
      try {
        const conditions = [MARKETPLACE_ADMISSION_SQL];
        const params: (string | number)[] = [];

        let joinFts = '';
        let orderBy =
          'ORDER BY COALESCE(s.rank_score, 0) DESC, COALESCE(s.quality_score, 0) DESC, COALESCE(s.stars, 0) DESC, LOWER(COALESCE(s.name, s.repo, s.id)) ASC';

        if (query.trim()) {
          // Sanitize and format for FTS5 prefix matching: "word1"* AND "word2"*
          const safeQuery = query.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-\s]/g, ' ').trim();
          if (safeQuery) {
            const ftsQuery = safeQuery
              .split(/\s+/)
              .map((word) => `"${word}"*`)
              .join(' AND ');
            joinFts = `JOIN skills_fts f ON s.id = f.id`;
            conditions.push('skills_fts MATCH ?');
            params.push(ftsQuery);
            orderBy =
              'ORDER BY f.rank ASC, COALESCE(s.rank_score, 0) DESC, COALESCE(s.quality_score, 0) DESC, COALESCE(s.stars, 0) DESC, LOWER(COALESCE(s.name, s.repo, s.id)) ASC';
          }
        }

        if (category) {
          conditions.push('s.category = ?');
          params.push(category);
        }

        const condition = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) as total FROM skills s ${joinFts} ${condition}`;
        const dataQuery = `SELECT s.data_json FROM skills s ${joinFts} ${condition} ${orderBy} LIMIT ? OFFSET ?`;

        // Execute queries concurrently
        const [countResult, dataResult] = await Promise.all([
          env.DB.prepare(countQuery)
            .bind(...params)
            .first(),
          env.DB.prepare(dataQuery)
            .bind(...params, limit, (page - 1) * limit)
            .all<Record<string, unknown>>(),
        ]);

        if (countResult && dataResult.success) {
          const parsedSkills = (dataResult.results as unknown as Record<string, unknown>[])
            .map((row: Record<string, unknown>) => JSON.parse(row.data_json as string) as UnifiedSkill)
            .filter((skill: UnifiedSkill) => isPublicSkill(skill));

          _skills = getMarketplaceSkills(parsedSkills).map((skill: UnifiedSkill) => ({
            ...skill,
            description: getLocalizedDescription(skill.description, locale),
          }));
          const countedTotal = Number(countResult.total) || 0;
          _total = parsedSkills.length === _skills.length ? countedTotal : _skills.length;

          return new Response(
            JSON.stringify({
              skills: _skills.map((skill) => sanitizePublicSkill(skill)),
              total: _total,
              page,
              hasMore: page * limit < _total,
            }),
            {
              status: 200,
              headers: withPublicApiHeaders({
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              }),
            },
          );
        }
      } catch (e) {
        console.warn('[D1 Search] Failed, falling back to KV:', e);
        // Fallthrough to KV logic
      }
    }

    // 2. SLOW PATH: KV + JS Memory (Fallback)
    // ==========================================
    _skills = env ? getMarketplaceSkills(await getLightweightSkills(env)) : [];

    // Localize descriptions
    _skills = _skills.map((skill: UnifiedSkill) => ({
      ...skill,
      description: getLocalizedDescription(skill.description, locale),
    }));

    // Apply category filter
    if (category) {
      _skills = filterByCategory(_skills, category);
    }

    // Apply search query with relevance scoring
    if (query.trim()) {
      _skills = searchSkills(_skills, query, locale);
    } else {
      _skills.sort(compareSkillsPopular);
    }

    _total = _skills.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedSkills = _skills.slice(start, end);

    return new Response(
      JSON.stringify({
        skills: paginatedSkills.map((skill) => sanitizePublicSkill(skill)),
        total: _total,
        page,
        hasMore: end < _total,
      }),
      {
        status: 200,
        headers: withPublicApiHeaders({
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        }),
      },
    );
  } catch (error) {
    console.error('Search API error:', error);
    return errorResponse(error);
  }
};
