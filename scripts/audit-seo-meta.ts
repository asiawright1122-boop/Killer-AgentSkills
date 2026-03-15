#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '../src/content');

type FieldKey = 'titles' | 'descriptions' | 'seoTitles' | 'seoDescriptions';

type IssueEntry = {
  locale: string;
  file: string;
  length: number;
  value: string;
};

type EmptyEntry = {
  locale: string;
  file: string;
};

type FieldResults = {
  tooLong: IssueEntry[];
  tooShort: IssueEntry[];
  empty: EmptyEntry[];
};

const RESULTS: Record<FieldKey, FieldResults> = {
  titles: { tooLong: [], tooShort: [], empty: [] },
  descriptions: { tooLong: [], tooShort: [], empty: [] },
  seoTitles: { tooLong: [], tooShort: [], empty: [] },
  seoDescriptions: { tooLong: [], tooShort: [], empty: [] },
};

const TITLE_MAX = 60;
const TITLE_MIN = 30;
const DESC_MAX = 160;
const DESC_MIN = 50;

function checkString(str: string, field: FieldKey, locale: string, file: string) {
  if (!str || str.trim() === '') {
    RESULTS[field].empty.push({ locale, file });
    return;
  }

  const isTitleField = field === 'titles' || field === 'seoTitles';
  const maxLength = isTitleField ? TITLE_MAX : DESC_MAX;
  const minLength = isTitleField ? TITLE_MIN : DESC_MIN;
  const len = str.length;

  if (len > maxLength) {
    RESULTS[field].tooLong.push({ locale, file, length: len, value: str.substring(0, 50) + '...' });
  }

  if (len < minLength) {
    RESULTS[field].tooShort.push({ locale, file, length: len, value: str });
  }
}

function checkCollections() {
  const dir = path.join(CONTENT_DIR, 'collections');
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    
    // Check title
    if (content.title) {
      for (const [locale, value] of Object.entries(content.title as Record<string, string>)) {
        checkString(value, 'titles', locale, file);
      }
    }
    
    // Check description
    if (content.description) {
      for (const [locale, value] of Object.entries(content.description as Record<string, string>)) {
        checkString(value, 'descriptions', locale, file);
      }
    }
    
    // Check seoTitle
    if (content.seoTitle) {
      for (const [locale, value] of Object.entries(content.seoTitle as Record<string, string>)) {
        checkString(value, 'seoTitles', locale, file);
      }
    }
    
    // Check seoDescription
    if (content.seoDescription) {
      for (const [locale, value] of Object.entries(content.seoDescription as Record<string, string>)) {
        checkString(value, 'seoDescriptions', locale, file);
      }
    }
  }
}

function checkBlogPosts() {
  const dir = path.join(CONTENT_DIR, 'blog');
  if (!fs.existsSync(dir)) return;
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Extract frontmatter
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          const fm = match[1];
          const titleMatch = fm.match(/title:\s*(.+)/);
          const descMatch = fm.match(/description:\s*(.+)/);
          
          if (titleMatch) {
            checkString(titleMatch[1].trim(), 'titles', 'en', file);
          }
          if (descMatch) {
            checkString(descMatch[1].trim(), 'descriptions', 'en', file);
          }
        }
      }
    }
  }
  walkDir(dir);
}

console.log('🔍 Auditing SEO meta tags...\n');

checkCollections();
checkBlogPosts();

// Print results
console.log('=== TITLES (recommended: 30-60 chars) ===');
console.log(`Too long (>${TITLE_MAX}): ${RESULTS.titles.tooLong.length}`);
if (RESULTS.titles.tooLong.length > 0) {
  console.log('  Examples:', RESULTS.titles.tooLong.slice(0, 3).map(r => `${r.file} [${r.locale}]: ${r.length} chars`).join(', '));
}
console.log(`Too short (<${TITLE_MIN}): ${RESULTS.titles.tooShort.length}`);
console.log(`Empty: ${RESULTS.titles.empty.length}`);

console.log('\n=== DESCRIPTIONS (recommended: 50-160 chars) ===');
console.log(`Too long (>${DESC_MAX}): ${RESULTS.descriptions.tooLong.length}`);
if (RESULTS.descriptions.tooLong.length > 0) {
  console.log('  Examples:', RESULTS.descriptions.tooLong.slice(0, 3).map(r => `${r.file} [${r.locale}]: ${r.length} chars`).join(', '));
}
console.log(`Too short (<${DESC_MIN}): ${RESULTS.descriptions.tooShort.length}`);
console.log(`Empty: ${RESULTS.descriptions.empty.length}`);

console.log('\n=== SEO TITLES ===');
console.log(`Too long (>${TITLE_MAX}): ${RESULTS.seoTitles.tooLong.length}`);
console.log(`Empty: ${RESULTS.seoTitles.empty.length}`);

console.log('\n=== SEO DESCRIPTIONS ===');
console.log(`Too long (>${DESC_MAX}): ${RESULTS.seoDescriptions.tooLong.length}`);
console.log(`Empty: ${RESULTS.seoDescriptions.empty.length}`);

// Summary
const totalIssues = 
  RESULTS.titles.tooLong.length + RESULTS.titles.tooShort.length +
  RESULTS.descriptions.tooLong.length + RESULTS.descriptions.tooShort.length +
  RESULTS.seoTitles.tooLong.length + 
  RESULTS.seoDescriptions.tooLong.length;

console.log(`\n📊 Total issues found: ${totalIssues}`);
console.log(totalIssues === 0 ? '✅ All meta tags are within recommended length!' : '⚠️ Some meta tags need attention');
