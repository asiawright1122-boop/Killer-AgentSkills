#!/usr/bin/env tsx

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildCanonicalizeVerificationResult,
  parseCanonicalizeFollowupMarkdown,
  renderCanonicalizeVerificationMarkdown,
} from './lib/gsc-canonicalize-verification';

const REPORT_DIR = path.join(process.cwd(), 'reports', 'seo');
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; KillerSkillsCanonicalVerifier/1.0; +https://killer-skills.com)';

function findLatestFollowupPath(): string {
  const matches = readdirSync(REPORT_DIR)
    .map((fileName) => {
      const match = fileName.match(/^gsc-removal-canonicalize-followup-(\d{4}-\d{2}-\d{2})\.md$/);
      return match ? { fileName, timestamp: match[1] } : null;
    })
    .filter((value): value is { fileName: string; timestamp: string } => Boolean(value))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (matches.length === 0) {
    throw new Error(`No gsc-removal-canonicalize-followup-YYYY-MM-DD.md files found in ${REPORT_DIR}`);
  }

  return path.join(REPORT_DIR, matches[matches.length - 1].fileName);
}

function extractTimestamp(filePath: string): string {
  const match = path.basename(filePath).match(/-(\d{4}-\d{2}-\d{2})\.md$/);
  if (!match) {
    throw new Error(`Could not extract timestamp from ${filePath}`);
  }

  return match[1];
}

async function main() {
  const inputArg = process.argv[2];
  const inputPath = inputArg ? path.resolve(process.cwd(), inputArg) : findLatestFollowupPath();
  const timestamp = extractTimestamp(inputPath);
  const markdown = readFileSync(inputPath, 'utf8');
  const entries = parseCanonicalizeFollowupMarkdown(markdown);

  const results = [];
  for (const entry of entries) {
    try {
      const response = await fetch(new URL(entry.sourceUrl).toString(), {
        redirect: 'manual',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
        },
      });

      results.push(
        buildCanonicalizeVerificationResult({
          entry,
          statusCode: response.status,
          locationHeader: response.headers.get('location'),
        }),
      );
    } catch (error) {
      results.push(
        buildCanonicalizeVerificationResult({
          entry,
          statusCode: null,
          locationHeader: null,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputPath: path.relative(process.cwd(), inputPath),
    checkedCount: results.length,
    verifiedCount: results.filter((result) => result.matched).length,
    failureCount: results.filter((result) => !result.matched).length,
    results,
  };

  const markdownPath = path.join(REPORT_DIR, `gsc-removal-canonicalize-verification-${timestamp}.md`);
  const jsonPath = path.join(REPORT_DIR, `gsc-removal-canonicalize-verification-${timestamp}.json`);

  writeFileSync(markdownPath, renderCanonicalizeVerificationMarkdown(report));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log('# GSC Canonicalize Verification');
  console.log(`- Input: ${inputPath}`);
  console.log(`- Checked URLs: ${report.checkedCount}`);
  console.log(`- Verified redirect matches: ${report.verifiedCount}`);
  console.log(`- Failures: ${report.failureCount}`);
  console.log(`- Markdown: ${markdownPath}`);
  console.log(`- JSON: ${jsonPath}`);
}

await main();
