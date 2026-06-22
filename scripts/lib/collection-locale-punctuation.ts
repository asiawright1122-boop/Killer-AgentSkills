import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../../src/i18n';

type LocalizedValueKind = 'string' | 'string-array';

type RequiredLocalizedField = {
  path: string;
  kind: LocalizedValueKind;
  requireTerminalPunctuation?: boolean;
  optional?: boolean;
};

export type CollectionLocaleIssueCode =
  | 'missing_field'
  | 'missing_locale'
  | 'empty_locale'
  | 'invalid_locale_type'
  | 'missing_terminal_punctuation';

export type CollectionLocaleIssue = {
  file: string;
  path: string;
  locale?: string;
  code: CollectionLocaleIssueCode;
  message: string;
};

export type CollectionLocalePunctuationReport = {
  totalCollections: number;
  issues: CollectionLocaleIssue[];
};

export const COLLECTION_FULL_LOCALE_FIELDS: RequiredLocalizedField[] = [
  { path: 'title', kind: 'string' },
  { path: 'description', kind: 'string', requireTerminalPunctuation: true },
  { path: 'seoTitle', kind: 'string' },
  { path: 'seoDescription', kind: 'string', requireTerminalPunctuation: true },
  { path: 'longDescription', kind: 'string', requireTerminalPunctuation: true },
  { path: 'keywords', kind: 'string-array' },
  { path: 'editorial.reviewSummary', kind: 'string', requireTerminalPunctuation: true, optional: true },
  { path: 'editorial.selectionReason', kind: 'string', requireTerminalPunctuation: true, optional: true },
];

const TERMINAL_PUNCTUATION_RE = /[.!?\u3002\uff01\uff1f]$/u;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function getPathValue(record: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, record);
}

function hasTerminalPunctuation(value: string): boolean {
  return TERMINAL_PUNCTUATION_RE.test(value.trim());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function createIssue(
  file: string,
  field: RequiredLocalizedField,
  code: CollectionLocaleIssueCode,
  message: string,
  locale?: string,
): CollectionLocaleIssue {
  return { file, path: field.path, locale, code, message };
}

export function validateCollectionRecord(
  file: string,
  record: unknown,
  options: { locales?: string[]; fields?: RequiredLocalizedField[] } = {},
): CollectionLocaleIssue[] {
  const locales = options.locales || SUPPORTED_LOCALES;
  const fields = options.fields || COLLECTION_FULL_LOCALE_FIELDS;
  const issues: CollectionLocaleIssue[] = [];

  for (const field of fields) {
    const value = getPathValue(record, field.path);
    if (value === undefined || value === null) {
      if (!field.optional) {
        issues.push(createIssue(file, field, 'missing_field', `${field.path} is missing.`));
      }
      continue;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      issues.push(createIssue(file, field, 'invalid_locale_type', `${field.path} must be a locale map.`));
      continue;
    }

    const localized = value as Record<string, unknown>;
    for (const locale of locales) {
      if (!(locale in localized)) {
        issues.push(createIssue(file, field, 'missing_locale', `${field.path}.${locale} is missing.`, locale));
        continue;
      }

      const localeValue = localized[locale];
      if (field.kind === 'string-array') {
        if (!isNonEmptyStringArray(localeValue)) {
          issues.push(
            createIssue(
              file,
              field,
              'empty_locale',
              `${field.path}.${locale} must be a non-empty string array.`,
              locale,
            ),
          );
        }
        continue;
      }

      if (!isNonEmptyString(localeValue)) {
        issues.push(
          createIssue(file, field, 'empty_locale', `${field.path}.${locale} must be a non-empty string.`, locale),
        );
        continue;
      }

      if (field.requireTerminalPunctuation && !hasTerminalPunctuation(localeValue)) {
        issues.push(
          createIssue(
            file,
            field,
            'missing_terminal_punctuation',
            `${field.path}.${locale} must end with terminal punctuation.`,
            locale,
          ),
        );
      }
    }
  }

  return issues;
}

export function validateCollectionsDirectory(
  options: {
    workspaceRoot?: string;
    locales?: string[];
    fields?: RequiredLocalizedField[];
  } = {},
): CollectionLocalePunctuationReport {
  const workspaceRoot = resolve(options.workspaceRoot || process.cwd());
  const collectionsDir = resolve(workspaceRoot, 'src/content/collections');

  if (!existsSync(collectionsDir)) {
    throw new Error(`collections directory not found: ${collectionsDir}`);
  }

  const files = readdirSync(collectionsDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const issues = files.flatMap((file) => {
    const record = readJson<unknown>(join(collectionsDir, file));
    return validateCollectionRecord(file, record, {
      locales: options.locales,
      fields: options.fields,
    });
  });

  return {
    totalCollections: files.length,
    issues,
  };
}

export function renderCollectionLocalePunctuationReport(report: CollectionLocalePunctuationReport): string {
  const lines = [
    '# Collection CJK Parity and Punctuation Guard',
    '',
    `- Collections scanned: ${report.totalCollections}`,
    `- Issues found: ${report.issues.length}`,
  ];

  if (report.issues.length > 0) {
    lines.push('', '## Issues');
    for (const issue of report.issues.slice(0, 80)) {
      const locale = issue.locale ? `:${issue.locale}` : '';
      lines.push(`- ${issue.file} ${issue.path}${locale} [${issue.code}] ${issue.message}`);
    }
    if (report.issues.length > 80) {
      lines.push(`- ... ${report.issues.length - 80} more issue(s) omitted.`);
    }
  }

  lines.push('', `- Status: ${report.issues.length === 0 ? 'pass' : 'fail'}`);
  return lines.join('\n');
}
