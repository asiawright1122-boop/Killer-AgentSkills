export type CanonicalizeFollowupEntry = {
  sourceUrl: string;
  category: string;
  targetUrl: string;
  reason: string;
};

export type CanonicalizeVerificationResult = {
  sourceUrl: string;
  category: string;
  expectedTargetUrl: string;
  reason: string;
  statusCode: number | null;
  locationHeader: string | null;
  normalizedLocationUrl: string | null;
  matched: boolean;
  failureReason: string | null;
};

export type CanonicalizeVerificationReport = {
  generatedAt: string;
  inputPath: string;
  checkedCount: number;
  verifiedCount: number;
  failureCount: number;
  results: CanonicalizeVerificationResult[];
};

export function normalizeAbsoluteUrl(url: string): string {
  return new URL(url).toString();
}

export function normalizeRedirectLocation(sourceUrl: string, locationHeader: string | null): string | null {
  if (!locationHeader) return null;
  const trimmed = locationHeader.trim();
  if (!trimmed) return null;
  return new URL(trimmed, normalizeAbsoluteUrl(sourceUrl)).toString();
}

export function parseCanonicalizeFollowupMarkdown(markdown: string): CanonicalizeFollowupEntry[] {
  const entries: CanonicalizeFollowupEntry[] = [];
  let current: Partial<CanonicalizeFollowupEntry> | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('- https://')) {
      current = { sourceUrl: line.slice(2).trim() };
      entries.push(current as CanonicalizeFollowupEntry);
      continue;
    }

    if (!current) continue;
    if (line.startsWith('  - category: ')) {
      current.category = line.slice('  - category: '.length).trim();
      continue;
    }
    if (line.startsWith('  - target: ')) {
      current.targetUrl = line.slice('  - target: '.length).trim();
      continue;
    }
    if (line.startsWith('  - reason: ')) {
      current.reason = line.slice('  - reason: '.length).trim();
    }
  }

  return entries.filter(
    (entry): entry is CanonicalizeFollowupEntry =>
      Boolean(entry.sourceUrl && entry.category && entry.targetUrl && entry.reason),
  );
}

export function buildCanonicalizeVerificationResult(input: {
  entry: CanonicalizeFollowupEntry;
  statusCode: number | null;
  locationHeader: string | null;
  error?: string | null;
}): CanonicalizeVerificationResult {
  const expectedTargetUrl = normalizeAbsoluteUrl(input.entry.targetUrl);
  const normalizedLocationUrl = normalizeRedirectLocation(input.entry.sourceUrl, input.locationHeader);

  let failureReason: string | null = null;
  if (input.error) {
    failureReason = input.error;
  } else if (input.statusCode === null) {
    failureReason = 'No HTTP status was captured.';
  } else if (input.statusCode < 300 || input.statusCode >= 400) {
    failureReason = `Expected a redirect status, got ${input.statusCode}.`;
  } else if (!normalizedLocationUrl) {
    failureReason = 'Redirect response did not include a Location header.';
  } else if (normalizedLocationUrl !== expectedTargetUrl) {
    failureReason = `Redirect target mismatch: expected ${expectedTargetUrl} but got ${normalizedLocationUrl}.`;
  }

  return {
    sourceUrl: input.entry.sourceUrl,
    category: input.entry.category,
    expectedTargetUrl,
    reason: input.entry.reason,
    statusCode: input.statusCode,
    locationHeader: input.locationHeader,
    normalizedLocationUrl,
    matched: !failureReason,
    failureReason,
  };
}

export function renderCanonicalizeVerificationMarkdown(report: CanonicalizeVerificationReport): string {
  const lines: string[] = [];
  lines.push('# GSC Canonicalize Verification');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Input: \`${report.inputPath}\``);
  lines.push('Verification target: production `https://killer-skills.com`');
  lines.push('');
  lines.push('## Result');
  lines.push('');
  lines.push(`- Checked URLs: \`${report.checkedCount}\``);
  lines.push(`- Verified redirect matches: \`${report.verifiedCount}\``);
  lines.push(`- Failures: \`${report.failureCount}\``);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- Relative `Location` headers are normalized to absolute URLs before comparison.');
  lines.push('- Expected targets are URL-normalized, so spaces in path segments are treated as `%20` when comparing redirects.');

  const failures = report.results.filter((result) => !result.matched);
  const successes = report.results.filter((result) => result.matched);

  if (successes.length > 0) {
    lines.push(`- Production currently matches the expected canonical target for ${successes.length} URLs in the follow-up queue.`);
  }

  if (failures.length === 0) {
    lines.push('');
    lines.push('## Product Interpretation');
    lines.push('');
    lines.push('- These canonicalization fixes are live in production already.');
    lines.push('- Remaining recovery work for these URLs is mostly recrawl, deindex cleanup, and canonical consolidation in Google.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('');
  lines.push('## Failures');
  lines.push('');
  for (const result of failures) {
    lines.push(`- ${result.sourceUrl}`);
    lines.push(`  - category: ${result.category}`);
    lines.push(`  - expected: ${result.expectedTargetUrl}`);
    lines.push(`  - status: ${result.statusCode ?? 'error'}`);
    if (result.locationHeader) {
      lines.push(`  - location: ${result.locationHeader}`);
    }
    if (result.normalizedLocationUrl) {
      lines.push(`  - normalized-location: ${result.normalizedLocationUrl}`);
    }
    lines.push(`  - reason: ${result.failureReason}`);
  }

  return `${lines.join('\n')}\n`;
}
