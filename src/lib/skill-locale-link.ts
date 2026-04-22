import { DEFAULT_LOCALE } from '../i18n';
import skillLocaleGovernanceData from '../../data/seo-skill-locale-governance.json';

type SkillLocaleGovernanceRecord = {
  owner?: string;
  routePath?: string;
  eligibleLocales?: string[];
  canonicalLocale?: string | null;
};

const skillLocaleGovernanceMap = (() => {
  const map = new Map<string, { eligibleLocales: string[]; canonicalLocale: string | null }>();
  const records = ((skillLocaleGovernanceData as { skills?: unknown[]; records?: unknown[] }).skills ??
    (skillLocaleGovernanceData as { records?: unknown[] }).records ??
    []) as SkillLocaleGovernanceRecord[];

  for (const record of records) {
    const owner = String(record.owner || '').trim();
    const routePath = String(record.routePath || '').trim();
    if (!owner || !routePath) continue;

    const eligibleLocales = Array.isArray(record.eligibleLocales)
      ? record.eligibleLocales
          .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
          .map((locale) => locale.trim().toLowerCase())
      : [];
    const canonicalLocale =
      typeof record.canonicalLocale === 'string' && record.canonicalLocale.trim().length > 0
        ? record.canonicalLocale.trim().toLowerCase()
        : null;

    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, {
      eligibleLocales,
      canonicalLocale,
    });
  }

  return map;
})();

export function selectSkillDetailLocale(
  requestedLocale: string,
  governance?: {
    eligibleLocales?: string[];
    canonicalLocale?: string | null;
  } | null,
): string {
  const normalizedRequestedLocale =
    String(requestedLocale || DEFAULT_LOCALE)
      .trim()
      .toLowerCase() || DEFAULT_LOCALE;
  if (!governance) return normalizedRequestedLocale;

  const eligibleLocales = Array.isArray(governance.eligibleLocales)
    ? governance.eligibleLocales
        .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
        .map((locale) => locale.trim().toLowerCase())
    : [];

  if (eligibleLocales.includes(normalizedRequestedLocale)) {
    return normalizedRequestedLocale;
  }

  const canonicalLocale =
    typeof governance.canonicalLocale === 'string' && governance.canonicalLocale.trim().length > 0
      ? governance.canonicalLocale.trim().toLowerCase()
      : null;

  return canonicalLocale || normalizedRequestedLocale || DEFAULT_LOCALE;
}

export function resolveSkillDetailLocale(owner: string, routePath: string, requestedLocale: string): string {
  const key = `${String(owner || '')
    .trim()
    .toLowerCase()}/${String(routePath || '')
    .trim()
    .toLowerCase()}`;
  return selectSkillDetailLocale(requestedLocale, skillLocaleGovernanceMap.get(key));
}
