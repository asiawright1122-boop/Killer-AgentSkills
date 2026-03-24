#!/usr/bin/env node
/**
 * Collection Theme Alignment Audit
 * 
 * Validates that all Collection JSON files maintain theme alignment
 * with the AI Agent Skills ecosystem. Detects theme drift and suggests fixes.
 */

import * as fs from 'fs';
import * as path from 'path';

const THEME_KEYWORDS = [
  'ai agent',
  'agent skill',
  'claude code',
  'cursor',
  'windsurf',
  'mcp',
  'mcp server',
  'skill',
  'workflow',
  'automation',
  'ai coding',
  'developer workflow',
];

const UNTHEMATIC_PATTERNS = [
  /\b(udemy|coursera|edx|skillshare)\.com\b/i,
  /\b(free\s*(pdf|download|course|ebook))\b/i,
  /\b(versus|vs\.|alternative|comparison)\s+guide\b/i,
  /\bbest\s+\d+\s+/i,
  /\b(top\s+\d+|top\s+best)\b/i,
  /\b(what\s+is|how\s+to|why\s+use|learn\s+)\b/i,
];

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

interface CollectionFile {
  filename: string;
  path: string;
  data: any;
}

interface AuditResult {
  filename: string;
  passed: boolean;
  issues: AuditIssue[];
}

interface AuditIssue {
  locale: string;
  field: string;
  value: string;
  issue: string;
  suggestion?: string;
}

function loadCollections(): CollectionFile[] {
  const collectionsDir = path.join(process.cwd(), 'src/content/collections');
  const files: CollectionFile[] = [];

  if (!fs.existsSync(collectionsDir)) {
    console.error('Collections directory not found:', collectionsDir);
    return files;
  }

  for (const filename of fs.readdirSync(collectionsDir)) {
    if (!filename.endsWith('.json')) continue;
    const filePath = path.join(collectionsDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      files.push({ filename, path: filePath, data });
    } catch (e) {
      console.error(`Failed to parse ${filename}:`, e);
    }
  }

  return files;
}

function hasThemeKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return THEME_KEYWORDS.some((kw) => lower.includes(kw));
}

function hasUnthematicPatterns(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of UNTHEMATIC_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) matches.push(match[0]);
    }
  }
  return matches;
}

function auditCollection(collection: CollectionFile): AuditResult {
  const issues: AuditIssue[] = [];
  const { data, filename } = collection;

  // Check title for each locale
  for (const locale of LOCALES) {
    const title = data.title?.[locale];
    if (!title) {
      issues.push({
        locale,
        field: 'title',
        value: '',
        issue: 'Missing title',
      });
      continue;
    }

    // Check for theme keywords in title
    if (!hasThemeKeywords(title)) {
      issues.push({
        locale,
        field: 'title',
        value: title,
        issue: 'Missing theme keywords (AI Agent, MCP, Claude Code, etc.)',
        suggestion: `Add "| AI Agent Skills" or "for Claude Code" to title`,
      });
    }

    // Check for unthematic patterns
    const unthematic = hasUnthematicPatterns(title);
    if (unthematic.length > 0) {
      issues.push({
        locale,
        field: 'title',
        value: title,
        issue: `Contains unthematic patterns: ${unthematic.join(', ')}`,
        suggestion: 'Remove comparison/tutorial language',
      });
    }
  }

  // Check description for each locale
  for (const locale of LOCALES) {
    const desc = data.description?.[locale];
    if (!desc) {
      issues.push({
        locale,
        field: 'description',
        value: '',
        issue: 'Missing description',
      });
      continue;
    }

    // Description should have at least one theme keyword
    if (!hasThemeKeywords(desc)) {
      issues.push({
        locale,
        field: 'description',
        value: desc.slice(0, 100) + '...',
        issue: 'Missing theme keywords in description',
        suggestion: 'Add references to AI agents, workflows, or MCP',
      });
    }
  }

  // Check keywords for each locale
  for (const locale of LOCALES) {
    const keywords = data.keywords?.[locale];
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      issues.push({
        locale,
        field: 'keywords',
        value: '',
        issue: 'Missing or empty keywords array',
      });
      continue;
    }

    // At least 2 keywords should have theme terms
    const themedCount = keywords.filter((kw: string) => hasThemeKeywords(kw)).length;
    if (themedCount < 2) {
      issues.push({
        locale,
        field: 'keywords',
        value: keywords.join(', '),
        issue: `Only ${themedCount} keywords contain theme terms (need at least 2)`,
        suggestion: 'Add keywords like "AI agent skill", "MCP server", "workflow automation"',
      });
    }

    // Check individual keywords for unthematic patterns
    for (const kw of keywords) {
      const unthematic = hasUnthematicPatterns(kw);
      if (unthematic.length > 0) {
        issues.push({
          locale,
          field: 'keywords',
          value: kw,
          issue: `Keyword contains unthematic pattern: ${unthematic.join(', ')}`,
          suggestion: 'Replace with capability-first keyword',
        });
      }
    }
  }

  // Check seoTitle and seoDescription
  for (const locale of LOCALES) {
    const seoTitle = data.seoTitle?.[locale];
    if (seoTitle && !hasThemeKeywords(seoTitle)) {
      issues.push({
        locale,
        field: 'seoTitle',
        value: seoTitle,
        issue: 'SEO title missing theme keywords',
        suggestion: 'Add "| AI Agent Skills" or IDE reference',
      });
    }

    const seoDesc = data.seoDescription?.[locale];
    if (seoDesc && !hasThemeKeywords(seoDesc)) {
      issues.push({
        locale,
        field: 'seoDescription',
        value: seoDesc.slice(0, 100) + '...',
        issue: 'SEO description missing theme keywords',
      });
    }
  }

  return {
    filename,
    passed: issues.length === 0,
    issues,
  };
}

function printResults(results: AuditResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('COLLECTION THEME ALIGNMENT AUDIT');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log(`Total Collections: ${results.length}`);
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log('');

  if (failed.length === 0) {
    console.log('🎉 All collections pass theme alignment audit!\n');
    return;
  }

  console.log('─'.repeat(80));
  console.log('ISSUES FOUND\n');

  for (const result of failed) {
    console.log(`\n📄 ${result.filename}`);
    console.log('─'.repeat(40));

    // Group issues by locale
    const byLocale: Record<string, AuditIssue[]> = {};
    for (const issue of result.issues) {
      if (!byLocale[issue.locale]) byLocale[issue.locale] = [];
      byLocale[issue.locale].push(issue);
    }

    for (const [locale, issues] of Object.entries(byLocale)) {
      console.log(`\n  [${locale.toUpperCase()}]`);
      for (const issue of issues) {
        console.log(`    • ${issue.field}: ${issue.issue}`);
        if (issue.value) {
          console.log(`      Value: "${issue.value.slice(0, 80)}${issue.value.length > 80 ? '...' : ''}"`);
        }
        if (issue.suggestion) {
          console.log(`      💡 Suggestion: ${issue.suggestion}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDED ACTIONS');
  console.log('='.repeat(80) + '\n');

  console.log('1. Run theme fix script to auto-correct minor issues');
  console.log('2. Manually review collections with multiple issues');
  console.log('3. Re-run audit after fixes: npx tsx scripts/audit-collection-theme.ts\n');
}

function main() {
  console.log('Loading collections from src/content/collections/...\n');

  const collections = loadCollections();
  if (collections.length === 0) {
    console.error('No collections found.');
    process.exit(1);
  }

  console.log(`Found ${collections.length} collections.\n`);

  const results: AuditResult[] = [];
  for (const collection of collections) {
    const result = auditCollection(collection);
    results.push(result);

    // Progress indicator
    process.stdout.write(result.passed ? '.' : 'x');
  }

  printResults(results);

  // Exit with error code if any failed
  const failedCount = results.filter((r) => !r.passed).length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
