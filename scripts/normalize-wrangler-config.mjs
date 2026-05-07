#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), process.argv[2] || 'dist/_worker.js/wrangler.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

function dedupeBindings(bindings) {
  if (!Array.isArray(bindings)) return bindings;

  const seen = new Set();
  return bindings.filter((binding) => {
    const name = binding?.binding;
    if (typeof name !== 'string' || name.length === 0) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

config.kv_namespaces = dedupeBindings(config.kv_namespaces);

writeFileSync(configPath, `${JSON.stringify(config)}\n`);
