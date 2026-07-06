import type { APIRoute } from 'astro';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIP,
  rateLimitResponse,
  type KVNamespaceLike,
} from '../../lib/rate-limit';
import type { Env } from '../../lib/kv';
import { getMarketplaceSkills } from '../../lib/marketplace-filters';
import { searchSkills } from '../../lib/search';
import { resolveSkillDetailLink } from '../../lib/skill-detail-link';
import { getLightweightSkills, type UnifiedSkill } from '../../lib/public-skill-catalog';
import { sanitizePublicAIOutput } from '../../lib/public-ai-output';
import { withPublicApiHeaders } from '../../lib/public-skill-api';
import { getRuntimeEnv } from '../../lib/runtime-env';

// Protects search endpoint from abuse. In-memory fallback for local dev /
// tests; prod uses the cross-isolate RATE_LIMIT_SEARCH binding (see
// wrangler.toml).
const searchLimiterFallback = createRateLimiter({ windowMs: 60_000, max: 30 });
const RESULT_LIMIT = 10;
const MARKETPLACE_ADMISSION_SQL = `
  (s.security_level IS NULL OR s.security_level != 'D')
  AND (
    json_extract(s.data_json, '$.isTrustedRankingEligible') IS NULL
    OR (
      json_extract(s.data_json, '$.isTrustedRankingEligible') != 0
      AND LOWER(CAST(json_extract(s.data_json, '$.isTrustedRankingEligible') AS TEXT)) != 'false'
    )
  )
`;

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

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trustBoostFrom(data: { rankScore?: unknown; sourceTrust?: unknown; securityLevel?: unknown }): number {
  const rankScore = Math.max(0, Math.min(normalizeNumber(data.rankScore), 100)) / 100;
  const sourceBoost = data.sourceTrust === 'T1' ? 0.0025 : data.sourceTrust === 'T2' ? 0.001 : 0;
  const securityBoost =
    data.securityLevel === 'S+' ? 0.0025 : data.securityLevel === 'S' ? 0.002 : data.securityLevel === 'A' ? 0.001 : 0;

  return rankScore * 0.004 + sourceBoost + securityBoost;
}

function isMarketplaceMetadataAdmitted(data: { securityLevel?: unknown; isTrustedRankingEligible?: unknown }): boolean {
  if (data.securityLevel === 'D') return false;
  if (
    data.isTrustedRankingEligible === false ||
    data.isTrustedRankingEligible === 0 ||
    data.isTrustedRankingEligible === '0' ||
    data.isTrustedRankingEligible === 'false'
  ) {
    return false;
  }
  return true;
}

function sanitizeSearchResult<T extends Record<string, unknown>>(result: T): T {
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [
      key,
      typeof value === 'string' ? sanitizePublicAIOutput(value) : value,
    ]),
  ) as T;
}

function mapSkillResult(skill: UnifiedSkill, index: number, total: number, locale: string) {
  const fallbackScore = total > 1 ? Math.max(0.2, 1 - index / total) : 1;
  const detail = resolveSkillDetailLink(skill, locale);
  return sanitizeSearchResult({
    id: skill.id,
    score: Number(fallbackScore.toFixed(4)),
    owner: skill.owner,
    repo: skill.repo,
    routePath: detail?.routePath || skill.repo,
    detailLocale: detail?.detailLocale || locale,
    href: detail?.href || `/${locale}/skills/${encodeURIComponent(skill.owner)}/${encodeURIComponent(skill.repo)}`,
    name: skill.name || skill.skillName || skill.repo,
    stars: skill.stars || 0,
    category: skill.category || '',
    source: skill.source || 'cache',
    rankScore: skill.rankScore || skill.qualityScore || 0,
    securityLevel: skill.securityLevel || 'C',
    sourceTrust: skill.sourceTrust || 'T3',
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const locale = (url.searchParams.get('locale') || 'en').slice(0, 8);

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
      status: 400,
    });
  }

  // Truncate excessively long queries to prevent abuse
  const sanitizedQuery = query.trim().slice(0, 200);

  // ── Rate Limit Check ──
  const env = ((await getRuntimeEnv<Env>(locals)) || {}) as Env;
  const clientIP = getClientIP(request);
  const kv = env.SKILLS_CACHE as KVNamespaceLike | undefined;
  if (!(await checkRateLimit(kv, { bucket: 'search', key: clientIP, max: 30, periodSec: 60 }, searchLimiterFallback))) {
    return rateLimitResponse();
  }

  try {
    const ftsQuery = buildFtsQuery(sanitizedQuery);

    let semanticMatches: any[] = [];
    let keywordMatches: any[] = [];

    // 1. Fetch from Vectorize (Semantic Search) and D1 (Keyword Search) concurrently
    const searchPromises = [];

    if (env.AI && env.VECTORIZE) {
      const semanticPromise = async () => {
        try {
          const embeddingResp: any = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [sanitizedQuery] });
          const data = embeddingResp.data;
          const vector = data ? (Array.isArray(data[0]) ? data[0] : data) : embeddingResp;

          if (vector && Array.isArray(vector)) {
            const vectorizeResp = await env.VECTORIZE!.query(vector, { topK: RESULT_LIMIT, returnMetadata: 'all' });
            semanticMatches = (vectorizeResp.matches || []).filter((match: { metadata?: Record<string, unknown> }) =>
              isMarketplaceMetadataAdmitted(match.metadata || {}),
            );
          }
        } catch (err) {
          console.error('Vectorize/AI search failed:', err);
        }
      };
      searchPromises.push(semanticPromise());
    }

    if (env.DB && ftsQuery) {
      const keywordPromise = async () => {
        try {
          const ftsResp = await env
            .DB!.prepare(
              `
              SELECT
                s.id,
                s.owner,
                s.repo,
                s.name,
                s.stars,
                s.category,
                s.rank_score AS rankScore,
                s.quality_score AS qualityScore,
                s.security_level AS securityLevel,
                s.source_trust AS sourceTrust,
                json_extract(s.data_json, '$.isTrustedRankingEligible') AS isTrustedRankingEligible,
                json_extract(s.data_json, '$.source') AS source,
                bm25(skills_fts) AS rank
              FROM skills_fts
              JOIN skills s ON s.id = skills_fts.id
              WHERE skills_fts MATCH ?
                AND ${MARKETPLACE_ADMISSION_SQL}
              ORDER BY rank, COALESCE(s.rank_score, s.quality_score, 0) DESC
              LIMIT ?
            `,
            )
            .bind(ftsQuery, RESULT_LIMIT)
            .all();
          keywordMatches = Array.isArray(ftsResp.results)
            ? ftsResp.results.filter((row) => isMarketplaceMetadataAdmitted(row as Record<string, unknown>))
            : [];
        } catch (err) {
          console.error('D1 FTS search failed:', err);
        }
      };
      searchPromises.push(keywordPromise());
    }

    await Promise.allSettled(searchPromises);

    // 2. RRF (Reciprocal Rank Fusion) Scoring
    const rrfK = 60;
    const combinedScores = new Map<
      string,
      {
        score: number;
        owner: string;
        repo: string;
        name: string;
        category: string;
        stars: number;
        source: string;
        rankScore: number;
        securityLevel: string;
        sourceTrust: string;
      }
    >();

    // Map Keyword Results
    keywordMatches.forEach((row, index) => {
      const rrfScore = 1 / (rrfK + index + 1); // Exact match rank 1 gets highest RRF score from exact matching
      combinedScores.set(row.id, {
        score: rrfScore + trustBoostFrom(row),
        owner: row.owner,
        repo: row.repo,
        name: row.name || row.repo,
        category: row.category || '',
        stars: Number(row.stars || 0),
        source: normalizeSource(row.source),
        rankScore: normalizeNumber(row.rankScore ?? row.qualityScore),
        securityLevel: String(row.securityLevel || 'C'),
        sourceTrust: String(row.sourceTrust || 'T3'),
      });
    });

    // Merge Vector Results
    semanticMatches.forEach((match, index) => {
      const rrfScore = 1.2 / (rrfK + index + 1); // Slight 20% boost to semantic matches
      const existing = combinedScores.get(match.id);
      if (existing) {
        existing.score += rrfScore + trustBoostFrom(existing); // Additive RRF
      } else {
        const meta = match.metadata || {};
        combinedScores.set(match.id, {
          score: rrfScore + trustBoostFrom(meta),
          owner: (meta.owner as string) || '',
          repo: (meta.repo as string) || '',
          name: (meta.name as string) || (meta.repo as string) || match.id,
          category: (meta.category as string) || '',
          stars: typeof meta.stars === 'number' ? meta.stars : 0,
          source: 'cache',
          rankScore: normalizeNumber(meta.rankScore ?? meta.qualityScore),
          securityLevel: String(meta.securityLevel || 'C'),
          sourceTrust: String(meta.sourceTrust || 'T3'),
        });
      }
    });

    // If both failed or empty, fallback to fuse.js memory search
    if (combinedScores.size === 0) {
      const skills = getMarketplaceSkills(await getLightweightSkills(env));
      const ranked = searchSkills(skills, sanitizedQuery, locale).slice(0, RESULT_LIMIT);
      const results = ranked.map((skill, index) => mapSkillResult(skill, index, ranked.length, locale));

      return new Response(JSON.stringify({ results }), {
        headers: withPublicApiHeaders({
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        }),
      });
    }

    // 3. Sort by RRF and return top K
    const results = Array.from(combinedScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, RESULT_LIMIT)
      .map(([id, data]) => {
        const detail = resolveSkillDetailLink(
          {
            id,
            owner: data.owner,
            repo: data.repo,
          },
          locale,
        );

        return sanitizeSearchResult({
          id,
          score: Number(data.score.toFixed(4)),
          owner: data.owner,
          repo: data.repo,
          routePath: detail?.routePath || data.repo,
          detailLocale: detail?.detailLocale || locale,
          href: detail?.href || `/${locale}/skills/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}`,
          name: data.name,
          stars: data.stars,
          category: data.category,
          source: data.source,
          rankScore: data.rankScore,
          securityLevel: data.securityLevel,
          sourceTrust: data.sourceTrust,
        });
      });

    return new Response(JSON.stringify({ results }), {
      headers: withPublicApiHeaders({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      }),
    });
  } catch (e) {
    console.error('Search API Error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
      status: 500,
    });
  }
};
