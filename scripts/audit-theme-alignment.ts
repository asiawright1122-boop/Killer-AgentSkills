#!/usr/bin/env npx tsx

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const THEME_KEYWORDS = [
  'ai agent',
  'ai agent skill',
  'claude code',
  'cursor',
  'windsurf',
  'mcp',
  'model context protocol',
  'agent skill',
  'skill installation',
  '.claude',
  '.agent',
  '.codex',
  'cursorrules',
];

const UNTHEMATIC_KEYWORDS = [
  'leetcode',
  '算法',
  'interview questions',
  'resume',
  'portfolio',
  'blog',
  'course',
  'tutorial',
  'ebook',
  'notes app',
];

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
  return THEME_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function hasUnthematicKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return UNTHEMATIC_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function checkSkill(skill: Skill, owner: string, repo: string) {
  const issues: string[] = [];

  const name = skill.name || '';
  const description = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';
  const seoTitle = typeof skill.seo?.title === 'string' ? skill.seo.title : skill.seo?.title?.en || '';
  const seoDesc = typeof skill.seo?.description === 'string' ? skill.seo.description : skill.seo?.description?.en || '';
  const keywords = skill.seo?.keywords?.en || [];

  const allText = `${name} ${description} ${seoTitle} ${seoDesc} ${keywords.join(' ')}`;

  if (!hasThematicKeywords(allText)) {
    issues.push(`NO_THEME_KEYWORDS - Missing theme keywords in: ${name}`);
  }

  if (hasUnthematicKeywords(allText)) {
    issues.push(`UNTHEMATIC_DETECTED - Unthematic keywords found in: ${name}`);
  }

  if (seoTitle && !seoTitle.includes('AI Agent') && !seoTitle.includes('Skill')) {
    issues.push(`SEO_TITLE_DRIFT - Title lacks theme: ${seoTitle.substring(0, 50)}`);
  }

  if (keywords.length > 0) {
    const hasThemeKeyword = keywords.some((kw) =>
      THEME_KEYWORDS.some((tk) => kw.toLowerCase().includes(tk.toLowerCase())),
    );
    if (!hasThemeKeyword) {
      issues.push(`KEYWORDS_DRIFT - No theme keywords in: ${keywords.slice(0, 3).join(', ')}`);
    }
  }

  return issues;
}

async function main() {
  const cachePath = join(process.cwd(), 'data/skills-cache.json');
  console.log(`📂 Loading skills cache from: ${cachePath}\n`);

  const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
  const skills = cache.skills || [];

  console.log(`🔍 Analyzing ${skills.length} skills for theme alignment...\n`);

  const report = {
    total: skills.length,
    issues: 0,
    skillsWithIssues: 0,
    byType: {} as Record<string, number>,
  };

  for (const skill of skills) {
    const skillId = skill.id || `${skill.owner}/${skill.repo}`;
    const skillIssues = checkSkill(skill, skill.owner, skill.repo);

    if (skillIssues.length > 0) {
      report.skillsWithIssues++;
      report.issues += skillIssues.length;

      console.log(`⚠️ ${skillId}`);
      for (const issue of skillIssues) {
        console.log(`   - ${issue}`);
        report.byType[issue.split(' - ')[0]] = (report.byType[issue.split(' - ')[0]] || 0) + 1;
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

  if (report.skillsWithIssues > 0) {
    console.log('\n⚠️ WARNING: Some skills have theme alignment issues.');
    console.log('   Consider regenerating SEO for these skills.');
    process.exit(1);
  } else {
    console.log('\n✅ All skills are theme-aligned!');
    process.exit(0);
  }
}

main().catch(console.error);
