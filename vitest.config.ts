import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'tests/e2e/**',
      '**/node_modules/**',
      'packages/og-server/**',
      'packages/cli/**',          // CLI has its own deps not installed in root — run separately
    ],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
