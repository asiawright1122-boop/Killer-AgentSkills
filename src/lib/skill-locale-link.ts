import { DEFAULT_LOCALE } from '../i18n';
import { skillLocaleGovernanceMap } from './skill-locale-governance';

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
  const governance = skillLocaleGovernanceMap.get(key);

  if (!governance) {
    return selectSkillDetailLocale(requestedLocale, null);
  }

  // Transform the shared governance record to the format expected by selectSkillDetailLocale
  return selectSkillDetailLocale(requestedLocale, {
    eligibleLocales:
      governance.publishedLocales.length > 0
        ? governance.publishedLocales
        : ([governance.canonicalLocale].filter(Boolean) as string[]),
    canonicalLocale: governance.canonicalLocale,
  });
}
