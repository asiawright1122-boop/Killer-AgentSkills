export type SkillTryProfileId = 'copywriting' | 'meta-tags-optimizer' | 'schema-markup-generator' | 'doc-coauthoring';

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface SkillTryProfile {
  id: SkillTryProfileId;
  skillRef: string;
  label: LocalizedText;
  description: LocalizedText;
  inputLabel: LocalizedText;
  inputPlaceholder: LocalizedText;
  outputHint: LocalizedText;
}

export const SKILL_TRY_PROFILES: SkillTryProfile[] = [
  {
    id: 'copywriting',
    skillRef: 'copywriting',
    label: {
      en: 'Copywriting',
      zh: '营销文案',
    },
    description: {
      en: 'Generate landing-page style copy with headline, value points, and CTA.',
      zh: '生成着陆页风格文案，包含标题、价值点和 CTA。',
    },
    inputLabel: {
      en: 'What are you promoting?',
      zh: '你想推广什么？',
    },
    inputPlaceholder: {
      en: 'Example: AI workflow automation service for e-commerce teams',
      zh: '示例：面向电商团队的 AI 流程自动化服务',
    },
    outputHint: {
      en: 'Output: headline + subheadline + three benefit bullets + CTA.',
      zh: '输出：标题 + 副标题 + 3 条卖点 + CTA。',
    },
  },
  {
    id: 'meta-tags-optimizer',
    skillRef: 'meta-tags-optimizer',
    label: {
      en: 'Meta Tags Optimizer',
      zh: 'Meta 标签优化',
    },
    description: {
      en: 'Generate SEO title, meta description, and Open Graph copy.',
      zh: '生成 SEO 标题、描述和 Open Graph 文案。',
    },
    inputLabel: {
      en: 'Page topic and target keyword',
      zh: '页面主题与目标关键词',
    },
    inputPlaceholder: {
      en: 'Example: Product page for AI meeting notes generator, keyword "AI meeting notes"',
      zh: '示例：AI 会议纪要生成器产品页，关键词 “AI 会议纪要”',
    },
    outputHint: {
      en: 'Output: title tag, meta description, OG title, OG description.',
      zh: '输出：Title、Meta Description、OG Title、OG Description。',
    },
  },
  {
    id: 'schema-markup-generator',
    skillRef: 'schema-markup-generator',
    label: {
      en: 'Schema Markup Generator',
      zh: 'Schema 结构化数据',
    },
    description: {
      en: 'Generate JSON-LD schema for a page with practical implementation notes.',
      zh: '为页面生成 JSON-LD 结构化数据，并给出落地说明。',
    },
    inputLabel: {
      en: 'Describe the page you want schema for',
      zh: '描述你要加 Schema 的页面',
    },
    inputPlaceholder: {
      en: 'Example: Blog post about MCP server setup with step-by-step guide',
      zh: '示例：一篇讲 MCP Server 搭建步骤的博客文章',
    },
    outputHint: {
      en: 'Output: JSON-LD + quick implementation checklist.',
      zh: '输出：JSON-LD + 快速实施清单。',
    },
  },
  {
    id: 'doc-coauthoring',
    skillRef: 'doc-coauthoring',
    label: {
      en: 'Doc Coauthoring',
      zh: '文档共创',
    },
    description: {
      en: 'Turn a rough idea into a structured draft with goals, scope, and next steps.',
      zh: '把想法整理成结构化文档草稿，含目标、范围和下一步。',
    },
    inputLabel: {
      en: 'What document do you want to draft?',
      zh: '你想先起草什么文档？',
    },
    inputPlaceholder: {
      en: 'Example: Technical spec for adding online skill preview to Killer-Skills',
      zh: '示例：为 Killer-Skills 增加在线试用能力的技术方案',
    },
    outputHint: {
      en: 'Output: draft outline + key questions + first version of content.',
      zh: '输出：草稿大纲 + 关键问题 + 第一版内容。',
    },
  },
];

export function getSkillTryProfile(id: string): SkillTryProfile | undefined {
  return SKILL_TRY_PROFILES.find((item) => item.id === id);
}

export function localizeText(text: LocalizedText, locale: string): string {
  return locale === 'zh' ? text.zh : text.en;
}
