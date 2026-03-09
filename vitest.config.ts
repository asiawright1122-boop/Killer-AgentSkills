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
      'src/build-validation.test.ts', // Requires dist/ from prior build — run in Build job
    ],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
