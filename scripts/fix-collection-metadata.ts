#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const COLLECTIONS_DIR = 'src/content/collections';
const FIX_LOCALES = ['es', 'fr', 'de', 'pt', 'ru', 'ar'];

// Proper title templates for each locale
const TITLE_TEMPLATES: Record<string, (slug: string) => string> = {
  es: (slug) => {
    const terms = extractTerms(slug);
    return `Mejores servidores MCP de ${terms} en 2024`;
  },
  fr: (slug) => {
    const terms = extractTerms(slug);
    return `Meilleurs serveurs MCP ${terms} en 2024`;
  },
  de: (slug) => {
    const terms = extractTerms(slug);
    return `Beste MCP-Server ${terms} 2024`;
  },
  pt: (slug) => {
    const terms = extractTerms(slug);
    return `Melhores servidores MCP ${terms} em 2024`;
  },
  ru: (slug) => {
    const terms = extractTerms(slug);
    return `Лучшие MCP серверы ${terms} 2024`;
  },
  ar: (slug) => {
    const terms = extractTerms(slug);
    return `أفضل خوادم MCP ${terms} لعام 2024`;
  },
};

function extractTerms(slug: string): string {
  const terms = slug
    .replace('top-', '')
    .replace('-mcp-servers', '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter((t) => t.length > 2 && !['best', 'top', 'mcp', 'servers'].includes(t))
    .slice(0, 3);
  
  if (terms.length === 0) return 'AI';
  return terms.join(' ');
}

function generateDescription(lang: string, slug: string): string {
  const terms = extractTerms(slug);
  const descriptions: Record<string, string> = {
    es: `Explora los mejores servidores MCP para ${terms}. Una colección curada de herramientas esenciales para desarrolladores que trabajan con AI.`,
    fr: `Découvrez les meilleurs serveurs MCP pour ${terms}. Une collection sélectionnée d'outils essentiels pour les développeurs IA.`,
    de: `Entdecken Sie die besten MCP-Server für ${terms}. Eine kuratierte Auswahl wichtiger Tools für KI-Entwickler.`,
    pt: `Descubra os melhores servidores MCP para ${terms}. Uma coleção selecionada de ferramentas essenciais para desenvolvedores de IA.`,
    ru: `Откройте лучшие MCP-серверы для ${terms}. Тщательно подобранная коллекция инструментов для разработчиков ИИ.`,
    ar: `اكتشف أفضل خوادم MCP لـ ${terms}. مجموعة مختارة من الأدوات الأساسية لمطوري الذكاء الاصطناعي.`,
  };
  return descriptions[lang] || descriptions['en'];
}

function generateSeoTitle(title: string): string {
  const year = new Date().getFullYear();
  return `${title} ${year} | Killer-Skills`;
}

function generateSeoDescription(description: string): string {
  return description.substring(0, 150);
}

function generateKeywords(slug: string, locale: string): string[] {
  const terms = slug
    .replace('top-', '')
    .replace('-mcp-servers', '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter((t) => t.length > 2);
  
  const localeKeywords: Record<string, string[]> = {
    es: ['mcp servers', 'herramientas ai', 'desarrollo ai', 'claude'],
    fr: ['mcp servers', 'outils ia', 'développement ia', 'claude'],
    de: ['mcp servers', 'ki-werkzeuge', 'ki-entwicklung', 'claude'],
    pt: ['mcp servers', 'ferramentas ia', 'desenvolvimento ia', 'claude'],
    ru: ['mcp серверы', 'инструменты ии', 'разработка ии', 'claude'],
    ar: ['خوادم mcp', 'أدوات الذكاء الاصطناعي', 'تطوير الذكاء الاصطناعي', 'كلود'],
  };
  
  return [...new Set([...(localeKeywords[locale] || localeKeywords['en']), ...terms])].slice(0, 7);
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
