import type { APIRoute } from 'astro';
import { createRateLimiter, getClientIP, rateLimitResponse } from '../../lib/rate-limit';
import type { Env } from '../../lib/kv';
import { searchSkills } from '../../lib/search';
import { getLightweightSkills, type UnifiedSkill } from '../../lib/skills';

// Protects search endpoint from abuse.
const searchLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const RESULT_LIMIT = 10;

function buildFtsQuery(input: string): string {
  const terms = input
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (terms.length === 0) return '';
  return terms.map((term) => `${term}*`).join(' OR ');
}

function normalizeSource(source: unknown): string {
  if (typeof source !== 'string') return 'cache';
  return source.replace(/^"(.*)"$/, '$1');
}

function mapSkillResult(skill: UnifiedSkill, index: number, total: number) {
  const fallbackScore = total > 1 ? Math.max(0.2, 1 - index / total) : 1;
  return {
    id: skill.id,
    score: Number(fallbackScore.toFixed(4)),
    owner: skill.owner,
    repo: skill.repo,
    name: skill.name || skill.skillName || skill.repo,
    stars: skill.stars || 0,
    category: skill.category || '',
    source: skill.source || 'cache',
  };
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const locale = (url.searchParams.get('locale') || 'en').slice(0, 8);

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Truncate excessively long queries to prevent abuse
  const sanitizedQuery = query.trim().slice(0, 200);

  // ── Rate Limit Check ──
  const clientIP = getClientIP(request);
  if (searchLimiter.isLimited(clientIP)) {
    return rateLimitResponse();
  }

  try {
    const env = (locals.runtime?.env || {}) as Env;
    const ftsQuery = buildFtsQuery(sanitizedQuery);

    if (env?.DB && ftsQuery) {
      const ftsResp = await env.DB.prepare(
        `
          SELECT
            s.id,
            s.owner,
            s.repo,
            s.name,
            s.stars,
            s.category,
            json_extract(s.data_json, '$.source') AS source,
            bm25(skills_fts) AS rank
          FROM skills_fts
          JOIN skills s ON s.id = skills_fts.id
          WHERE skills_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `,
      )
        .bind(ftsQuery, RESULT_LIMIT)
        .all();

      const rows = Array.isArray(ftsResp.results) ? ftsResp.results : [];
      if (rows.length > 0) {
        const results = rows.map((row: any, index: number) => ({
          id: row.id,
          score: Number((1 / (1 + Math.abs(Number(row.rank) || index + 1))).toFixed(4)),
          owner: row.owner,
          repo: row.repo,
          name: row.name || row.repo,
          stars: Number(row.stars || 0),
          category: row.category || '',
          source: normalizeSource(row.source),
        }));

        return new Response(JSON.stringify({ results }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }
    }

    const skills = await getLightweightSkills(env);
    const ranked = searchSkills(skills, sanitizedQuery, locale).slice(0, RESULT_LIMIT);
    const results = ranked.map((skill, index) => mapSkillResult(skill, index, ranked.length));

    return new Response(JSON.stringify({ results }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    console.error('Search API Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal Server Error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};
