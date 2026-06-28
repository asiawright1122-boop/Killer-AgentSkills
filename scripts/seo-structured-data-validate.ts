#!/usr/bin/env npx tsx
/**
 * SEO Structured Data Validation
 *
 * Phase 157 (Traffic Activation): Validates JSON-LD structured data on P0
 * authority surfaces by fetching each URL, parsing <script type="application/ld+json">
 * blocks, and checking required fields per schema type.
 *
 * Usage:
 *   npx tsx scripts/seo-structured-data-validate.ts
 *   npx tsx scripts/seo-structured-data-validate.ts --host http://localhost:4321
 *   npx tsx scripts/seo-structured-data-validate.ts --dry-run
 *
 * Outputs:
 *   - reports/seo/latest-structured-data-validation.json
 *   - reports/seo/latest-structured-data-validation.md
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const VAL_JSON = resolve(REPORT_DIR, 'latest-structured-data-validation.json');
const VAL_MD = resolve(REPORT_DIR, 'latest-structured-data-validation.md');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const hostArg = args.find((a) => a.startsWith('--host='));
const HOST = hostArg ? hostArg.split('=')[1] : 'https://killer-skills.com';
const LOCALE = 'en'; // Validate English URLs (canonical)

// ---------------------------------------------------------------------------
// Types (exported for testability)
// ---------------------------------------------------------------------------
export type P0Surface = {
  id: string;
  path: string;
  description: string;
  expectedSchemaTypes: string[];
};

export type SchemaValidationResult = {
  url: string;
  surfaceId: string;
  fetched: boolean;
  schemaBlocks: number;
  blocks: SchemaBlockResult[];
  passed: boolean;
  error?: string;
};

export type SchemaBlockResult = {
  schemaType: string;
  present: boolean;
  requiredFields: string[];
  missingFields: string[];
  emptyFields: string[];
  passed: boolean;
};

export type ValidationReport = {
  generatedAt: string;
  host: string;
  totalSurfaces: number;
  passed: number;
  failed: number;
  results: SchemaValidationResult[];
};

// ---------------------------------------------------------------------------
// P0 surfaces to validate
// ---------------------------------------------------------------------------
export const P0_SURFACES: P0Surface[] = [
  {
    id: 'home-root',
    path: '/',
    description: 'Homepage',
    expectedSchemaTypes: ['Organization', 'WebSite', 'FAQPage'],
  },
  {
    id: 'collections-hub',
    path: '/collections',
    description: 'Collections Hub',
    expectedSchemaTypes: ['CollectionPage'],
  },
  {
    id: 'collection-official-trusted-tools',
    path: '/collections/top-official-ai-skills-trusted-tools',
    description: 'Official AI Skills & Trusted Tools',
    expectedSchemaTypes: ['ItemList', 'FAQPage'],
  },
  {
    id: 'collection-agent-workflows',
    path: '/collections/top-agent-workflow-building-tools',
    description: 'Agent Workflow Building Tools',
    expectedSchemaTypes: ['ItemList', 'FAQPage'],
  },
  {
    id: 'collection-cursor',
    path: '/collections/top-cursor-compatible-skills-workflow-integrations',
    description: 'Cursor-Compatible Skills',
    expectedSchemaTypes: ['ItemList'],
  },
  {
    id: 'docs-installation',
    path: '/docs/installation',
    description: 'Installation Docs',
    expectedSchemaTypes: ['HowTo', 'FAQPage'],
  },
  {
    id: 'blog-official-ai-agent-skills-guide',
    path: '/blog/official-ai-agent-skills-guide',
    description: 'Official AI Agent Skills Guide',
    expectedSchemaTypes: ['BlogPosting'],
  },
  {
    id: 'blog-ide-comparison',
    path: '/blog/claude-code-vs-cursor-vs-windsurf',
    description: 'Claude Code vs Cursor vs Windsurf',
    expectedSchemaTypes: ['BlogPosting'],
  },
];

// ---------------------------------------------------------------------------
// Schema type required fields
// ---------------------------------------------------------------------------
export const SCHEMA_REQUIRED_FIELDS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  FAQPage: ['mainEntity'],
  ItemList: ['itemListElement'],
  CollectionPage: ['name'],
  BlogPosting: ['headline', 'author'],
  SoftwareApplication: ['name', 'operatingSystem', 'author'],
  Product: ['name'],
  HowTo: ['name', 'step'],
  BreadcrumbList: ['itemListElement'],
};

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

/**
 * Extract JSON-LD blocks from an HTML string.
 */
export function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      // Handle both single objects and arrays of objects
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      // Skip invalid JSON-LD blocks
    }
  }
  return blocks;
}

/**
 * Get the @type from a JSON-LD block (handles string or array types).
 */
export function getSchemaType(block: Record<string, unknown>): string {
  const type = block['@type'];
  if (Array.isArray(type)) return type[0] || 'Unknown';
  return String(type || 'Unknown');
}

/**
 * Validate a single JSON-LD block against its required fields.
 */
export function validateSchemaBlock(
  block: Record<string, unknown>,
): SchemaBlockResult {
  const schemaType = getSchemaType(block);
  const requiredFields = SCHEMA_REQUIRED_FIELDS[schemaType] || [];

  const missingFields: string[] = [];
  const emptyFields: string[] = [];

  for (const field of requiredFields) {
    const value = block[field];
    if (value === undefined || value === null) {
      missingFields.push(field);
    } else if (
      typeof value === 'string' && value.trim() === ''
    ) {
      emptyFields.push(field);
    } else if (
      Array.isArray(value) && value.length === 0
    ) {
      emptyFields.push(field);
    } else if (
      typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
    ) {
      emptyFields.push(field);
    }
  }

  return {
    schemaType,
    present: true,
    requiredFields,
    missingFields,
    emptyFields,
    passed: missingFields.length === 0 && emptyFields.length === 0,
  };
}

/**
 * Validate all schema blocks on a page against expected types.
 */
export function validatePageSchema(
  blocks: Record<string, unknown>[],
  expectedTypes: string[],
): SchemaBlockResult[] {
  const results: SchemaBlockResult[] = [];
  const foundTypes = new Set<string>();

  for (const block of blocks) {
    const result = validateSchemaBlock(block);
    foundTypes.add(result.schemaType);
    results.push(result);
  }

  // Check for missing expected types
  for (const expectedType of expectedTypes) {
    if (!foundTypes.has(expectedType)) {
      results.push({
        schemaType: expectedType,
        present: false,
        requiredFields: SCHEMA_REQUIRED_FIELDS[expectedType] || [],
        missingFields: SCHEMA_REQUIRED_FIELDS[expectedType] || [],
        emptyFields: [],
        passed: false,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Fetch + validate pipeline
// ---------------------------------------------------------------------------
async function fetchAndValidate(
  surface: P0Surface,
): Promise<SchemaValidationResult> {
  const url = `${HOST}/${LOCALE}${surface.path}`;
  const result: SchemaValidationResult = {
    url,
    surfaceId: surface.id,
    fetched: false,
    schemaBlocks: 0,
    blocks: [],
    passed: false,
  };

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KS-StructuredDataValidator/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    const html = await response.text();
    result.fetched = true;

    const blocks = extractJsonLdBlocks(html);
    result.schemaBlocks = blocks.length;
    result.blocks = validatePageSchema(blocks, surface.expectedSchemaTypes);
    result.passed = result.blocks.every((b) => b.passed);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderMarkdown(report: ValidationReport): string {
  const lines = [
    `# Structured Data Validation Report`,
    ``,
    `**Generated:** ${report.generatedAt}`,
    `**Host:** ${report.host}`,
    `**P0 surfaces:** ${report.totalSurfaces}`,
    `**Passed:** ${report.passed} | **Failed:** ${report.failed}`,
    ``,
    `## Results`,
    ``,
    `| Surface | URL | Blocks | Schema Types | Status |`,
    `|---------|-----|--------|-------------|--------|`,
    ...report.results.map((r) => {
      const types = r.blocks
        .filter((b) => b.present)
        .map((b) => b.schemaType)
        .join(', ');
      const status = r.passed ? '✅ pass' : '❌ fail';
      return `| ${r.surfaceId} | \`${r.url}\` | ${r.schemaBlocks} | ${types || '(none)'} | ${status} |`;
    }),
    ``,
    `## Detail`,
    ``,
  ];

  for (const r of report.results) {
    lines.push(`### ${r.surfaceId}`);
    lines.push('');
    if (r.error) {
      lines.push(`**Error:** ${r.error}`);
    } else {
      for (const b of r.blocks) {
        const icon = b.passed ? '✅' : '❌';
        lines.push(
          `- ${icon} \`${b.schemaType}\` ${
            b.present ? '(present)' : '(MISSING)'
          }`,
        );
        if (b.missingFields.length > 0) {
          lines.push(`  - Missing: ${b.missingFields.join(', ')}`);
        }
        if (b.emptyFields.length > 0) {
          lines.push(`  - Empty: ${b.emptyFields.join(', ')}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  mkdirSync(REPORT_DIR, { recursive: true });

  if (dryRun) {
    console.log('[DRY RUN] Would validate these P0 surfaces:');
    for (const surface of P0_SURFACES) {
      console.log(
        `  ${surface.id}: ${HOST}/${LOCALE}${surface.path} — expected: ${surface.expectedSchemaTypes.join(', ')}`,
      );
    }
    console.log('\nRemove --dry-run to execute validation.');
    return;
  }

  console.log(`Validating structured data on ${P0_SURFACES.length} P0 surfaces...`);
  console.log(`Host: ${HOST}`);

  const results: SchemaValidationResult[] = [];

  for (let i = 0; i < P0_SURFACES.length; i++) {
    const surface = P0_SURFACES[i];
    console.log(
      `[${i + 1}/${P0_SURFACES.length}] Validating: ${surface.id} (${surface.path})`,
    );

    const result = await fetchAndValidate(surface);
    results.push(result);

    const icon = result.passed ? '✅' : '❌';
    console.log(
      `  ${icon} ${result.schemaBlocks} blocks | ${result.blocks.filter((b) => b.present).map((b) => b.schemaType).join(', ')}`,
    );
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    host: HOST,
    totalSurfaces: P0_SURFACES.length,
    passed,
    failed,
    results,
  };

  writeFileSync(VAL_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  writeFileSync(VAL_MD, renderMarkdown(report), 'utf-8');

  console.log(`\nValidation complete.`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  console.log(`JSON: ${VAL_JSON}`);
  console.log(`Markdown: ${VAL_MD}`);
}

// Only run when executed directly
const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
