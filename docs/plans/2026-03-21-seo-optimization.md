# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance SEO performance across Killer-Skills.com through structured data improvements, 404 page optimization, blog-to-skill internal linking, and image accessibility enhancements.

**Architecture:** This plan focuses on five optimization areas: (1) Blog Article Schema enrichment, (2) Collection page Schema enhancement, (3) 404 page SEO improvements, (4) Blog-to-Skills internal linking, (5) Image alt text audit and remediation.

**Tech Stack:** Astro 5, TypeScript, JSON-LD Schema, Astro Content Collections

---

## File Structure

```
src/
├── pages/
│   └── [locale]/
│       ├── blog/
│       │   └── [...slug].astro        # MODIFY: Add Article Schema enhancements
│       └── collections/
│           └── [...slug].astro        # MODIFY: Add CreativeWork Schema
├── lib/
│   └── blog-schema.ts                 # CREATE: Article Schema builder
└── pages/
    └── 404.astro                      # MODIFY: SEO optimization
```

---

## Chunk 1: Blog Article Schema Enhancement

**Files:**

- Modify: `src/pages/[locale]/blog/[...slug].astro:69-98`
- Create: `src/lib/blog-schema.ts`

### Task 1: Create blog-schema.ts

**Files:**

- Create: `src/lib/blog-schema.ts`
- Test: `src/lib/blog-schema.test.ts`

- [ ] **Step 1: Create blog-schema.ts with enhanced Article Schema builder**

```typescript
// src/lib/blog-schema.ts

type BlogSchemaArgs = {
  title: string;
  description: string;
  author: string;
  pubDate: Date | string;
  updatedDate?: Date | string;
  heroImage?: string;
  canonicalUrl: string;
  locale: string;
  wordCount: number;
  tags?: string[];
  category?: string;
};

function toISO8601(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildBlogArticleSchema({
  title,
  description,
  author,
  pubDate,
  updatedDate,
  heroImage,
  canonicalUrl,
  locale,
  wordCount,
  tags = [],
  category,
}: BlogSchemaArgs) {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: {
      '@type': 'Person',
      name: author,
      url: 'https://killer-skills.com/about',
    },
    datePublished: toISO8601(pubDate),
    dateModified: toISO8601(updatedDate || pubDate),
    url: canonicalUrl,
    inLanguage: locale,
    wordCount,
    publisher: {
      '@type': 'Organization',
      name: 'Killer-Skills',
      url: 'https://killer-skills.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://killer-skills.com/og-image.webp',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  };

  // Add image if available
  if (heroImage) {
    return {
      ...baseSchema,
      image: {
        '@type': 'ImageObject',
        url: heroImage,
        width: 1200,
        height: 630,
      },
    };
  }

  return baseSchema;
}

export function buildBlogBreadcrumbSchema(locale: string, postTitle: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `https://killer-skills.com/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `https://killer-skills.com/${locale}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: postTitle,
        item: canonicalUrl,
      },
    ],
  };
}
```

- [ ] **Step 2: Create test file**

```typescript
// src/lib/blog-schema.test.ts
import { describe, it, expect } from 'vitest';
import { buildBlogArticleSchema, buildBlogBreadcrumbSchema } from './blog-schema';

describe('buildBlogArticleSchema', () => {
  it('creates valid Article schema with all fields', () => {
    const schema = buildBlogArticleSchema({
      title: 'Test Article',
      description: 'Test description',
      author: 'Test Author',
      pubDate: new Date('2026-01-01'),
      heroImage: 'https://example.com/image.jpg',
      canonicalUrl: 'https://killer-skills.com/en/blog/test',
      locale: 'en',
      wordCount: 1500,
      tags: ['AI', 'Skills'],
      category: 'guides',
    });

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe('Test Article');
    expect(schema.author['@type']).toBe('Person');
    expect(schema.image['@type']).toBe('ImageObject');
  });

  it('creates valid schema without hero image', () => {
    const schema = buildBlogArticleSchema({
      title: 'Test Article',
      description: 'Test description',
      author: 'Test Author',
      pubDate: '2026-01-01',
      canonicalUrl: 'https://killer-skills.com/en/blog/test',
      locale: 'en',
      wordCount: 1000,
    });

    expect(schema.image).toBeUndefined();
  });
});

describe('buildBlogBreadcrumbSchema', () => {
  it('creates valid BreadcrumbList schema', () => {
    const schema = buildBlogBreadcrumbSchema('en', 'Test Article', 'https://killer-skills.com/en/blog/test');

    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[2].position).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests to verify**

```bash
cd /Users/kaka/Dev/Killer-Skills
npx vitest run src/lib/blog-schema.test.ts
```

Expected: PASS (2 suites, 2 tests)

- [ ] **Step 4: Update blog page to use new schema builder**

In `src/pages/[locale]/blog/[...slug].astro`, replace lines 69-114 with:

```typescript
// Import the new schema builder
import { buildBlogArticleSchema, buildBlogBreadcrumbSchema } from '../../../lib/blog-schema';

// Replace the inline blogSchema object (lines 69-98) with:
const blogSchema = buildBlogArticleSchema({
  title: post.data.title,
  description: seoDescription,
  author: post.data.author,
  pubDate: post.data.pubDate,
  updatedDate: post.data.updatedDate,
  heroImage: post.data.heroImage,
  canonicalUrl,
  locale: typedLocale,
  wordCount,
  tags: post.data.tags,
  category: post.data.category,
});

// Replace the inline blogBreadcrumbSchema object (lines 100-114) with:
const blogBreadcrumbSchema = buildBlogBreadcrumbSchema(typedLocale, post.data.title, canonicalUrl);
```

- [ ] **Step 5: Run tests again**

```bash
npx vitest run src/lib/blog-schema.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/blog-schema.ts src/lib/blog-schema.test.ts src/pages/[locale]/blog/[...slug].astro
git commit -m "feat(seo): add blog Article Schema builder with enhanced structured data"
```

---

## Chunk 2: Collection Page Schema Enhancement

**Files:**

- Modify: `src/pages/[locale]/collections/[...slug].astro:105-122`

### Task 2: Enhance Collection Schema

- [ ] **Step 1: Enhance ItemList Schema with additional properties**

In `src/pages/[locale]/collections/[...slug].astro`, replace the itemListSchema (lines 105-122):

```typescript
// ItemList Schema with enhanced properties
const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: title,
  description: seoDescription,
  url: canonicalUrl,
  numberOfItems: featuredSkills.length,
  itemListElement: featuredSkills.map((skill, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'SoftwareApplication',
      name: skill.name || skill.repo,
      url: `https://killer-skills.com/${locale}/skills/${skill.owner}/${skill.repo}`,
      description: skill.description || '',
    },
  })),
};

// Additional: Collection Schema for rich snippets
const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: title,
  description: seoDescription,
  url: canonicalUrl,
  publisher: {
    '@type': 'Organization',
    name: 'Killer-Skills',
    url: 'https://killer-skills.com',
  },
  dateModified: new Date().toISOString(),
};
```

- [ ] **Step 2: Add CollectionPage schema to head**

After line 138 (the itemListSchema script), add:

```astro
<script is:inline type="application/ld+json" set:html={JSON.stringify(collectionSchema)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/[locale]/collections/[...slug].astro
git commit -m "feat(seo): enhance collection page with CollectionPage schema"
```

---

## Chunk 3: 404 Page SEO Optimization

**Files:**

- Modify: `src/pages/404.astro`

### Task 3: Optimize 404 Page for SEO

- [ ] **Step 1: Read current 404.astro**

```bash
cat src/pages/404.astro
```

- [ ] **Step 2: Update 404 page with SEO improvements**

Replace the entire file content:

```astro
---
import Layout from '../layouts/Layout.astro';

const locale = 'en';
---

<Layout
  locale={locale}
  title="404 - Page Not Found"
  description="The page you are looking for does not exist on Killer-Skills. Browse our collection of 2500+ AI agent skills for Claude Code, Cursor, and more."
  noindex={true}
>
  <!-- WebApplication Schema for 404 page context -->
  <script
    is:inline
    type="application/ld+json"
    set:html={JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '404 - Page Not Found',
      description: 'The requested page was not found',
      url: 'https://killer-skills.com/404',
    })}
  />

  <div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 relative py-20">
    <div
      class="brut-card border-4 border-[var(--border)] bg-[var(--background)] shadow-[12px_12px_0px_0px_var(--border)] p-12 md:p-16 max-w-2xl w-full relative"
    >
      <!-- Decorative Tape/Corner -->
      <div class="absolute -top-4 -left-4 w-12 h-12 border-t-4 border-l-4 border-[var(--primary)] pointer-events-none">
      </div>
      <div
        class="absolute -bottom-4 -right-4 w-12 h-12 border-b-4 border-r-4 border-[var(--primary)] pointer-events-none"
      >
      </div>

      <h1
        class="text-8xl md:text-9xl font-black text-[var(--foreground)] mb-6 select-none font-mono tracking-tighter mix-blend-difference"
      >
        404
      </h1>

      <h2 class="text-3xl md:text-4xl font-black text-[var(--foreground)] uppercase tracking-tight mb-6">
        PAGE NOT FOUND
      </h2>

      <p
        class="text-lg text-[var(--foreground)] opacity-80 font-bold mb-10 max-w-md mx-auto leading-relaxed border-y-2 border-dotted border-[var(--border)] py-6"
      >
        The skill you are looking for seems to be missing from our database. It might have been moved, deleted, or you
        found a glitch in the matrix.
      </p>

      <!-- Quick Search/Navigation -->
      <div class="mb-8 p-4 border-2 border-dashed border-[var(--border)]">
        <p class="text-sm font-bold text-[var(--muted-foreground)] mb-4 uppercase tracking-wider">Popular Pages</p>
        <div class="flex flex-wrap justify-center gap-2">
          <a
            href="/en/skills"
            class="px-3 py-2 bg-[var(--foreground)] text-[var(--background)] font-bold text-xs uppercase hover:bg-[var(--primary)] transition-colors"
          >
            Browse Skills
          </a>
          <a
            href="/en/collections"
            class="px-3 py-2 bg-[var(--foreground)] text-[var(--background)] font-bold text-xs uppercase hover:bg-[var(--primary)] transition-colors"
          >
            Collections
          </a>
          <a
            href="/en/blog"
            class="px-3 py-2 bg-[var(--foreground)] text-[var(--background)] font-bold text-xs uppercase hover:bg-[var(--primary)] transition-colors"
          >
            Blog
          </a>
          <a
            href="/en/cli"
            class="px-3 py-2 bg-[var(--foreground)] text-[var(--background)] font-bold text-xs uppercase hover:bg-[var(--primary)] transition-colors"
          >
            CLI Docs
          </a>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-6">
        <a
          href="/"
          class="w-full sm:w-auto px-8 py-4 bg-[var(--primary)] text-[var(--primary-foreground)] font-black uppercase tracking-widest border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all"
        >
          [ Return Home ]
        </a>
        <a
          href="/en/skills"
          class="w-full sm:w-auto px-8 py-4 bg-[var(--background)] text-[var(--foreground)] font-black uppercase tracking-widest border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all"
        >
          Browse Skills
        </a>
      </div>
    </div>
  </div>
</Layout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/404.astro
git commit -m "feat(seo): optimize 404 page with noindex, schema, and quick nav"
```

---

## Chunk 4: Blog-to-Skills Internal Linking

**Files:**

- Modify: `src/pages/[locale]/blog/[...slug].astro`

### Task 4: Add Related Skills Section to Blog Posts

- [ ] **Step 1: Create utility function for finding related skills**

Create: `src/lib/blog-skill-links.ts`

```typescript
// src/lib/blog-skill-links.ts
import type { Locale } from '../i18n';

type Skill = {
  owner: string;
  repo: string;
  name?: string;
  description?: string;
  topics?: string[];
  category?: string;
};

type IntentLink = {
  href: string;
  title: string;
  description: string;
  icon: string;
};

// Keywords that link blog topics to skills
const TOPIC_SKILL_MAP: Record<string, { owner: string; repo: string; label: string }[]> = {
  pdf: [{ owner: 'anthropics', repo: 'skills', label: 'PDF Skill' }],
  document: [{ owner: 'anthropics', repo: 'skills', label: 'Docx Skill' }],
  spreadsheet: [{ owner: 'anthropics', repo: 'skills', label: 'XLSX Skill' }],
  pptx: [{ owner: 'anthropics', repo: 'skills', label: 'PPTX Skill' }],
  testing: [{ owner: 'anthropics', repo: 'skills', label: 'E2E Testing Skill' }],
  frontend: [{ owner: 'anthropics', repo: 'skills', label: 'Frontend Design Skill' }],
  design: [{ owner: 'anthropics', repo: 'skills', label: 'Canvas Design Skill' }],
  mcp: [{ owner: 'anthropics', repo: 'skills', label: 'MCP Builder Skill' }],
  security: [{ owner: 'anthropics', repo: 'skills', label: 'Security Review Skill' }],
  docker: [{ owner: 'anthropics', repo: 'skills', label: 'Docker Patterns Skill' }],
  python: [{ owner: 'anthropics', repo: 'skills', label: 'Python Patterns Skill' }],
  kotlin: [{ owner: 'anthropics', repo: 'skills', label: 'Kotlin Patterns Skill' }],
  swift: [{ owner: 'anthropics', repo: 'skills', label: 'SwiftUI Patterns Skill' }],
  react: [{ owner: 'anthropics', repo: 'skills', label: 'Frontend Patterns Skill' }],
  seo: [{ owner: 'killer-skills', repo: 'skills', label: 'SEO Skills' }],
  video: [{ owner: 'anthropics', repo: 'skills', label: 'Video Editing Skill' }],
};

export function getRelatedSkillsForBlog(locale: Locale, tags: string[], category?: string): IntentLink[] {
  const links: IntentLink[] = [];
  const seen = new Set<string>();

  // Find skills based on tags
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    for (const [topic, skills] of Object.entries(TOPIC_SKILL_MAP)) {
      if (tagLower.includes(topic) || topic.includes(tagLower)) {
        for (const skill of skills) {
          const key = `${skill.owner}/${skill.repo}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({
              href: `/${locale}/skills/${skill.owner}/${skill.repo}`,
              title: skill.label,
              description: `Install and use the ${skill.label} for AI coding agents`,
              icon: 'zap',
            });
          }
        }
      }
    }
  }

  // Add MCP Builder for technical posts
  if (category === 'technical' || tags.some((t) => t.toLowerCase().includes('mcp'))) {
    if (!seen.has('anthropics/skills')) {
      links.push({
        href: `/${locale}/skills/anthropics/skills`,
        title: 'MCP Builder Skill',
        description: 'Build MCP servers for AI agent integrations',
        icon: 'server',
      });
    }
  }

  // Return top 3 related skills
  return links.slice(0, 3);
}
```

- [ ] **Step 2: Update blog page to include related skills section**

In `src/pages/[locale]/blog/[...slug].astro`, after the import section, add:

```typescript
import { getRelatedSkillsForBlog } from '../../../lib/blog-skill-links';
```

Then, after line 53 (intentLinks), add:

```typescript
// Related skills for internal linking
const relatedSkills = getRelatedSkillsForBlog(typedLocale, post.data.tags || [], post.data.category);
```

Finally, after the intentLinks section (around line 268), add:

```astro
<!-- Related Skills Section -->{
  relatedSkills.length > 0 && (
    <section class="mt-16 pt-8 border-t-4 border-[var(--border)]">
      <h2 class="text-xl font-black uppercase tracking-tight text-[var(--foreground)] mb-6 flex items-center gap-2">
        <span class="text-[var(--primary)]">⚡</span>
        Try These Related Skills
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {relatedSkills.map((skill) => (
          <a
            href={skill.href}
            class="group block border-4 border-[var(--foreground)] bg-[var(--background)] p-6 transition-all hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--foreground)]"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl">{skill.icon === 'zap' ? '⚡' : '🖥️'}</span>
              <h3 class="text-lg font-black uppercase tracking-tight">{skill.title}</h3>
            </div>
            <p class="text-sm font-bold opacity-80">{skill.description}</p>
            <div class="mt-4 text-xs font-black uppercase tracking-wider opacity-60 group-hover:opacity-100">
              Install → {skill.href}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/blog-skill-links.ts src/pages/[locale]/blog/[...slug].astro
git commit -m "feat(seo): add blog-to-skills internal linking with related skills section"
```

---

## Chunk 5: Image Alt Text Audit

**Files:**

- Create: `scripts/seo-audit-images.ts`
- Report: `docs/seo/image-audit-report.md`

### Task 5: Audit and Fix Image Alt Texts

- [ ] **Step 1: Create image audit script**

Create: `scripts/seo-audit-images.ts`

```typescript
// scripts/seo-audit-images.ts
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { join } from 'path';

const IMAGE_EXTENSIONS = ['.astro', '.tsx', '.jsx', '.mdx', '.md'];

interface ImageAuditResult {
  file: string;
  line: number;
  component: string;
  hasAlt: boolean;
  altValue: string;
  hasMeaningfulAlt: boolean;
}

async function auditImages(): Promise<ImageAuditResult[]> {
  const results: ImageAuditResult[] = [];
  const srcDir = join(process.cwd(), 'src');

  // Find all source files
  const files = await glob('**/*.{astro,tsx,jsx}', { cwd: srcDir });

  for (const file of files) {
    const content = await readFile(join(srcDir, file), 'utf-8');
    const lines = content.split('\n');

    // Check for <img> tags
    lines.forEach((line, index) => {
      if (line.includes('<img') || line.includes('<Image')) {
        const hasAlt = /alt\s*=/.test(line);
        const altMatch = line.match(/alt\s*=\s*["']([^"']*)["']/);
        const altValue = altMatch ? altMatch[1] : '';

        // Check for meaningful alt (not empty, not just the filename)
        const isMeaningful = altValue.length > 5 && !altValue.match(/^\/|^\.\//);

        results.push({
          file,
          line: index + 1,
          component: 'img',
          hasAlt,
          altValue,
          hasMeaningfulAlt: isMeaningful,
        });
      }
    });

    // Check for Next/React Image component
    lines.forEach((line, index) => {
      if (line.includes('<Image') || line.includes('ImageComponent')) {
        const hasAlt = /alt\s*=/.test(line);
        const altMatch = line.match(/alt\s*=\s*["']([^"']*)["']/);
        const altValue = altMatch ? altMatch[1] : '';

        results.push({
          file,
          line: index + 1,
          component: 'Image',
          hasAlt,
          altValue,
          hasMeaningfulAlt: altValue.length > 5,
        });
      }
    });
  }

  return results;
}

async function main() {
  console.log('🔍 Auditing images for alt text...\n');

  const results = await auditImages();

  // Report issues
  const issues = results.filter((r) => !r.hasAlt || !r.hasMeaningfulAlt);

  console.log(`📊 Total images found: ${results.length}`);
  console.log(`⚠️  Images missing alt: ${results.filter((r) => !r.hasAlt).length}`);
  console.log(`⚠️  Images with weak alt: ${results.filter((r) => r.hasAlt && !r.hasMeaningfulAlt).length}\n`);

  if (issues.length > 0) {
    console.log('📋 Issues found:\n');
    issues.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    - ${issue.hasAlt ? 'Weak alt: ' + issue.altValue : 'Missing alt attribute'}`);
    });
  } else {
    console.log('✅ All images have meaningful alt text!');
  }

  // Generate markdown report
  const report = `# Image Alt Text Audit Report

Generated: ${new Date().toISOString()}

## Summary
- Total images: ${results.length}
- Missing alt: ${results.filter((r) => !r.hasAlt).length}
- Weak alt text: ${results.filter((r) => r.hasAlt && !r.hasMeaningfulAlt).length}

## Issues

${issues.length > 0 ? issues.map((i) => `- ${i.file}:${i.line} - ${i.hasAlt ? 'Weak: ' + i.altValue : 'Missing alt'}`).join('\n') : 'None'}

## Good Examples

${results
  .filter((r) => r.hasMeaningfulAlt)
  .slice(0, 5)
  .map((i) => `- ${i.file}:${i.line} - "${i.altValue}"`)
  .join('\n')}
`;

  console.log('\n' + report);
}

main().catch(console.error);
```

- [ ] **Step 2: Run the audit**

```bash
npx tsx scripts/seo-audit-images.ts
```

- [ ] **Step 3: Review the output and create fix tasks**

Based on the audit results, fix images in priority order:

1. Hero images on blog posts
2. Skill card images
3. Author avatars
4. Social icons

For each fix, update the alt text to be descriptive:

```astro
<!-- ❌ Bad -->
<img src="/image.jpg" alt="/image.jpg" />

<!-- ✅ Good -->
<img src="/image.jpg" alt="PDF automation workflow diagram showing the extraction process" />
```

- [ ] **Step 4: Commit audit script**

```bash
git add scripts/seo-audit-images.ts
git commit -m "chore(seo): add image alt text audit script"
```

---

## Chunk 6: Final Verification

### Task 6: Run Comprehensive SEO Tests

- [ ] **Step 1: Run all schema tests**

```bash
npx vitest run src/lib/blog-schema.test.ts
```

Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Run build test**

```bash
npm run build 2>&1 | head -50
```

Expected: Build succeeds

- [ ] **Step 4: Verify structured data with validator**

Use Google Rich Results Test or Schema.org validator to check:

- Blog posts: `https://search.google.com/test/rich-results`
- Collections: ItemList + CollectionPage schema

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(seo): complete SEO optimization - schemas, 404, internal linking, image audit"
```

---

## Verification Checklist

- [ ] Blog Article Schema validates with Schema.org
- [ ] Collection Page has both ItemList and CollectionPage schemas
- [ ] 404 page has noindex and quick navigation
- [ ] Blog posts show related skills section
- [ ] Image audit script runs without errors
- [ ] All existing tests still pass
- [ ] Build completes successfully

---

## Rollback Plan

If issues arise, rollback commits individually:

```bash
# Rollback last commit
git revert HEAD

# Rollback specific file
git checkout HEAD~1 -- src/pages/[locale]/blog/[...slug].astro
```

---

## Dependencies

- `vitest` - Already in project
- `glob` - Already in project
- TypeScript - Already configured

## Notes

- All schema changes are backward compatible
- 404 page noindex prevents duplicate content issues
- Internal linking improves site crawlability
- Image alt improvements help with accessibility AND SEO
