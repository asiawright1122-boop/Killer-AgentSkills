#!/usr/bin/env npx tsx

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type WranglerKvNamespace = {
  id?: string;
  title?: string;
};

type WranglerD1Database = {
  uuid?: string;
  name?: string;
};

type ParsedBinding = {
  binding: string;
  id: string;
};

type WranglerWhoamiSummary = {
  accountId: string | null;
  email: string | null;
  raw: string;
};

const DEFAULT_EXPECTED_ACCOUNT_ID = '8e336cf615f609e8f977bf6fc96d72ec';
const WRANGLER_CONFIG_PATH = resolve(process.cwd(), 'wrangler.toml');

function execWranglerJson(args: string[]): unknown {
  try {
    const output = execFileSync('npx', ['wrangler', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `failed to query Cloudflare via "wrangler ${args.join(
        ' ',
      )}". Ensure CLOUDFLARE_API_TOKEN is set for account ${normalizeExpectedAccountId()}. Details: ${details}`,
    );
  }
}

function parseBlockBindings(content: string, section: 'kv_namespaces' | 'd1_databases'): ParsedBinding[] {
  const pattern = new RegExp(`\\[\\[${section}\\]\\]([\\s\\S]*?)(?=\\n\\[\\[|\\n\\[|$)`, 'g');
  const matches = Array.from(content.matchAll(pattern));
  const bindings: ParsedBinding[] = [];

  for (const match of matches) {
    const block = match[1] || '';
    const bindingMatch = block.match(/\bbinding\s*=\s*"([^"]+)"/);
    const idMatch = block.match(/\b(?:id|database_id)\s*=\s*"([^"]+)"/);
    const binding = bindingMatch?.[1]?.trim() || '';
    const id = idMatch?.[1]?.trim() || '';
    if (!binding || !id) continue;
    bindings.push({ binding, id });
  }

  return bindings;
}

function getConfiguredBindings(): { kv: ParsedBinding[]; d1: ParsedBinding[] } {
  const content = readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
  return {
    kv: parseBlockBindings(content, 'kv_namespaces'),
    d1: parseBlockBindings(content, 'd1_databases'),
  };
}

function normalizeExpectedAccountId(): string {
  return (
    String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim() ||
    String(process.env.EXPECTED_CLOUDFLARE_ACCOUNT_ID || '').trim() ||
    DEFAULT_EXPECTED_ACCOUNT_ID
  );
}

function readWhoamiSummary(): WranglerWhoamiSummary {
  try {
    const raw = execFileSync('npx', ['wrangler', 'whoami'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const accountIdMatch = raw.match(/\b([a-f0-9]{32})\b/i);
    const emailMatch = raw.match(/associated with the email\s+([^\s.]+@[^\s.]+\.[^\s.]+)/i);

    return {
      accountId: accountIdMatch ? accountIdMatch[1].toLowerCase() : null,
      email: emailMatch ? emailMatch[1] : null,
      raw,
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return {
      accountId: null,
      email: null,
      raw: details,
    };
  }
}

function formatBindingList(label: string, bindings: ParsedBinding[]): string[] {
  if (bindings.length === 0) return [`- ${label}: none`];
  return bindings.map((entry) => `- ${label}.${entry.binding}: ${entry.id}`);
}

function main() {
  const expectedAccountId = normalizeExpectedAccountId();
  const configured = getConfiguredBindings();
  const whoami = readWhoamiSummary();

  if (whoami.accountId && whoami.accountId !== expectedAccountId.toLowerCase()) {
    const lines: string[] = [];
    lines.push('# Cloudflare Binding Guard');
    lines.push('');
    lines.push(`- Expected account id: ${expectedAccountId}`);
    lines.push(`- Current wrangler account id: ${whoami.accountId}`);
    if (whoami.email) {
      lines.push(`- Current wrangler email: ${whoami.email}`);
    }
    lines.push('');
    lines.push('- Status: fail');
    lines.push(`- Action: switch Wrangler login/token to account ${expectedAccountId} before deploying.`);
    console.error(lines.join('\n'));
    process.exit(1);
  }

  const kvList = execWranglerJson(['kv', 'namespace', 'list']) as WranglerKvNamespace[];
  const d1List = execWranglerJson(['d1', 'list', '--json']) as WranglerD1Database[];

  const liveKvIds = new Set(kvList.map((entry) => String(entry.id || '').trim()).filter(Boolean));
  const liveD1Ids = new Set(d1List.map((entry) => String(entry.uuid || '').trim()).filter(Boolean));

  const missingKv = configured.kv.filter((entry) => !liveKvIds.has(entry.id));
  const missingD1 = configured.d1.filter((entry) => !liveD1Ids.has(entry.id));
  const hasMismatch = missingKv.length > 0 || missingD1.length > 0;

  const lines: string[] = [];
  lines.push('# Cloudflare Binding Guard');
  lines.push('');
  lines.push(`- Expected account id: ${expectedAccountId}`);
  if (whoami.accountId) {
    lines.push(`- Current wrangler account id: ${whoami.accountId}`);
  }
  if (whoami.email) {
    lines.push(`- Current wrangler email: ${whoami.email}`);
  }
  lines.push(`- Wrangler config: ${WRANGLER_CONFIG_PATH}`);
  lines.push(`- KV configured: ${configured.kv.length}`);
  lines.push(`- D1 configured: ${configured.d1.length}`);
  lines.push('');
  lines.push('## Configured Bindings');
  lines.push(...formatBindingList('kv', configured.kv));
  lines.push(...formatBindingList('d1', configured.d1));
  lines.push('');
  lines.push(`## Live Resources (current Wrangler auth context)`);
  lines.push(`- KV ids discovered: ${Array.from(liveKvIds).join(', ') || 'none'}`);
  lines.push(`- D1 ids discovered: ${Array.from(liveD1Ids).join(', ') || 'none'}`);

  if (!hasMismatch) {
    lines.push('');
    lines.push('- Status: pass');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('');
  lines.push('## Mismatch');
  if (missingKv.length > 0) {
    lines.push(...missingKv.map((entry) => `- Missing KV binding in current auth context: ${entry.binding} (${entry.id})`));
  }
  if (missingD1.length > 0) {
    lines.push(...missingD1.map((entry) => `- Missing D1 binding in current auth context: ${entry.binding} (${entry.id})`));
  }
  lines.push('');
  lines.push('- Status: fail');
  lines.push(
    `- Action: switch Wrangler auth/token to Cloudflare account ${expectedAccountId} (or update wrangler.toml if migration target changed).`,
  );

  console.error(lines.join('\n'));
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
