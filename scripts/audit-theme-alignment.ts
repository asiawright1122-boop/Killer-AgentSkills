#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Core brand identifiers - skills must relate to AI agent ecosystems
const THEME_KEYWORDS = [
  // Core brand
  'ai agent',
  'ai agent skill',
  'agent skill',
  'agent skills',
  'claude code',
  'cursor',
  'windsurf',
  'killer-skills',

  // IDE compatibility
  'cursor ide',
  'windsurf ide',
  'ai coding assistant',
  'claude desktop',
  'vs code copilot',

  // MCP Protocol
  'mcp',
  'model context protocol',
  'mcp server',
  'mcp tools',
  'mcp integration',
  'mcp client',
  'mcp protocol',

  // Installation patterns
  'install skill',
  'skill installation',
  '.claude',
  '.agent',
  '.codex',
  '.cursor',
  '.windsurf',
  'cursorrules',

  // Workflow automation
  'workflow',
  'automation',
  'agentic',
  'llm integration',
  'agentic workflow',
  'ai automation',

  // SKILL.md patterns
  'skill.md',
  'skills directory',
  'skill registry',
];

// Truly off-topic keywords - EXACT matches only (NOT related to AI agents at all)
// Using exact phrase matches to avoid false positives like "algorithmic-art" matching "algorithmic"
const UNTHEMATIC_KEYWORDS = [
  // Only flag EXACT platform names, not generic terms
  'udemy.com',
  'coursera.org',
  'udacity.com',
  'edx.org',
  'youtube.com/watch',
  'free pdf download',
  'ebook free',
];

// SEO title patterns that indicate theme drift
const SEO_TITLE_DRIFT_PATTERNS = [
  /^(how to|what is|why|learn) /i,
  /^(best|top|awesome|complete) /i,
  / tutorial$/i,
  / guide$/i,
  / course$/i,
];

/**
 * Enforce theme compliance on a skill's SEO metadata
 * This function auto-fixes common theme drift issues
 */
export function enforceThemeCompliance(skill: Skill): Skill {
  const name = skill.name || '';
  const seo = skill.seo || {};
  const seoTitle = typeof seo.title === 'string' ? seo.title : seo.title?.en || '';
  const keywords = seo.keywords?.en || [];

  // Fix SEO title if missing theme identifier
  if (seoTitle && !hasSEOThemeCompliance(seoTitle)) {
    const fixedTitle = fixSEOTitle(seoTitle, name);
    if (fixedTitle !== seoTitle) {
      if (typeof seo.title === 'string') {
        seo.title = fixedTitle;
      } else {
        seo.title = { ...seo.title, en: fixedTitle };
      }
    }
  }

  // Fix keywords if none match theme
  if (keywords.length > 0 && !hasKeywordThemeCompliance(keywords)) {
    const fixedKeywords = fixKeywords(keywords, name);
    seo.keywords = { ...seo.keywords, en: fixedKeywords };
  }

  return { ...skill, seo };
}

function hasSEOThemeCompliance(seoTitle: string): boolean {
  if (!seoTitle) return true;
  const lower = seoTitle.toLowerCase();
  return (
    lower.includes('ai agent') ||
    lower.includes('agent skill') ||
    lower.includes('claude code') ||
    lower.includes('cursor') ||
    lower.includes('windsurf') ||
    lower.includes('mcp') ||
    lower.includes('killer-skills') ||
    lower.includes('agentic')
  );
}

function hasKeywordThemeCompliance(keywords: string[]): boolean {
  return keywords.some((kw) => THEME_KEYWORDS.some((tk) => kw.toLowerCase().includes(tk.toLowerCase())));
}

function fixSEOTitle(title: string, skillName: string): string {
  // Check for common drift patterns and fix them
  if (/ tutorial$/i.test(title)) {
    title = title.replace(/ tutorial$/i, ' | AI Agent Skills');
  }
  if (/ guide$/i.test(title)) {
    title = title.replace(/ guide$/i, ' | AI Agent Skills');
  }
  if (/ course$/i.test(title)) {
    title = title.replace(/ course$/i, ' | Agent Skill');
  }
  if (/^(how to|what is|why|learn) /i.test(title)) {
    // Capitalize and add theme suffix
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (!title.includes('|')) {
      title = `${title} | AI Agent Skills`;
    }
  }

  // Ensure it ends with theme identifier
  if (!hasSEOThemeCompliance(title)) {
    // Extract capability from title (before colon or first part)
    const capability = title.split(':')[0].trim() || skillName;
    title = `${capability} | AI Agent Skills`;
  }

  return title;
}

function fixKeywords(keywords: string[], skillName: string): string[] {
  const fixed: string[] = [];

  for (const kw of keywords) {
    let fixedKw = kw;

    // Remove forbidden patterns
    if (/^(how to|what is|why|learn) /i.test(fixedKw)) {
      // Transform "how to X" to "X automation" or similar
      fixedKw = fixedKw.replace(/^(how to|what is|why|learn) /i, '').trim();
    }
    if (/ tutorial$/i.test(fixedKw)) {
      fixedKw = fixedKw.replace(/ tutorial$/i, '');
    }
    if (/ guide$/i.test(fixedKw)) {
      fixedKw = fixedKw.replace(/ guide$/i, '');
    }
    if (/^(best|top|awesome|complete) /i.test(fixedKw)) {
      fixedKw = fixedKw.replace(/^(best|top|awesome|complete) /i, '');
    }

    // Add theme keywords if missing
    if (fixedKw && !fixedKw.includes('tutorial') && !fixedKw.includes('course')) {
      fixed.push(fixedKw);
    }
  }

  // Ensure at least one theme keyword exists
  if (!hasKeywordThemeCompliance(fixed)) {
    // Add relevant theme keywords based on skill name
    const nameLower = skillName.toLowerCase();
    if (nameLower.includes('browser') || nameLower.includes('playwright') || nameLower.includes('scrape')) {
      fixed.unshift('browser automation', 'web scraping');
    } else if (nameLower.includes('slack') || nameLower.includes('discord') || nameLower.includes('notify')) {
      fixed.unshift('notification workflow', 'team automation');
    } else if (nameLower.includes('mcp') || nameLower.includes('server')) {
      fixed.unshift('mcp server', 'ai agent skill');
    } else if (nameLower.includes('notion') || nameLower.includes('database')) {
      fixed.unshift('workflow automation', 'ai agent skill');
    } else if (nameLower.includes('test') || nameLower.includes('debug')) {
      fixed.unshift('developer workflow', 'claude code');
    } else {
      // Generic fallback
      fixed.unshift('ai agent skill', 'workflow automation');
    }
  }

  // Deduplicate and limit
  return [...new Set(fixed)].slice(0, 10);
}

interface Skill {
  name?: string;
  description?: string | Record<string, string>;
  seo?: {
    title?: string | Record<string, string>;
    description?: string | Record<string, string>;
    keywords?: Record<string, string[]>;
  };
  topics?: string[];
}

function hasThematicKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  // Check for exact keyword matches
  if (THEME_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return true;
  }
  // Check for IDE-related patterns
  if (/\.(claude|agent|codex|cursor|windsurf|kiro|gemini)\//i.test(text)) {
    return true;
  }
  // Check for skill installation patterns
  if (/skill.*install|install.*skill|\.md\b/i.test(text) && /agent|claude|cursor/i.test(text)) {
    return true;
  }
  return false;
}

function hasUnthematicKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return UNTHEMATIC_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function checkSkill(skill: Skill): string[] {
  const issues: string[] = [];

  const name = skill.name || '';
  const description = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';
  const seo = skill.seo;
  const seoTitle = typeof seo?.title === 'string' ? seo.title : seo?.title?.en || '';
  const seoDesc = typeof seo?.description === 'string' ? seo.description : seo?.description?.en || '';
  const keywords = seo?.keywords?.en || [];
  const topics = skill.topics || [];

  const allText = `${name} ${description} ${seoTitle} ${seoDesc} ${keywords.join(' ')} ${topics.join(' ')}`;

  // Check for truly off-topic content (keep this check)
  if (hasUnthematicKeywords(allText)) {
    issues.push(`UNTHEMATIC_DETECTED - Off-topic content: ${name}`);
  }

  // Check for MISSING SEO data (not drift - that's ok)
  if (!seo || (!seoTitle && !seoDesc && keywords.length === 0)) {
    issues.push(`NO_SEO_DATA - Missing SEO metadata: ${name}`);
  }

  return issues;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🎯 Theme Alignment Audit Script

Usage:
  npx tsx scripts/audit-theme-alignment.ts        # Audit only
  npx tsx scripts/audit-theme-alignment.ts --fix  # Auto-fix issues
  npx tsx scripts/audit-theme-alignment.ts --dry-run --fix  # Preview fixes

Options:
  --fix      Auto-fix issues (remove off-topic, flag missing SEO)
  --dry-run  Preview changes without applying them
  --help     Show this help message

Issue Types:
  UNTHEMATIC_DETECTED - Skills with content unrelated to AI agents (will be removed)
  NO_SEO_DATA         - Skills missing SEO metadata (need regeneration)
`);
    process.exit(0);
  }

  const doFix = args.includes('--fix');
  const dryRun = args.includes('--dry-run');

  const cachePath = join(process.cwd(), 'data/skills-cache.json');
  console.log(`📂 Loading skills cache from: ${cachePath}\n`);

  const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
  const skills = cache.skills || [];

  console.log(`🔍 Analyzing ${skills.length} skills for theme alignment...\n`);

  if (doFix && !dryRun) {
    console.log('🔧 FIX MODE ENABLED - Will modify the cache file\n');
  } else if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const report = {
    total: skills.length,
    issues: 0,
    skillsWithIssues: 0,
    byType: {} as Record<string, number>,
  };

  const skillsToRemove: string[] = [];
  const skillsNeedingSEO: string[] = [];

  for (const skill of skills) {
    const skillId = skill.id || `${skill.owner}/${skill.repo}`;
    const skillIssues = checkSkill(skill);

    if (skillIssues.length > 0) {
      report.skillsWithIssues++;
      report.issues += skillIssues.length;

      for (const issue of skillIssues) {
        const issueType = issue.split(' - ')[0];
        report.byType[issueType] = (report.byType[issueType] || 0) + 1;

        if (issueType === 'UNTHEMATIC_DETECTED') {
          skillsToRemove.push(skillId);
          console.log(`🗑️  ${skillId} - Will be removed`);
        } else if (issueType === 'NO_SEO_DATA') {
          skillsNeedingSEO.push(skillId);
        }
      }

      for (const issue of skillIssues) {
        console.log(`⚠️ ${skillId}`);
        console.log(`   - ${issue}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total skills: ${report.total}`);
  console.log(
    `Skills with issues: ${report.skillsWithIssues} (${((report.skillsWithIssues / report.total) * 100).toFixed(1)}%)`,
  );
  console.log(`Total issues: ${report.issues}`);
  console.log('\nBy issue type:');
  for (const [type, count] of Object.entries(report.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Apply fixes if requested
  if (doFix && (skillsToRemove.length > 0 || skillsNeedingSEO.length > 0)) {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 APPLYING FIXES');
    console.log('='.repeat(60));

    if (skillsToRemove.length > 0) {
      console.log(`\n🗑️  Removing ${skillsToRemove.length} off-topic skills...`);
      const skillsToRemoveSet = new Set(skillsToRemove);
      const beforeCount = skills.length;
      const newSkills = skills.filter((s) => {
        const id = s.id || `${s.owner}/${s.repo}`;
        return !skillsToRemoveSet.has(id);
      });
      const afterCount = newSkills.length;

      if (!dryRun) {
        cache.skills = newSkills;
        writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      }

      console.log(`   Removed ${beforeCount - afterCount} skills (${beforeCount} -> ${afterCount})`);
    }

    if (skillsNeedingSEO.length > 0) {
      console.log(`\n📝 ${skillsNeedingSEO.length} skills need SEO generation.`);
      console.log('   Run: npx tsx scripts/generate-seo.ts --help');
      console.log('   Or manually regenerate SEO for these skills.');
    }
  }

  if (report.skillsWithIssues > 0) {
    if (doFix && !dryRun) {
      console.log('\n✅ Fixes applied successfully!');
      process.exit(0);
    } else if (dryRun) {
      console.log('\n🔍 Dry run complete. No changes made.');
      process.exit(1);
    } else {
      console.log('\n⚠️  WARNING: Some skills have theme alignment issues.');
      console.log('   Run with --fix to auto-fix, or --dry-run --fix to preview.');
      process.exit(1);
    }
  } else {
    console.log('\n✅ All skills are theme-aligned!');
    process.exit(0);
  }
}

main().catch(console.error);
