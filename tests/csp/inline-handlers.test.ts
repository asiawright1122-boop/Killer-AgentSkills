import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guard: keep the codebase free of inline event-handler attributes such as
 * `onload=`, `onclick=`, `onerror=`, `onsubmit=`, `onchange=`, etc.
 *
 * These attributes are equivalent to inline scripts and would only execute
 * under a CSP that allows `'unsafe-inline'` in `script-src`. Astro's
 * experimental CSP (configured in `astro.config.mjs`) emits a hash-only
 * `script-src`, so any new inline handler will silently break in production
 * before this guard catches it. Refactor handlers into `<script>` blocks
 * (auto-hashed) or React islands (`client:*`).
 */

const ROOT = resolve(__dirname, '../../');
const SCAN_DIRS = ['src/pages', 'src/components', 'src/layouts', 'src/islands'];
// Match `onfoo="..."` attributes only — case-insensitive, and bounded by the
// preceding whitespace + valid HTML attribute boundary so we don't flag
// `Math.onload` or similar identifiers in JS source.
const HANDLER_REGEX = /\s(on[a-z]+)\s*=\s*['"]/gi;
// Comments contain "onload=" / "onclick=" as documentation references — skip
// any line that looks like a comment.
const COMMENT_LINE = /^\s*(?:\/\/|\*|\/\*|<!--|---|#)/;

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(astro|tsx|jsx|html)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('CSP inline-handler guard', () => {
  it('contains no inline `onfoo="..."` event handlers in scanned source files', () => {
    const offenders: string[] = [];
    for (const rel of SCAN_DIRS) {
      const files = walk(join(ROOT, rel));
      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (COMMENT_LINE.test(line)) continue;
          HANDLER_REGEX.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = HANDLER_REGEX.exec(line)) !== null) {
            const attr = match[1].toLowerCase();
            // Allow declarative-only attributes that are not script-bearing.
            // (Currently none — every `on*` attribute in HTML is a JS
            // handler. Listed explicitly for future-proofing.)
            if (['onmessage'].includes(attr)) continue;
            offenders.push(`${file.replace(ROOT + '/', '')}:${i + 1}  ${line.trim()}`);
          }
        }
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        'Found inline event-handler attributes that violate the strict CSP:\n' +
          offenders.map((o) => '  ' + o).join('\n') +
          '\n\nRefactor each into a <script> block (Astro auto-hashes) or a React island.',
      );
    }
    expect(offenders).toEqual([]);
  });
});
