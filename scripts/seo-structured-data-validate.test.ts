import { describe, expect, it } from 'vitest';
import {
  extractJsonLdBlocks,
  getSchemaType,
  validateSchemaBlock,
  validatePageSchema,
  SCHEMA_REQUIRED_FIELDS,
} from './seo-structured-data-validate';

describe('extractJsonLdBlocks', () => {
  it('extracts a single JSON-LD block from HTML', () => {
    const html = `
      <html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test","url":"https://example.com"}</script>
      </head><body></body></html>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]['@type']).toBe('Organization');
  });

  it('extracts multiple JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Test","url":"https://example.com"}</script>
      <script type="application/ld+json">{"@type":"WebSite","name":"Test Site","url":"https://example.com"}</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(2);
  });

  it('handles single-quoted type attribute', () => {
    const html = `<script type='application/ld+json'>{"@type":"FAQPage","mainEntity":[]}</script>`;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
  });

  it('skips invalid JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Test"}</script>
      <script type="application/ld+json">invalid json here</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
  });

  it('handles JSON-LD arrays', () => {
    const html = `
      <script type="application/ld+json">[{"@type":"Organization","name":"Test","url":"https://example.com"},{"@type":"WebSite","name":"Site","url":"https://example.com"}]</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(2);
  });

  it('returns empty array for HTML with no JSON-LD', () => {
    const blocks = extractJsonLdBlocks('<html><body>No schema here</body></html>');
    expect(blocks).toHaveLength(0);
  });
});

describe('getSchemaType', () => {
  it('extracts string @type', () => {
    expect(getSchemaType({ '@type': 'FAQPage' })).toBe('FAQPage');
  });

  it('extracts first element from array @type', () => {
    expect(getSchemaType({ '@type': ['SoftwareApplication', 'Product'] })).toBe('SoftwareApplication');
  });

  it('returns Unknown for missing @type', () => {
    expect(getSchemaType({})).toBe('Unknown');
  });
});

describe('validateSchemaBlock', () => {
  it('passes a valid FAQPage block', () => {
    const block = {
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Test?' }],
    };
    const result = validateSchemaBlock(block);
    expect(result.schemaType).toBe('FAQPage');
    expect(result.passed).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('fails a FAQPage block missing mainEntity', () => {
    const block = { '@type': 'FAQPage' };
    const result = validateSchemaBlock(block);
    expect(result.passed).toBe(false);
    expect(result.missingFields).toContain('mainEntity');
  });

  it('fails a SoftwareApplication with empty name', () => {
    const block = {
      '@type': 'SoftwareApplication',
      name: '  ',
      operatingSystem: 'Any',
      author: { '@type': 'Organization', name: 'Test' },
    };
    const result = validateSchemaBlock(block);
    expect(result.passed).toBe(false);
    expect(result.emptyFields).toContain('name');
  });

  it('fails a BlogPosting missing author', () => {
    const block = { '@type': 'BlogPosting', headline: 'Test Post' };
    const result = validateSchemaBlock(block);
    expect(result.passed).toBe(false);
    expect(result.missingFields).toContain('author');
  });

  it('passes a valid Organization block', () => {
    const block = { '@type': 'Organization', name: 'Test', url: 'https://example.com' };
    const result = validateSchemaBlock(block);
    expect(result.passed).toBe(true);
  });
});

describe('validatePageSchema', () => {
  it('reports missing expected schema types', () => {
    const blocks = [{ '@type': 'Organization', name: 'Test', url: 'https://example.com' }];
    const results = validatePageSchema(blocks, ['Organization', 'FAQPage']);

    const orgResult = results.find((r) => r.schemaType === 'Organization');
    expect(orgResult?.present).toBe(true);
    expect(orgResult?.passed).toBe(true);

    const faqResult = results.find((r) => r.schemaType === 'FAQPage');
    expect(faqResult?.present).toBe(false);
    expect(faqResult?.passed).toBe(false);
  });

  it('passes when all expected types are present and valid', () => {
    const blocks = [
      { '@type': 'Organization', name: 'Test', url: 'https://example.com' },
      { '@type': 'WebSite', name: 'Site', url: 'https://example.com' },
    ];
    const results = validatePageSchema(blocks, ['Organization', 'WebSite']);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});

describe('SCHEMA_REQUIRED_FIELDS', () => {
  it('defines required fields for all P0 expected types', () => {
    const expectedTypes = [
      'Organization', 'WebSite', 'FAQPage', 'ItemList',
      'CollectionPage', 'BlogPosting', 'SoftwareApplication',
      'Product', 'HowTo', 'BreadcrumbList',
    ];
    for (const type of expectedTypes) {
      expect(SCHEMA_REQUIRED_FIELDS[type]).toBeDefined();
      expect(SCHEMA_REQUIRED_FIELDS[type].length).toBeGreaterThan(0);
    }
  });
});
