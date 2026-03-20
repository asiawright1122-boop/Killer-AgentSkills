#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const COLLECTIONS_DIR = 'src/content/collections';
const FIX_LOCALES = ['es', 'fr', 'de', 'pt', 'ru', 'ar'];

function extractTopicTerms(slug: string): string[] {
  return slug
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((term) => !/^[0-9]{4}$/.test(term))
    .filter(
      (term) =>
        ![
          'best',
          'top',
          'mcp',
          'server',
          'servers',
          'ai',
          'tool',
          'tools',
          'workflow',
          'workflows',
          'collection',
        ].includes(term)
    )
    .filter((term) => term.length > 2)
    .slice(0, 4);
}

function formatTopic(slug: string, locale: string): string {
  const terms = extractTopicTerms(slug);

  if (terms.length === 0) {
    const defaults: Record<string, string> = {
      es: 'automatización y productividad',
      fr: 'automatisation et productivité',
      de: 'automatisierung und produktivität',
      pt: 'automação e produtividade',
      ru: 'автоматизация и продуктивность',
      ar: 'الأتمتة والإنتاجية',
    };
    return defaults[locale] || defaults.es;
  }

  return terms.join(' ');
}

const TITLE_TEMPLATES: Record<string, (slug: string) => string> = {
  es: (slug) => `Skills y herramientas de IA: ${formatTopic(slug, 'es')}`,
  fr: (slug) => `Compétences et outils IA : ${formatTopic(slug, 'fr')}`,
  de: (slug) => `Skills und KI-Tools: ${formatTopic(slug, 'de')}`,
  pt: (slug) => `Skills e ferramentas de IA: ${formatTopic(slug, 'pt')}`,
  ru: (slug) => `Навыки и ИИ-инструменты: ${formatTopic(slug, 'ru')}`,
  ar: (slug) => `المهارات وأدوات الذكاء الاصطناعي: ${formatTopic(slug, 'ar')}`,
};

function generateDescription(lang: string, slug: string): string {
  const topic = formatTopic(slug, lang);
  const descriptions: Record<string, string> = {
    es: `Colección curada de skills, herramientas de IA y flujos de trabajo prácticos. Tema principal: ${topic}.`,
    fr: `Collection organisée de skills, d'outils IA et de workflows pratiques. Thème principal : ${topic}.`,
    de: `Kuratiertе Sammlung aus Skills, KI-Tools und praktischen Workflows. Schwerpunkt: ${topic}.`,
    pt: `Coleção curada de skills, ferramentas de IA e workflows práticos. Tema principal: ${topic}.`,
    ru: `Кураторская коллекция навыков, ИИ-инструментов и практичных workflow. Основная тема: ${topic}.`,
    ar: `مجموعة منسقة من المهارات وأدوات الذكاء الاصطناعي وسير العمل العملي. الموضوع الرئيسي: ${topic}.`,
  };

  return descriptions[lang] || descriptions.es;
}

function generateSeoTitle(title: string): string {
  return `${title} | Killer-Skills`;
}

function generateSeoDescription(description: string): string {
  const base = `${description} Killer-Skills.`;
  return base.length > 155 ? `${base.slice(0, 152)}...` : base;
}

function generateKeywords(slug: string, locale: string): string[] {
  const terms = extractTopicTerms(slug);

  const localeKeywords: Record<string, string[]> = {
    es: ['skills', 'herramientas ia', 'workflows', 'automatización', 'productividad', 'claude'],
    fr: ['skills', 'outils ia', 'workflows', 'automatisation', 'productivité', 'claude'],
    de: ['skills', 'ki-tools', 'workflows', 'automatisierung', 'produktivität', 'claude'],
    pt: ['skills', 'ferramentas ia', 'workflows', 'automação', 'produtividade', 'claude'],
    ru: ['навыки', 'инструменты ии', 'workflow', 'автоматизация', 'продуктивность', 'claude'],
    ar: ['مهارات', 'أدوات الذكاء الاصطناعي', 'سير العمل', 'الأتمتة', 'الإنتاجية', 'claude'],
  };

  return [...new Set([...(localeKeywords[locale] || localeKeywords.es), ...terms])].slice(0, 8);
}

function processCollection(filePath: string) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const slug = path.basename(filePath, '.json');
  let modified = false;

  FIX_LOCALES.forEach((locale) => {
    const newTitle = TITLE_TEMPLATES[locale](slug);
    const newDesc = generateDescription(locale, slug);

    // Always overwrite for fixed locales
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
    content.keywords[locale] = generateKeywords(slug, locale);
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
