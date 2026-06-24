/**
 * typography.ts
 *
 * Generic Typography and Formatting Engine for CJK languages (zh, ja, ko).
 * Enforces CJK-English spacing ("盘古之白"), geolocalized punctuation mapping,
 * and localized phrasing glossary for technical/SEO terms.
 */

const CJK_CHAR_PATTERN = '[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7a3]';

// Glossary mapping for localized technical SEO terms
interface GlossaryEntry {
  patterns: RegExp[];
  zh: string;
  ja: string;
  ko: string;
}

const GLOSSARY: GlossaryEntry[] = [
  {
    patterns: [/AI Agent Skills?/gi, /AI 智能体技能/g, /AIエージェントスキル/g, /AI 에이전트 스킬/g],
    zh: 'AI 智能体技能',
    ja: 'AIエージェントスキル',
    ko: 'AI 에이전트 스킬',
  },
  {
    patterns: [/AI Agents?/gi, /AI 智能体/g, /AIエージェント/g, /AI 에이전트/g],
    zh: 'AI 智能体',
    ja: 'AIエージェント',
    ko: 'AI 에이전트',
  },
  {
    patterns: [/IDE integrations?/gi, /IDE 集成/g, /IDE統合/g, /IDE 통합/g],
    zh: 'IDE 集成',
    ja: 'IDE統合',
    ko: 'IDE 통합',
  },
  {
    patterns: [/installation platforms?/gi, /安装平台/g, /インストールプラットフォーム/g, /설치 플랫폼/g],
    zh: '安装平台',
    ja: 'インストールプラットフォーム',
    ko: '설치 플랫폼',
  },
  {
    patterns: [/developer tools?/gi, /开发者工具/g, /開発者ツール/g, /개발자 도구/g],
    zh: '开发者工具',
    ja: '開発者ツール',
    ko: '개발자 도구',
  },
  {
    patterns: [/workflow automations?/gi, /工作流自动化/g, /ワークフロー自動化/g, /워크플로우 자동화/g],
    zh: '工作流自动化',
    ja: 'ワークフロー自動化',
    ko: '워크플로우 자동화',
  },
  {
    patterns: [/marketplaces?/gi, /市场/g, /マーケットプレイス/g, /마켓플레이스/g],
    zh: '市场',
    ja: 'マーケットプレイス',
    ko: '마켓플레이스',
  },
  {
    patterns: [/system integrations?/gi, /系统集成/g, /システム統合/g, /시스템 통합/g],
    zh: '系统集成',
    ja: 'システム統合',
    ko: '시스템 통합',
  },
  {
    patterns: [/比较/g],
    zh: '对比',
    ja: '比較',
    ko: '비교',
  },
];

const ZH_JA_CHAR_PATTERN = '[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]';

/**
 * Automatically insert half-width spaces between CJK and alphanumeric characters / punctuation / backticks.
 */
export function formatSpacing(text: string, locale?: string): string {
  if (locale && locale !== 'zh' && locale !== 'ja') {
    return text;
  }
  // CJK followed by alphanumeric or common symbols like [, {, (, %, #, *, _
  text = text.replace(new RegExp(`(${CJK_CHAR_PATTERN})([a-zA-Z0-9\\[\\{\\(%#*_])`, 'g'), '$1 $2');
  // Alphanumeric or symbols like ], }, ), %, #, *, _ followed by CJK
  text = text.replace(new RegExp(`([a-zA-Z0-9\\]\\}\\)%#*_])(${CJK_CHAR_PATTERN})`, 'g'), '$1 $2');

  // CJK followed by backtick
  text = text.replace(new RegExp(`(${CJK_CHAR_PATTERN})(\`)`, 'g'), '$1 $2');
  // Backtick followed by CJK
  text = text.replace(new RegExp(`(\`)(${CJK_CHAR_PATTERN})`, 'g'), '$1 $2');

  // Clean up any double spaces introduced by replacements
  text = text.replace(/ {2,}/g, ' ');

  return text;
}

/**
 * Convert western punctuation to localized full-width CJK punctuation.
 * Excludes decimals, URLs, domain names, and code interpolation blocks via placeholder protection.
 */
export function cleanTypography(text: string, locale: string): string {
  if (typeof text !== 'string') {
    return text;
  }
  if (locale !== 'zh' && locale !== 'ja' && locale !== 'ko') {
    return text;
  }

  const placeholders: string[] = [];

  // 1. Protect Markdown Links [text](url) to avoid formatting URL punctuation
  let protectedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });

  // 2. Protect URLs
  protectedText = protectedText.replace(/https?:\/\/[^\s]+/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });

  // 3. Protect Curly Braces (Placeholders like {name}, {count})
  protectedText = protectedText.replace(/\{[a-zA-Z0-9_]+\}/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });

  // 4. Protect ellipses (...) or (…), to avoid replacing them with multiple CJK periods
  protectedText = protectedText.replace(/\.{3,}|…/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });

  // 5. Protect file paths, domains, and decimals (e.g. fal.ai, node.js, .json, 3.5, v1.2)
  // File paths / domains with dots
  protectedText = protectedText.replace(/\b[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+\b/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });
  // Floating numbers
  protectedText = protectedText.replace(/\b\d+\.\d+\b/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });
  // Prefix dots (like file extensions .json)
  protectedText = protectedText.replace(/(?<!\w)\.[a-zA-Z0-9_]+/g, (match) => {
    placeholders.push(match);
    return `TYPOPH${placeholders.length - 1}PH`;
  });

  // 6. Enforce Spacing (done on the protected text so that placeholders also receive appropriate spacing boundary)
  if (locale === 'zh' || locale === 'ja') {
    protectedText = formatSpacing(protectedText, locale);

    // 6.5. Remove spaces between consecutive CJK characters for zh and ja locales only
    protectedText = protectedText.replace(new RegExp(`(${ZH_JA_CHAR_PATTERN})\\s+(${ZH_JA_CHAR_PATTERN})`, 'g'), '$1$2');
  }

  // 7. Perform Geolocalized Punctuation Mapping
  if (locale === 'zh') {
    protectedText = protectedText
      .replace(/,(?!\d)/g, '，')
      .replace(/\.(?!\d)/g, '。')
      .replace(/!/g, '！')
      .replace(/\?/g, '？')
      .replace(/:/g, '：')
      .replace(/;/g, '；');
  } else if (locale === 'ja') {
    protectedText = protectedText
      .replace(/,(?!\d)/g, '、')
      .replace(/\.(?!\d)/g, '。')
      .replace(/!/g, '！')
      .replace(/\?/g, '？')
      .replace(/:/g, '：')
      .replace(/;/g, '；');
  } else if (locale === 'ko') {
    // Korean uses standard western half-width comma and period in modern style,
    // but full-width exclamation and question marks are preferred.
    protectedText = protectedText.replace(/!/g, '！').replace(/\?/g, '？');
  }

  // 8. Restore protected placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    protectedText = protectedText.replace(new RegExp(`TYPOPH${i}PH`, 'g'), placeholders[i]);
  }

  return protectedText;
}

/**
 * Replace raw machine translations of technical terms with standardized SEO phrasing.
 */
export function postProcessPhrasing(text: string, locale: string): string {
  if (typeof text !== 'string') {
    return text;
  }
  if (locale !== 'zh' && locale !== 'ja' && locale !== 'ko') {
    return text;
  }

  let processed = text;
  for (const entry of GLOSSARY) {
    const replacement = entry[locale as 'zh' | 'ja' | 'ko'];
    for (const pattern of entry.patterns) {
      processed = processed.replace(pattern, replacement);
    }
  }

  return processed;
}

/**
 * Ensure the CJK string ends with the appropriate terminal punctuation.
 */
export function ensureTerminalPunctuation(text: string, locale: string): string {
  if (typeof text !== 'string') {
    return text;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;

  const terminalRegex = /[.!?\u3002\uff01\uff1f]$/u;
  if (terminalRegex.test(trimmed)) {
    return text;
  }

  // Choose punctuation based on locale
  const mark = locale === 'zh' || locale === 'ja' ? '。' : '.';
  return trimmed + mark;
}
