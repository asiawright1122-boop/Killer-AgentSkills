#!/usr/bin/env node

function main() {
  console.error(
    'Blocked: scripts/generate-blog-posts.ts still emits unsafe MCP-first boilerplate. Use the curated SEO content workflow instead.',
  );
  process.exit(1);
}

main();
