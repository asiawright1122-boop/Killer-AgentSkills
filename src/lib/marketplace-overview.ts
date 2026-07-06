import type { Locale } from '../i18n';
import { CATEGORY_DEFS, getCategoryLabel, getCategorySeoDescription, normalizeCategoryId } from './category-taxonomy';
import type { Env, SkillsCategorySummary } from './kv';
import { getLightweightSkills, getLightweightSkillsCategorySummary, type UnifiedSkill } from './public-skill-catalog';
import { sanitizePublicAIOutput } from './public-ai-output';
import { CATEGORY_GROUPS } from './search';
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
const SOURCE_BUCKET_CATEGORY_IDS = new Set(['community', 'official', 'verified', 'featured', 'cache']);
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

function hasKnownCategoryCounts(counts: Record<string, number>) {
  return CATEGORY_DEFS.some((definition) => (counts[definition.id] || 0) > 0);
}

function publicText(value: unknown): string {
  if (typeof value === 'string') return sanitizePublicAIOutput(value);
  if (Array.isArray(value)) return value.map((entry) => publicText(entry)).join(' ');
  if (!value || typeof value !== 'object') return '';
  return Object.values(value as Record<string, unknown>)
    .map((entry) => publicText(entry))
    .join(' ');
}

function inferMarketplaceCategoryId(skill: UnifiedSkill): string | undefined {
  const explicitCategory = normalizeCategoryId(sanitizePublicAIOutput(skill.category));
  if (
    explicitCategory &&
    KNOWN_CATEGORY_IDS.has(explicitCategory) &&
    !SOURCE_BUCKET_CATEGORY_IDS.has(explicitCategory)
  ) {
    return explicitCategory;
  }

  const topics = (skill.topics || []).map((topic) => sanitizePublicAIOutput(topic).toLowerCase()).filter(Boolean);
  const searchableText = [
    explicitCategory && !SOURCE_BUCKET_CATEGORY_IDS.has(explicitCategory) ? explicitCategory : '',
    skill.name,
    skill.skillName,
    topics.join(' '),
    publicText(skill.description),
    publicText(skill.seo),
  ]
    .join(' ')
    .toLowerCase();

  let bestCategory = '';
  let bestScore = 0;

  for (const definition of CATEGORY_DEFS) {
    const terms = CATEGORY_GROUPS[definition.id] || [definition.id];
    let score = 0;

    for (const rawTerm of terms) {
      const term = rawTerm.toLowerCase();
      if (!term) continue;

      if (topics.includes(term)) {
        score += 6;
      } else if (topics.some((topic) => topic.length > 3 && (topic.includes(term) || term.includes(topic)))) {
        score += 3;
      }

      if (searchableText.includes(term)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = definition.id;
    }
  }

  return bestScore > 0 ? bestCategory : undefined;
}

async function getSkillsForDerivedCategoryCounts(env: Env | undefined): Promise<UnifiedSkill[]> {
  const primary = env ? await getLightweightSkills(env).catch(() => []) : [];
  if (primary.length > 0) return primary;
  return getLightweightSkills({} as Env).catch(() => []);
}

async function getDerivedCategorySummary(
  env: Env | undefined,
  totalSkillCount: number,
): Promise<SkillsCategorySummary | null> {
  const skills = await getSkillsForDerivedCategoryCounts(env);
  if (skills.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const skill of skills) {
    const category = inferMarketplaceCategoryId(skill);
    if (!category) continue;
    counts[category] = (counts[category] || 0) + 1;
  }

  const categories = Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: totalSkillCount || skills.length,
    categories,
  };
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
  let summary = await getCatalogSummary(env);
  let counts = buildCategoryCounts(summary);

  if (!hasKnownCategoryCounts(counts)) {
    const derivedSummary = await getDerivedCategorySummary(env, summary.total);
    const derivedCounts = derivedSummary ? buildCategoryCounts(derivedSummary) : {};
    if (derivedSummary && hasKnownCategoryCounts(derivedCounts)) {
      summary = derivedSummary;
      counts = derivedCounts;
    }
  }

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
