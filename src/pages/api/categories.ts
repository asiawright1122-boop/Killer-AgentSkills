import type { APIRoute } from 'astro';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, loadMessages, useTranslations, type Locale } from '../../i18n';
import { type Env } from '../../lib/kv';
import { errorResponse, jsonResponse } from '../../lib/api-utils';
import { getMarketplaceOverview } from '../../lib/marketplace-overview';
import { withPublicApiHeaders } from '../../lib/public-skill-api';
import { getRuntimeEnv } from '../../lib/runtime-env';

export const prerender = false;

/**
 * GET /api/categories
 *
 * Returns all skill categories with counts and descriptions.
 */
function resolveLocale(request: Request): Locale {
  const url = new URL(request.url);
  const requested = url.searchParams.get('locale') || DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(requested as Locale) ? (requested as Locale) : DEFAULT_LOCALE;
}

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const locale = resolveLocale(request);
    const [env, messages] = await Promise.all([getRuntimeEnv<Env>(locals), loadMessages(locale)]);
    const overview = await getMarketplaceOverview(env, locale, useTranslations(messages), {
      includeOtherCategory: true,
    });
    const categories = overview.categories.map((category) => ({
      name: category.id,
      id: category.id,
      label: category.label,
      icon: category.icon,
      href: category.href,
      description: category.seoDescription,
      count: category.count,
    }));

    return jsonResponse(
      { categories, total: categories.length, totalSkillCount: overview.totalSkillCount },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }),
    );
  } catch (error) {
    console.error('Categories API error:', error);
    return errorResponse(error);
  }
};
