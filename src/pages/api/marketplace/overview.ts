import type { APIRoute } from 'astro';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, loadMessages, useTranslations, type Locale } from '../../../i18n';
import { jsonResponse } from '../../../lib/api-utils';
import type { Env } from '../../../lib/kv';
import { getMarketplaceOverview } from '../../../lib/marketplace-overview';
import { withPublicApiHeaders } from '../../../lib/public-skill-api';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

function resolveLocale(request: Request): Locale {
  const url = new URL(request.url);
  const requested = url.searchParams.get('locale') || DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(requested as Locale) ? (requested as Locale) : DEFAULT_LOCALE;
}

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const locale = resolveLocale(request);
    const [env, messages] = await Promise.all([getRuntimeEnv<Env>(locals), loadMessages(locale)]);
    const overview = await getMarketplaceOverview(env, locale, useTranslations(messages));

    return jsonResponse(
      {
        success: true,
        overview,
      },
      200,
      withPublicApiHeaders({ 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }),
    );
  } catch (error) {
    console.error('Marketplace overview API error:', error);
    return jsonResponse({ success: false, error: 'Failed to fetch marketplace overview' }, 500, withPublicApiHeaders());
  }
};
