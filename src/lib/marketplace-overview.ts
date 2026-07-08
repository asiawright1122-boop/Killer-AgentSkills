import type { Locale } from '../i18n';
import { CATEGORY_DEFS, getCategoryLabel, getCategorySeoDescription, normalizeCategoryId } from './category-taxonomy';
import type { Env, SkillsCategorySummary } from './kv';
import { getLightweightSkills, getLightweightSkillsCategorySummary } from './public-skill-catalog';
import { sanitizePublicAIOutput } from './public-ai-output';
import { getPrimaryNavItems } from './site-ia';

type Translator = (key: string) => string;

export type MarketplaceCategory = {
  id: string;
  label: string;
  icon: string;
  count: number;
  href: string;
  seoDescription: string;
};

export type MarketplaceOverview = {
  locale: Locale;
  totalSkillCount: number;
  categories: MarketplaceCategory[];
  topCategories: MarketplaceCategory[];
  featuredRoutes: MarketplaceRoute[];
  featuredCollections: [];
  solutionEntries: [];
};

export type MarketplaceRoute = {
  id: string;
  label: string;
  href: string;
  description: string;
};

const getFeaturedRoutes = (locale: Locale): MarketplaceRoute[] => getPrimaryNavItems(locale);

const EMPTY_CATEGORY_SUMMARY: SkillsCategorySummary = { total: 0, categories: [] };
const KNOWN_CATEGORY_IDS = new Set(CATEGORY_DEFS.map((definition) => definition.id));

function shouldRetryLocalCatalog(env: Env | undefined, summary: SkillsCategorySummary): boolean {
  return Boolean(env?.DB && summary.total === 0 && summary.categories.length === 0);
}

async function getCatalogSummary(env: Env | undefined): Promise<SkillsCategorySummary> {
  const summary = await getLightweightSkillsCategorySummary((env || {}) as Env).catch(() => EMPTY_CATEGORY_SUMMARY);

  if (shouldRetryLocalCatalog(env, summary)) {
    return getLightweightSkillsCategorySummary({} as Env).catch(() => summary);
  }

  return summary;
}

function buildCategoryCounts(summary: SkillsCategorySummary) {
  const counts: Record<string, number> = {};

  for (const entry of summary.categories) {
    const category = normalizeCategoryId(sanitizePublicAIOutput(entry.category)) || 'other';
    counts[category] = (counts[category] || 0) + Number(entry.count || 0);
  }

  return counts;
}

function inferCategoryFromSkill(skill: {
  category?: unknown;
  topics?: unknown;
  name?: unknown;
  description?: unknown;
}) {
  const candidates = [
    skill.category,
    ...(Array.isArray(skill.topics) ? skill.topics : []),
    skill.name,
    skill.description,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  for (const candidate of candidates) {
    const direct = normalizeCategoryId(candidate);
    if (KNOWN_CATEGORY_IDS.has(direct)) return direct;
  }

  const haystack = candidates.join(' ');
  if (/\b(playwright|browser|scrap|web)\b/.test(haystack)) return 'browser';
  if (/\b(markdown|docs?|documentation|pdf|readme)\b/.test(haystack)) return 'documentation';
  if (/\b(sql|database|data|etl|analytics)\b/.test(haystack)) return 'data';
  if (/\b(react|typescript|javascript|code|dev|debug|mcp)\b/.test(haystack)) return 'developer';
  if (/\b(deploy|docker|kubernetes|ci|cloud)\b/.test(haystack)) return 'devops';
  if (/\b(design|ui|ux|figma|brand)\b/.test(haystack)) return 'design';
  if (/\b(security|audit|auth|vulnerability)\b/.test(haystack)) return 'security';
  if (/\b(slack|message|communication|handoff)\b/.test(haystack)) return 'communication';

  return '';
}

async function getEffectiveCategoryCounts(env: Env | undefined, summary: SkillsCategorySummary) {
  const counts = buildCategoryCounts(summary);
  const hasKnownCategory = Object.keys(counts).some((category) => KNOWN_CATEGORY_IDS.has(category));
  if (hasKnownCategory || (summary.total || 0) === 0) return counts;

  const skills = await getLightweightSkills((env || {}) as Env).catch(() => []);
  for (const skill of skills) {
    const inferred = inferCategoryFromSkill(skill);
    if (!inferred) continue;
    counts[inferred] = (counts[inferred] || 0) + 1;
  }

  return counts;
}

export async function getMarketplaceOverview(
  env: Env | undefined,
  locale: Locale,
  t: Translator,
  options: {
    includeEmptyCategories?: boolean;
    topCategoryLimit?: number;
    collectionSurfaceIds?: string[];
    solutionLimit?: number;
    includeOtherCategory?: boolean;
  } = {},
): Promise<MarketplaceOverview> {
  const summary = await getCatalogSummary(env);
  const counts = await getEffectiveCategoryCounts(env, summary);

  const categories: MarketplaceCategory[] = CATEGORY_DEFS.map((definition) => ({
    id: definition.id,
    label: getCategoryLabel(definition.id, t),
    icon: definition.icon,
    count: counts[definition.id] || 0,
    href: `/${locale}/categories/${definition.id}`,
    seoDescription: getCategorySeoDescription(definition.id, locale),
  })).filter((category) => options.includeEmptyCategories || category.count > 0);

  const otherCount = Object.entries(counts).reduce(
    (total, [category, count]) => (KNOWN_CATEGORY_IDS.has(category) ? total : total + count),
    0,
  );
  const knownCount = CATEGORY_DEFS.reduce((total, definition) => total + (counts[definition.id] || 0), 0);
  const inferredOtherCount = Math.max(otherCount, (summary.total || 0) - knownCount);
  if (options.includeOtherCategory && (options.includeEmptyCategories || inferredOtherCount > 0)) {
    const translatedOther = t('Sidebar.categories.other');
    categories.push({
      id: 'other',
      label: translatedOther && translatedOther !== 'Sidebar.categories.other' ? translatedOther : 'Other',
      icon: 'layers',
      count: inferredOtherCount,
      href: `/${locale}/search`,
      seoDescription:
        locale === 'zh'
          ? '尚未归入标准工作流分类的技能。'
          : 'Skills that are not yet mapped to a standard workflow category.',
    });
  }

  const topCategoryLimit = options.topCategoryLimit ?? 4;
  const topCategories = [...categories].sort((a, b) => b.count - a.count).slice(0, topCategoryLimit);
  return {
    locale,
    totalSkillCount: summary.total || 0,
    categories,
    topCategories,
    featuredRoutes: getFeaturedRoutes(locale),
    featuredCollections: [],
    solutionEntries: [],
  };
}
