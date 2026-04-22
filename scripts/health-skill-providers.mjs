import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsx', 'scripts/ai-provider-probe.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
