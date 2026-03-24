#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const COLLECTIONS_DIR = 'src/content/collections';
const FIX_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

const TOPIC_STOP_WORDS = new Set([
  'top',
  'best',
  'tools',
  'tool',
  'servers',
  'server',
  'skills',
  'skill',
  'for',
  'and',
  'the',
  'build',
  'building',
  'agent',
  'agents',
  'ai',
  'workflow',
  'workflows',
  'developer',
  'development',
]);

const TITLE_SUFFIX: Record<string, string> = {
  en: 'AI Agent Skills',
  zh: 'AI Agent Skills',
  ja: 'AI Agent Skills',
  ko: 'AI Agent Skills',
  es: 'AI Agent Skills',
  fr: 'AI Agent Skills',
  de: 'AI Agent Skills',
  pt: 'AI Agent Skills',
  ru: 'AI Agent Skills',
  ar: 'AI Agent Skills',
};

const DESCRIPTION_TEMPLATES: Record<string, (topic: string, hasMcp: boolean) => string> = {
  en: (topic, hasMcp) =>
    `Installable AI agent skills for ${topic} developer workflows in Claude Code, Cursor, and Windsurf${hasMcp ? ' with MCP-ready automation patterns' : ''}.`,
  zh: (topic, hasMcp) =>
    `面向 Claude Code、Cursor 与 Windsurf 的 ${topic} AI Agent Skills，聚焦 developer workflow automation${hasMcp ? ' 与 MCP 集成模式' : ''}。`,
  ja: (topic, hasMcp) =>
    `Claude Code・Cursor・Windsurf 向けの ${topic} AI Agent Skills 集合。developer workflow automation${hasMcp ? ' と MCP 連携' : ''} を重視します。`,
  ko: (topic, hasMcp) =>
    `Claude Code, Cursor, Windsurf용 ${topic} AI Agent Skills 모음입니다. developer workflow automation${hasMcp ? ' 및 MCP 통합' : ''}에 초점을 둡니다.`,
  es: (topic, hasMcp) =>
    `Colección de AI Agent Skills instalables para workflows de desarrollo de ${topic} en Claude Code, Cursor y Windsurf${hasMcp ? ' con patrones de automatización MCP' : ''}.`,
  fr: (topic, hasMcp) =>
    `Collection de AI Agent Skills installables pour les workflows développeur ${topic} dans Claude Code, Cursor et Windsurf${hasMcp ? ' avec des patterns MCP' : ''}.`,
  de: (topic, hasMcp) =>
    `Installierbare AI Agent Skills für ${topic} Developer Workflows in Claude Code, Cursor und Windsurf${hasMcp ? ' mit MCP-Automatisierung' : ''}.`,
  pt: (topic, hasMcp) =>
    `Coleção de AI Agent Skills instaláveis para workflows de desenvolvimento em ${topic} no Claude Code, Cursor e Windsurf${hasMcp ? ' com padrões MCP' : ''}.`,
  ru: (topic, hasMcp) =>
    `Подборка installable AI Agent Skills для developer workflow в ${topic} для Claude Code, Cursor и Windsurf${hasMcp ? ' с MCP-интеграциями' : ''}.`,
  ar: (topic, hasMcp) =>
    `مجموعة من AI Agent Skills القابلة للتثبيت لسيناريوهات ${topic} داخل Claude Code وCursor وWindsurf${hasMcp ? ' مع أنماط MCP' : ''}.`,
};

const KEYWORD_BASE: Record<string, string[]> = {
  en: ['AI agent skills', 'developer workflow skills', 'Claude Code skills', 'workflow automation'],
  zh: ['AI Agent Skills', '开发者工作流', 'Claude Code 技能', '工作流自动化'],
  ja: ['AI Agent Skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  ko: ['AI Agent Skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  es: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  fr: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  de: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  pt: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  ru: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
  ar: ['AI agent skills', 'developer workflow', 'Claude Code skills', 'workflow automation'],
};

function extractTopicTerms(slug: string): string[] {
  return slug
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((term) => !/^[0-9]{4}$/.test(term))
    .filter((term) => !TOPIC_STOP_WORDS.has(term))
    .filter((term) => term.length > 2)
    .slice(0, 4);
}

function pickTopicSource(content: any, slug: string): string {
  return content.canonicalSlug || slug;
}

function formatTopic(content: any, slug: string, locale: string): string {
  const terms = extractTopicTerms(pickTopicSource(content, slug));

  if (terms.length === 0) {
    const defaults: Record<string, string> = {
      en: 'developer workflows',
      zh: '开发工作流',
      ja: '開発ワークフロー',
      ko: '개발 워크플로우',
      es: 'workflows de desarrollo',
      fr: 'workflows développeur',
      de: 'Developer Workflows',
      pt: 'workflows de desenvolvimento',
      ru: 'developer workflow',
      ar: 'سير عمل المطورين',
    };
    return defaults[locale] || defaults.en;
  }

  return terms.join(' ');
}

function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\|\s*Killer-Skills$/i, '')
    .replace(/\s*\|\s*AI Agent Skills$/i, '')
    .replace(/\b(top|best|mejores|meilleurs|melhores|beste|principais|лучшие|أفضل)\s*-?\s*\d+\b/gi, '')
    .replace(/^(top|best|mejores|meilleurs|melhores|beste|principais|лучшие|أفضل)\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function generateTitle(content: any, slug: string, locale: string): string {
  const topic = formatTopic(content, slug, locale);
  const existing = cleanTitle(content.title?.[locale] || content.title?.en || '');
  const base = existing || topic;
  if (base.toLowerCase().includes('ai agent skills')) return base;
  return `${base} | ${TITLE_SUFFIX[locale] || TITLE_SUFFIX.en}`;
}

function generateDescription(content: any, locale: string, slug: string): string {
  const topic = formatTopic(content, slug, locale);
  const source = pickTopicSource(content, slug).toLowerCase();
  const hasMcp = source.includes('mcp');
  return DESCRIPTION_TEMPLATES[locale]?.(topic, hasMcp) || DESCRIPTION_TEMPLATES.en(topic, hasMcp);
}

function generateSeoTitle(title: string): string {
  const base = cleanTitle(title);
  const normalized = `AI Agent Skills - ${base} | Killer-Skills`;
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function generateSeoDescription(description: string): string {
  const base = description.includes('Killer-Skills') ? description : `${description} Killer-Skills.`;
  return base.length > 155 ? `${base.slice(0, 152)}...` : base;
}

function generateKeywords(content: any, slug: string, locale: string): string[] {
  const topic = formatTopic(content, slug, locale);
  const source = pickTopicSource(content, slug).toLowerCase();
  const topicKeywords = [
    `${topic} AI agent skills`,
    `${topic} developer workflow`,
    `${topic} workflow automation`,
  ];
  const mcpKeywords = source.includes('mcp') ? ['MCP integrations', 'MCP workflow automation'] : [];
  return [...new Set([...(KEYWORD_BASE[locale] || KEYWORD_BASE.en), ...topicKeywords, ...mcpKeywords])].slice(0, 8);
}

function processCollection(filePath: string) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const slug = path.basename(filePath, '.json');
  let modified = false;

  FIX_LOCALES.forEach((locale) => {
    const newTitle = generateTitle(content, slug, locale);
    const newDesc = generateDescription(content, locale, slug);

    content.title = content.title || {};
    content.title[locale] = newTitle;
    modified = true;

    content.description = content.description || {};
    content.description[locale] = newDesc;
    modified = true;

    content.seoTitle = content.seoTitle || {};
    content.seoTitle[locale] = generateSeoTitle(newTitle);
    modified = true;

    content.seoDescription = content.seoDescription || {};
    content.seoDescription[locale] = generateSeoDescription(newDesc);
    modified = true;

    content.keywords = content.keywords || {};
    content.keywords[locale] = generateKeywords(content, slug, locale);
    modified = true;
  });

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    return true;
  }
  return false;
}

function main() {
  const files = fs.readdirSync(COLLECTIONS_DIR).filter((f) => f.endsWith('.json'));
  let updated = 0;

  console.log(`Regenerating SEO metadata for ${files.length} collections...\n`);

  files.forEach((file) => {
    const filePath = path.join(COLLECTIONS_DIR, file);
    if (processCollection(filePath)) {
      console.log(`Updated: ${file}`);
      updated++;
    }
  });

  console.log(`\nDone! Updated ${updated} files.`);
}

main();
