export type LintViolation = {
  field: 'title' | 'description' | 'seoTitle' | 'seoDescription' | 'keywords';
  code: 'missing' | 'too_short' | 'too_long' | 'low_intent' | 'empty';
  locale: string;
  message: string;
};

export type LintResult = {
  violations: LintViolation[];
  warnings: LintViolation[];
};

const LOW_INTENT_KEYWORDS = new Set([
  'best',
  'top',
  'free',
  'comparison',
  'interview',
  'what is',
]);
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MIN = 40;
const SEO_DESCRIPTION_MAX = 155;

function isMostlyAscii(text: string): boolean {
  if (!text) return true;
  let ascii = 0;
  for (const ch of text) if (ch.charCodeAt(0) <= 127) ascii += 1;
  return ascii / text.length >= 0.8;
}

function checkLocalizedField(
  out: LintViolation[],
  field: LintViolation['field'],
  values: Record<string, string> | undefined,
  minLen: number,
  maxLen: number,
  isCjkShorter: boolean,
  slug: string,
): void {
  if (!values || Object.keys(values).length === 0) {
    out.push({
      field,
      code: 'missing',
      locale: '*',
      message: `${field} missing for ${slug}`,
    });
    return;
  }
  for (const [locale, value] of Object.entries(values)) {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      out.push({
        field,
        code: 'empty',
        locale,
        message: `${field} empty (${locale}) in ${slug}`,
      });
      continue;
    }
    const effectiveMin =
      isCjkShorter && !isMostlyAscii(trimmed) ? Math.floor(minLen / 2) : minLen;
    if (trimmed.length > maxLen) {
      out.push({
        field,
        code: 'too_long',
        locale,
        message: `${field} too long (${trimmed.length} > ${maxLen}, ${locale}) in ${slug}`,
      });
    }
    if (trimmed.length < effectiveMin) {
      out.push({
        field,
        code: 'too_short',
        locale,
        message: `${field} too short (${trimmed.length} < ${effectiveMin}, ${locale}) in ${slug}`,
      });
    }
  }
}

function checkKeywords(
  out: LintViolation[],
  values: Record<string, string[]> | undefined,
  slug: string,
): void {
  if (!values) return;
  for (const [locale, list] of Object.entries(values)) {
    for (const kw of list ?? []) {
      const tokens = kw.toLowerCase().split(/\s+/);
      for (const t of tokens) {
        if (LOW_INTENT_KEYWORDS.has(t)) {
          out.push({
            field: 'keywords',
            code: 'low_intent',
            locale,
            message: `keyword "${kw}" contains low-intent token "${t}" in ${slug}`,
          });
        }
      }
    }
  }
}

export function lintCollectionFrontmatter(
  data: {
    title?: Record<string, string>;
    description?: Record<string, string>;
    seoTitle?: Record<string, string>;
    seoDescription?: Record<string, string>;
    keywords?: Record<string, string[]>;
  },
  slug: string,
): LintResult {
  const violations: LintViolation[] = [];
  const warnings: LintViolation[] = [];

  checkLocalizedField(violations, 'title', data.title, 6, 80, true, slug);
  checkLocalizedField(
    violations,
    'description',
    data.description,
    30,
    240,
    true,
    slug,
  );
  // seoTitle / seoDescription: optional but if present, must satisfy length bounds.
  if (data.seoTitle)
    checkLocalizedField(
      violations,
      'seoTitle',
      data.seoTitle,
      6,
      SEO_TITLE_MAX,
      true,
      slug,
    );
  if (data.seoDescription)
    checkLocalizedField(
      violations,
      'seoDescription',
      data.seoDescription,
      SEO_DESCRIPTION_MIN,
      SEO_DESCRIPTION_MAX,
      true,
      slug,
    );
  checkKeywords(violations, data.keywords, slug);

  return { violations, warnings };
}
