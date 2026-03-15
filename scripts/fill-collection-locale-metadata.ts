#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const COLLECTIONS_DIR = 'src/content/collections';
const MISSING_LOCALES = ['es', 'fr', 'de', 'pt', 'ru', 'ar'];

// Simple title/description generators from longDescription (extract first 1-2 sentences)
function extractTitleFromLongDesc(longDesc: string, locale: string): string {
  if (!longDesc) return '';
  const sentences = longDesc.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (!sentences[0]) return '';
  
  // For different locales, add appropriate prefixes
  const prefixes: Record<string, string> = {
    es: 'Mejores ',
    fr: 'Meilleurs ',
    de: 'Beste ',
    pt: 'Melhores ',
    ru: 'Лучшие ',
    ar: 'أفضل '
  };
  
  const prefix = prefixes[locale] || '';
  let title = sentences[0].trim();
  
  // Extract key terms based on the collection slug
  if (title.toLowerCase().includes('agentic') || title.toLowerCase().includes('agent')) {
    return prefix + (locale === 'zh' ? '代理式AI工具和MCP服务器' : 
           locale === 'ja' ? 'Agentic AIツール&MCPサーバー' :
           locale === 'ko' ? 'Agentic AI 도구 및 MCP 서버' :
           title.substring(0, 60));
  }
  
  return prefix + title.substring(0, 50);
}

function extractDescriptionFromLongDesc(longDesc: string): string {
  if (!longDesc) return '';
  const sentences = longDesc.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 2).join('. ').trim().substring(0, 200) + '.';
}

function generateSeoTitle(title: string, locale: string): string {
  const year = new Date().getFullYear();
  if (locale === 'zh') return `${title} ${year}年 | Killer-Skills`;
  if (locale === 'ja') return `${title} ${year}年版 | Killer-Skills`;
  if (locale === 'ko') return `${title} ${year} | Killer-Skills`;
  if (locale === 'es') return `${title} ${year} | Killer-Skills`;
  if (locale === 'fr') return `${title} ${year} | Killer-Skills`;
  if (locale === 'de') return `${title} ${year} | Killer-Skills`;
  if (locale === 'pt') return `${title} ${year} | Killer-Skills`;
  if (locale === 'ru') return `${title} ${year} | Killer-Skills`;
  if (locale === 'ar') return `${title} ${year} | Killer-Skills`;
  return `${title} ${year} | Killer-Skills`;
}

function generateSeoDescription(description: string): string {
  return description.substring(0, 155);
}

function generateKeywords(slug: string, locale: string): string[] {
  const baseKeywords: Record<string, string[]> = {
    es: ['mcp servers', 'herramientas ai', 'desarrollo ai'],
    fr: ['mcp servers', 'outils ia', 'développement ia'],
    de: ['mcp servers', 'ki-werkzeuge', 'ki-entwicklung'],
    pt: ['mcp servers', 'ferramentas ia', 'desenvolvimento ia'],
    ru: ['mcp серверы', 'инструменты ии', 'разработка ии'],
    ar: ['خوادم mcp', 'أدوات الذكاء الاصطناعي', 'تطوير الذكاء الاصطناعي']
  };
  
  // Extract key terms from slug
  const slugTerms = slug.replace('top-', '').replace('-mcp-servers', '').split('-');
  const localeKeywords = baseKeywords[locale] || baseKeywords['en'];
  
  return [...new Set([...localeKeywords, ...slugTerms.map(t => t.toLowerCase())])].slice(0, 7);
}

function processCollection(filePath: string) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let modified = false;
  
  MISSING_LOCALES.forEach(locale => {
    // Skip if longDescription doesn't exist for this locale
    if (!content.longDescription?.[locale]) return;
    
    const longDesc = content.longDescription[locale];
    
    // Generate title if missing
    if (!content.title?.[locale]) {
      content.title = content.title || {};
      content.title[locale] = extractTitleFromLongDesc(longDesc, locale);
      modified = true;
    }
    
    // Generate description if missing
    if (!content.description?.[locale]) {
      content.description = content.description || {};
      content.description[locale] = extractDescriptionFromLongDesc(longDesc);
      modified = true;
    }
    
    // Generate seoTitle if missing
    if (!content.seoTitle?.[locale]) {
      content.seoTitle = content.seoTitle || {};
      const baseTitle = content.title?.[locale] || content.title?.en || 'MCP Servers';
      content.seoTitle[locale] = generateSeoTitle(baseTitle, locale);
      modified = true;
    }
    
    // Generate seoDescription if missing
    if (!content.seoDescription?.[locale]) {
      content.seoDescription = content.seoDescription || {};
      content.seoDescription[locale] = generateSeoDescription(content.description?.[locale] || longDesc);
      modified = true;
    }
    
    // Generate keywords if missing
    if (!content.keywords?.[locale]) {
      content.keywords = content.keywords || {};
      const slug = path.basename(filePath, '.json');
      content.keywords[locale] = generateKeywords(slug, locale);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    console.log(`Updated: ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

function main() {
  const files = fs.readdirSync(COLLECTIONS_DIR).filter(f => f.endsWith('.json'));
  let updated = 0;
  
  console.log(`Processing ${files.length} collection files...\n`);
  
  files.forEach(file => {
    const filePath = path.join(COLLECTIONS_DIR, file);
    if (processCollection(filePath)) {
      updated++;
    }
  });
  
  console.log(`\nDone! Updated ${updated} files.`);
}

main();
