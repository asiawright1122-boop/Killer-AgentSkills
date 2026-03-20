import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'tests/e2e/**',
      '**/node_modules/**',
      '**/.claude/**',            // Ignore local Claude worktree mirrors to avoid duplicate test discovery
      'packages/og-server/**',
      'packages/cli/**',          // CLI has its own deps not installed in root — run separately
      'src/build-validation.test.ts', // Run only in build job after dist/ exists
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
